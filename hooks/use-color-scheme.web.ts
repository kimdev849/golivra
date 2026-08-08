import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useAppThemeOptional } from '@/contexts/app-theme-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // La préférence explicite de l'utilisateur (clair / sombre / système) prime
  // sur le schéma du téléphone — sans quoi le mode choisi dans les réglages
  // ne s'applique jamais sur le web.
  const ctx = useAppThemeOptional();

  if (hasHydrated && ctx) {
    return ctx.colorScheme;
  }

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme === 'dark' ? 'dark' : 'light';
  }

  return 'light';
}
