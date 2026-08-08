/** Affichage prix en FCFA (données locales). */
export function formatFcfa(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

/**
 * Formate une durée en minutes en langage humain, grand public :
 * 45 → « 45 min », 90 → « 1 h 30 », 120 → « 2 h », 85 → « 1 h 25 ».
 * `null`/invalide → « quelques minutes » (jamais de chiffre absurde).
 */
export function formatHumanMinutes(minutes: number | null | undefined): string {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m <= 0) return 'quelques minutes';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${m} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${String(rest).padStart(2, '0')}`;
}
