import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/** Seuil de largeur au-delà duquel on passe en mode desktop. */
const DESKTOP_MIN_WIDTH = 768;

/**
 * Détecte si l'app tourne sur web avec un viewport de bureau (>= 768 px).
 *
 * - Mobile (Android / iOS) → toujours `false`.
 * - Web, viewport < 768 px (mobile browser) → `false` (on garde la bottom tab bar).
 * - Web, viewport >= 768 px (desktop / tablette paysage) → `true`.
 */
export function useIsWebDesktop(): boolean {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    if (Platform.OS !== 'web') return false;
    return width >= DESKTOP_MIN_WIDTH;
  }, [width]);
}
