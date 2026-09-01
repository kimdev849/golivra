import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { logoutLocal } from '@/lib/auth';
import { saveCart } from '@/lib/cart-local';
import { navigateToAuthAfterLogout } from '@/lib/app-navigation';

type Options = {
  /** Vide aussi le panier local (client). */
  clearCart?: boolean;
};

function hapticLight(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function hapticSuccess(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function confirmLogoutDialog(onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm('Voulez-vous vraiment vous déconnecter ?')) {
      onConfirm();
    }
    return;
  }

  Alert.alert(
    'Déconnexion',
    'Voulez-vous vraiment vous déconnecter ?',
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: onConfirm },
    ],
    { cancelable: true },
  );
}

export function useLogout(options: Options = { clearCart: true }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const busyRef = useRef(false);

  const performLogout = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoggingOut(true);
    try {
      hapticSuccess();

      // IMPORTANT: clear auth state BEFORE navigation to prevent race condition
      // where the profile tab re-focuses and still sees the old token.
      try {
        await logoutLocal();
      } catch {
        // Non bloquant
      }
      if (options.clearCart !== false) {
        try {
          await saveCart(null);
        } catch {
          // Non bloquant
        }
      }

      navigateToAuthAfterLogout();

      try {
        const { loadExpoNotifications } = await import('@/lib/expo-notifications-module');
        const Notifications = await loadExpoNotifications();
        if (Notifications) await Notifications.setBadgeCountAsync(0);
      } catch { /* ignore */ }

      // Fire-and-forget: unregister push token (non-blocking)
      void (async () => {
        try {
          const { getExpoPushToken } = await import('@/lib/notifications-service');
          const { unregisterPushToken } = await import('@/lib/push-token-api');
          const token = await getExpoPushToken();
          if (token) await unregisterPushToken(token);
        } catch {
          // Non bloquant
        }
      })();
    } catch {
      hapticLight();
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.alert('Impossible de se déconnecter. Réessayez.');
        }
      } else {
        Alert.alert('Déconnexion', 'Impossible de se déconnecter. Réessayez.');
      }
    } finally {
      busyRef.current = false;
      setLoggingOut(false);
    }
  }, [options.clearCart]);

  const confirmLogout = useCallback(() => {
    hapticLight();
    confirmLogoutDialog(() => {
      void performLogout();
    });
  }, [performLogout]);

  return { confirmLogout, performLogout, loggingOut };
}
