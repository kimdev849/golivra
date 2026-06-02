import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isExpoGoAndroidPushUnavailable, loadExpoNotifications } from '@/lib/expo-notifications-module';
import { getSessionToken } from '@/lib/auth';
import { fetchUnreadCount } from '@/lib/notifications-api';

async function syncAppBadge(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;
  try {
    if (count > 0) {
      await Notifications.setBadgeCountAsync(count);
    } else {
      await Notifications.setBadgeCountAsync(0);
    }
  } catch {
    // ignore
  }
}

/**
 * Compteur de notifications non lues.
 *
 * - Rafraîchi à chaque focus écran
 * - Rafraîchi automatiquement toutes les 45 secondes
 * - Rafraîchi instantanément quand une notification push est reçue en foreground
 * - Synchronise le badge de l'icône de l'app (iOS + Android)
 */
export function useUnreadNotifications() {
  const [count, setCount] = useState(0);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setCount(0);
        void syncAppBadge(0);
        return;
      }
      const n = await fetchUnreadCount(token);
      setCount(n);
      void syncAppBadge(n);
    } catch {
      setCount(0);
      void syncAppBadge(0);
    }
  }, []);

  useEffect(() => {
    if (isExpoGoAndroidPushUnavailable()) return;

    let alive = true;
    void loadExpoNotifications().then((Notifications) => {
      if (!Notifications || !alive) return;
      listenerRef.current = Notifications.addNotificationReceivedListener(() => {
        void refresh();
      });
    });

    return () => {
      alive = false;
      listenerRef.current?.remove();
      listenerRef.current = null;
    };
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const id = setInterval(() => void refresh(), 45000);
      return () => clearInterval(id);
    }, [refresh]),
  );

  return { unreadCount: count, refreshUnread: refresh };
}
