import type { NavigationState } from '@react-navigation/native';

/**
 * Détermine si la tab bar doit être visible selon l'état de navigation.
 *
 * Les fiches boutique (marketplace/[enterpriseId]) et produit (product/[id])
 * vivent désormais dans le Stack racine (plein écran, au-dessus des onglets) :
 * la tab bar n'est donc tout simplement pas rendue dessus. Toutes les routes
 * du navigateur Tabs restantes affichent la barre.
 */
export function shouldShowTabBar(_state: NavigationState | undefined): boolean {
  return true;
}
