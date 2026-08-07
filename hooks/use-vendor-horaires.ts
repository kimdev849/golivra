import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { getSessionToken } from '@/lib/auth';
import { fetchEnterpriseHoraires, type EnterpriseHoraires } from '@/lib/enterprise';
// Logique pure (statut ouvert/fermé + prochaine ouverture) — testable en Node.
import { computeOpenStatus, summarizeHoraires } from '@/lib/horaires-status';

// Ré-export de compatibilité (la logique vit maintenant dans lib/horaires-status).
export { computeOpenStatus, formatHourLabel, summarizeHoraires } from '@/lib/horaires-status';

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
