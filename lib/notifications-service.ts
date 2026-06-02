/**
 * Service de notifications push GoLivra.
 *
 * Gère :
 *  - La demande de permission (iOS + Android 13+)
 *  - La récupération et l'enregistrement du token Expo Push
 *  - L'écoute des notifications reçues (foreground) et des taps (background / killed)
 *  - La navigation après tap
 *
 * Usage :
 *   import { initializeNotifications, setupNotificationListeners } from '@/lib/notifications-service';
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { loadExpoNotifications } from '@/lib/expo-notifications-module';
import { registerPushToken } from '@/lib/push-token-api';
import { hrefCourierMission } from '@/lib/courier-nav';
import { VENDOR_HREF } from '@/lib/vendor-nav';

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Demande la permission pour les notifications (iOS + Android 13+).
 * Vérifie d'abord le statut existant pour ne pas afficher le dialog inutilement.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return 'denied';

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return 'granted';

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
      },
    });

    return status as NotificationPermissionStatus;
  } catch (err) {
    console.warn('[notifications] requestPermission error:', err);
    return 'denied';
  }
}

// ─── Token ────────────────────────────────────────────────────────────────────

/**
 * Récupère le token Expo Push pour cet appareil.
 * Ne fonctionne que sur un appareil physique (pas sur émulateur).
 *
 * @returns ExponentPushToken[xxx] ou null si indisponible
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return null;

  try {
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

    if (!projectId) {
      console.warn('[notifications] projectId EAS introuvable — token impossible sans build EAS ou Expo Go connecté.');
    }

    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch (err) {
    console.warn('[notifications] getExpoPushToken error (normal sur simulateur):', err);
    return null;
  }
}

// ─── Android channel ──────────────────────────────────────────────────────────

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync('golivra-default', {
    name: 'GoLivra',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0E86D4',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Initialise complètement le système de notifications push.
 */
export async function initializeNotifications(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') return 'denied';

  await ensureAndroidChannel();

  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    console.log('[notifications] Permission refusée:', permission);
    return permission;
  }

  console.log('[notifications] ✅ Permission accordée');

  const token = await getExpoPushToken();

  if (!token) {
    console.log('[notifications] ⚠️ Pas de token (simulateur, Expo Go Android ou erreur réseau)');
    return permission;
  }

  console.log('[notifications] 📱 Token obtenu:', token);

  void (async () => {
    try {
      await registerPushToken(token, Platform.OS as 'ios' | 'android' | 'web');
      console.log('[notifications] ✅ Token enregistré dans le backend');
    } catch (err) {
      console.warn('[notifications] ❌ Erreur enregistrement token:', err);
    }
  })();

  return permission;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

type NotifData = Record<string, unknown> | null | undefined;

function getAction(data: NotifData): string | null {
  if (!data || typeof data !== 'object') return null;
  const a = (data as { action?: unknown }).action;
  return typeof a === 'string' ? a : null;
}

function getLivraisonId(data: NotifData): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as { livraison_id?: unknown }).livraison_id;
  return typeof id === 'string' ? id : null;
}

export function handleNotificationNavigation(data: NotifData): void {
  const action = getAction(data);

  if (action === 'open_delivery') {
    const livId = getLivraisonId(data);
    if (livId) {
      router.push(hrefCourierMission(livId));
      return;
    }
    router.push('/courier/missions');
    return;
  }

  if (action === 'courier_missions') {
    router.push('/courier/missions');
    return;
  }

  if (action === 'vendor_orders') {
    router.push(VENDOR_HREF.ordersTab);
    return;
  }

  if (action === 'open_orders') {
    router.push('/(tabs)/explore');
    return;
  }

  router.push('/notifications');
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function setupNotificationListeners(
  onReceived?: (notification: import('expo-notifications').Notification) => void,
  onResponse?: (response: import('expo-notifications').NotificationResponse) => void,
): () => void {
  if (Platform.OS === 'web') return () => undefined;

  let cancelled = false;
  let cleanup: (() => void) | undefined;

  void loadExpoNotifications().then((Notifications) => {
    if (!Notifications || cancelled) return;

    const subReceived = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[notifications] 🔔 Reçue:', notification.request.content.title);
      onReceived?.(notification);
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[notifications] 👆 Tappée:', response.notification.request.content.title);
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data as NotifData);
      onResponse?.(response);
    });

    cleanup = () => {
      subReceived.remove();
      subResponse.remove();
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export async function handleInitialNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      console.log('[notifications] 🚀 App ouverte depuis une notification');
      const data = response.notification.request.content.data;
      setTimeout(() => {
        handleNotificationNavigation(data as NotifData);
      }, 500);
    }
  } catch (err) {
    console.warn('[notifications] handleInitialNotification error:', err);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] cancelAll error:', err);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}
