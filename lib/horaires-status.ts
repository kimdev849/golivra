import type { EnterpriseHoraires } from '@/lib/enterprise';

/**
 * Logique pure des horaires d'ouverture (statut ouvert/fermé + prochaine
 * ouverture). Aucune dépendance React Native → testable en Node.
 */

/** Index JS des jours : 0=dimanche … 6=samedi (même base que `Date.getDay()`). */
export const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const DAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

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

/**
 * Statut ouvert/fermé à l'instant T (mêmes règles que le backend : plages,
 * chevauchement minuit).
 *
 * `nextLabel` indique la prochaine ouverture en commençant AUJOURD'HUI :
 * « aujourd'hui à 9h », « demain à 9h » ou « jeudi à 9h ». Un commerce qui
 * ouvre plus tard dans la journée ne doit PAS être affiché « fermé
 * aujourd'hui ».
 */
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

  const hourLabelOf = (minutes: number) =>
    formatHourLabel(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`,
    );

  let nextLabel = '';
  // La recherche commence AUJOURD'HUI (offset 0) : si le commerce ouvre plus
  // tard dans la journée (ex. 7h maintenant, ouverture 9h), on l'indique au
  // lieu de laisser croire qu'il est fermé toute la journée.
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    let plages = horaires
      .filter((h) => Number(h.jour) === day.getDay())
      .map((p) => toMinutes(p.ouverture))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);
    if (offset === 0) {
      // Aujourd'hui : uniquement les ouvertures pas encore commencées.
      plages = plages.filter((m) => m > nowMin);
    }
    if (plages.length > 0) {
      const start = plages[0];
      const when =
        offset === 0
          ? `aujourd'hui à ${hourLabelOf(start)}`
          : offset === 1
            ? `demain à ${hourLabelOf(start)}`
            : `${DAY_LONG[day.getDay()]} à ${hourLabelOf(start)}`;
      nextLabel = when;
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
