import { useAppThemeOptional } from '@/contexts/app-theme-context';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ColorSchemeName = 'light' | 'dark';

export function useColorScheme(): ColorSchemeName {
  // Tous les hooks appelés inconditionnellement, AVANT tout retour — sinon le
  // nombre de hooks change selon que le provider est monté et React plante.
  const ctx = useAppThemeOptional();
  const system = useSystemColorScheme();
  if (ctx) return ctx.colorScheme;
  return system === 'dark' ? 'dark' : 'light';
}
