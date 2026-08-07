import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { getSessionToken } from '@/lib/auth';
import { fetchEnterpriseHoraires, type EnterpriseHoraires } from '@/lib/enterprise';

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** "09:00:00" → "9h", "14:30:00" → "14h30". */
export function formatHourLabel(h: string | null | undefined): string {
  if (!h) return '';
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(h);
  const hh = Number(m[1]);
  const mm = m[2];
  return mm === '00' ? `${hh}h` : `${hh}h${mm}`;
}

function toMinutes(h: string | null | undefined): number | null {
  if (!h) return null;
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Statut ouvert/fermé à l'instant T (mêmes règles que le backend : plages, chevauchement minuit). */
export function computeOpenStatus(
  horaires: EnterpriseHoraires[],
  now: Date = new Date(),
): { open: boolean; todayHours: string; nextLabel: string } {
  const todayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayPlages = horaires.filter((h) => Number(h.jour) === todayIdx);
  const inWindow = (p: EnterpriseHoraires) => {
    const start = toMinutes(p.ouverture);
    const end = toMinutes(p.fermeture);
    if (start == null || end == null) return false;
    if (end > start) return nowMin >= start && nowMin < end;
    return nowMin >= start || nowMin < end; // chevauchement minuit
  };
  const open = todayPlages.some(inWindow);

  const todayHours = todayPlages
    .map((p) => `${formatHourLabel(p.ouverture)}–${formatHourLabel(p.fermeture)}`)
    .join(', ');

  let nextLabel = '';
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const plages = horaires
      .filter((h) => Number(h.jour) === day.getDay())
      .map((p) => toMinutes(p.ouverture))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);
    if (plages.length > 0) {
      const start = plages[0];
      const label =
        offset === 1
          ? `demain à ${formatHourLabel(String(Math.floor(start / 60)).padStart(2, '0') + ':' + String(start % 60).padStart(2, '0') + ':00')}`
          : `${DAY_LONG[day.getDay()]} à ${formatHourLabel(String(Math.floor(start / 60)).padStart(2, '0') + ':' + String(start % 60).padStart(2, '0') + ':00')}`;
      nextLabel = label;
      break;
    }
  }

  return { open, todayHours, nextLabel };
}

/** Résumé compact pour l'affichage vendeur. */
export function summarizeHoraires(horaires: EnterpriseHoraires[]): string {
  const openDays = horaires.filter((h) => toMinutes(h.ouverture) != null && toMinutes(h.fermeture) != null);
  if (openDays.length === 0) return 'Aucun jour défini';
  if (openDays.length === 7) {
    const first = openDays[0];
    const same =
      openDays.every(
        (h) => h.ouverture === first.ouverture && h.fermeture === first.fermeture,
      );
    if (same) return `Tous les jours · ${formatHourLabel(first.ouverture)}–${formatHourLabel(first.fermeture)}`;
  }
  const byHour = new Map<string, string[]>();
  for (const h of openDays) {
    const key = `${formatHourLabel(h.ouverture)}–${formatHourLabel(h.fermeture)}`;
    const list = byHour.get(key) || [];
    list.push(DAY_SHORT[Number(h.jour)]);
    byHour.set(key, list);
  }
  return [...byHour.entries()]
    .map(([hours, days]) => `${days.join(', ')} · ${hours}`)
    .join('  |  ');
}

/**
 * Charge et interprète les horaires du commerce du vendeur.
 * Aucun horaire → `hasHours=false` (commandes bloquées, mode strict).
 *
 * Recharge à CHAQUE focus de l'écran (retour de l'éditeur horaires, changement
 * d'onglet, etc.) : après un enregistrement, la carte du dashboard et la
 * bannière des commandes se mettent à jour immédiatement. Le premier chargement
 * affiche « Chargement… », les rechargements suivants sont SILENCIEUX (l'état
 * actuel reste affiché jusqu'à la mise à jour, pas de clignotement).
 */
export function useVendorHoraires(enterpriseId: string | null | undefined) {
  const [horaires, setHoraires] = useState<EnterpriseHoraires[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // Commerce pour lequel on a déjà chargé (permet de recharger en silencieux
  // au focus, et de repartir du spinner si l'id change).
  const loadedForRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const id = enterpriseId || null;
    if (!id) {
      setLoading(false);
      setLoaded(true);
      return;
    }
    const isFirstForThisShop = loadedForRef.current !== id;
    if (isFirstForThisShop) setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setLoading(false);
        setLoaded(true);
        return;
      }
      const data = await fetchEnterpriseHoraires(token, id);
      setHoraires(Array.isArray(data) ? data : []);
    } catch {
      /* silencieux : on garde l'état actuel */
    } finally {
      loadedForRef.current = id;
      setLoading(false);
      setLoaded(true);
    }
  }, [enterpriseId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const hasHours = horaires.length > 0;
  const status = computeOpenStatus(horaires);

  return {
    horaires,
    loading,
    loaded,
    hasHours,
    openNow: status.open,
    todayHours: status.todayHours,
    nextLabel: status.nextLabel,
    summary: summarizeHoraires(horaires),
    openDaysCount: horaires.length,
    refresh,
  };
}
