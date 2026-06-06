import type { NavigationState, PartialState } from '@react-navigation/native';

type RouteLike = { name: string; state?: PartialState<NavigationState> };

/** Routes tab racine où la barre doit rester masquée (stack détail plein écran). */
const HIDDEN_TAB_ROOTS = new Set(['product/[id]']);

/**
 * Détermine si la tab bar doit être visible selon l'état de navigation.
 * Masquée sur fiche produit/plat et page commerce (marketplace/[id]).
 */
export function shouldShowTabBar(state: NavigationState | undefined): boolean {
  if (!state?.routes?.length) return true;

  const route = state.routes[state.index ?? 0] as RouteLike | undefined;
  if (!route) return true;

  if (HIDDEN_TAB_ROOTS.has(route.name)) return false;

  if (route.name === 'marketplace') {
    const nested = route.state;
    if (nested?.routes?.length) {
      const nestedRoute = nested.routes[nested.index ?? 0];
      if (nestedRoute && nestedRoute.name !== 'index') return false;
    }
  }

  return true;
}
