import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { safeRouter as router } from '@/lib/safe-router';
import { Platform } from 'react-native';

import type { AppPalette } from '@/constants/app-palette';

/** Options stack partagées — navigation fluide type apps grand public. */
export function stackScreenOptions(colors: AppPalette): NativeStackNavigationOptions {
  return {
    headerShown: false,
    animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
    gestureEnabled: true,
    fullScreenGestureEnabled: Platform.OS === 'ios',
    animationDuration: 280,
    contentStyle: { backgroundColor: colors.background },
  };
}

export function stackTabRootOptions(): NativeStackNavigationOptions {
  return {
    animation: 'none',
    gestureEnabled: false,
  };
}

export function stackAuthOptions(colors?: AppPalette): NativeStackNavigationOptions {
  return {
    // Slide latéral fluide sur toutes les plateformes (type Facebook) avec
    // geste de retour — navigation simple et naturelle entre connexion/inscription.
    animation: 'slide_from_right',
    animationDuration: 250,
    gestureEnabled: true,
    contentStyle: { backgroundColor: colors?.background ?? '#0B0C0E' },
  };
}

export function stackModalOptions(colors: AppPalette): NativeStackNavigationOptions {
  return {
    presentation: 'modal',
    animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade_from_bottom',
    gestureEnabled: true,
    contentStyle: { backgroundColor: colors.background },
  };
}

/** Retour à l'accueil en mode invité après déconnexion. */
export function navigateToAuthAfterLogout(): void {
  router.replace('/(tabs)');

  // Sur le web, la pile imbriquée (vendor/courier) peut ignorer replace : repli doux.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    setTimeout(() => {
      const path = window.location.pathname.replace(/\/$/, '');
      if (path.includes('/auth')) {
        window.location.replace('/');
      }
    }, 150);
  }
}
