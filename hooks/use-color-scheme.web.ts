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

  // TOUS les hooks doivent être appelés inconditionnellement, AVANT tout
  // retour — sinon le nombre de hooks change entre le premier rendu et les
  // mises à jour, et React plante (areHookInputsEqual / undefined.length).
  const ctx = useAppThemeOptional();
  const colorScheme = useRNColorScheme();

  // La préférence explicite de l'utilisateur (clair / sombre / système) prime
  // sur le schéma du téléphone — sans quoi le mode choisi dans les réglages
  // ne s'applique jamais sur le web.
  if (hasHydrated && ctx) {
    return ctx.colorScheme;
  }

  if (hasHydrated) {
    return colorScheme === 'dark' ? 'dark' : 'light';
  }

  return 'light';
}
