/**
 * Mise à jour OTA — version web (no-op).
 *
 * Les mises à jour Expo Updates ne fonctionnent QUE sur les builds EAS
 * natifs (iOS / Android). Sur le web, le contenu est servi en statique
 * par Render : il n'y a rien à vérifier ni à télécharger côté client.
 *
 * Ce fichier est résolu par Metro à la place de update-checker.ts
 * grâce au suffixe .web (résolution de plateforme).
 */
export function startUpdateChecker(): void {
  /* no-op web */
}
