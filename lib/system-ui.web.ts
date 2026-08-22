/**
 * Synchronisation des barres système — version web (no-op).
 *
 * Les barres de navigation système (expo-navigation-bar) n'existent que sur
 * Android. Sur le web, le navigateur gère lui-même la barre d'adresse.
 */
export async function syncSystemBars(_isDark: boolean): Promise<void> {
  /* no-op web */
}
