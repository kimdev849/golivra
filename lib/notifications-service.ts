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
import { safeGetItem, safeSetItem } from '@/lib/safe-store';

/**
 * Stocke l'identifiant de la dernière notification "initiale" déjà traitée.
 *
 * Sans cette garde, getLastNotificationResponseAsync() renvoie en boucle la
 * dernière notification tapée (même il y a des jours), ce qui fait atterrir
 * l'utilisateur sur /notifications à CHAQUE lancement de l'app — y compris
 * au 1er lancement ou quand il est déjà connecté. On ne navigue donc que si
 * l'ID de la notification courante diffère de celui déjà traité.
 */
const LAST_HANDLED_NOTIF_KEY = 'golivra_last_handled_notif_id';

/** Mémorise que la demande de permission a déjà été affichée (1 fois max). */
const NOTIF_PERMISSION_ASKED_KEY = 'golivra_notif_permission_asked_v1';

/**
 * Anti-course : au 1er lancement, initializeNotifications() (boot) et
 * resyncNotificationsOnForeground() (AppState → 'active' immédiat) peuvent
 * appeler requestPermissionsAsync en même temps. Android peut afficher deux
 * dialogues et iOS renvoie 'denied' si un second appel arrive pendant qu'un
 * premier est en vol. On sérilise : le 2e appelant reçoit la promesse du 1er.
 */
let permissionRequestInFlight: Promise<NotificationPermissionStatus> | null = null;

export async function markNotificationHandled(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await safeSetItem(LAST_HANDLED_NOTIF_KEY, id);
  } catch {
    /* ignore */
  }
}

async function isNotificationAlreadyHandled(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  try {
    return (await safeGetItem(LAST_HANDLED_NOTIF_KEY)) === id;
  } catch {
    return false;
  }
}

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

    // Le dialogue de permission n'est affiché QU'UNE SEULE FOIS par
    // installation : un refus ou un « undetermined » répété ne relance jamais
    // la demande (sauf effacement des données / réinstallation de l'app).
    const alreadyAsked = (await safeGetItem(NOTIF_PERMISSION_ASKED_KEY)) === '1';
    if (alreadyAsked) return existing as NotificationPermissionStatus;

    // Anti-course (voir plus haut) : si une demande est déjà en vol, on attend
    // son résultat au lieu d'en lancer une seconde (double dialogue Android /
    // échec iOS).
    if (permissionRequestInFlight) {
      return permissionRequestInFlight;
    }

    permissionRequestInFlight = (async () => {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
        },
      });

      // On ne grave le flag « déjà demandé » QUE si l'utilisateur a réellement
      // répondu (accordé ou refusé). Si le dialogue a été ignoré (statut
      // `undetermined`), on pourra redemander au prochain lancement — sinon une
      // seule hésitation condamnait l'app à ne JAMAIS recevoir de push.
      if (status !== 'undetermined') {
        await safeSetItem(NOTIF_PERMISSION_ASKED_KEY, '1');
      }
      return status as NotificationPermissionStatus;
    })();

    try {
      return await permissionRequestInFlight;
    } finally {
      permissionRequestInFlight = null;
    }
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

/**
 * Resynchronise les notifications au retour au premier plan : recrée le canal
 * Android s'il a été purgé par le système (certains fabricants le font en mode
 * économie) et (ré)enregistre le token si la permission a été accordée
 * entre-temps. Silencieux et non bloquant.
 */
export async function resyncNotificationsOnForeground(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ensureAndroidChannel();
    await ensurePushTokenRegistered();
  } catch (err) {
    console.warn('[notifications] resyncOnForeground error:', err);
  }
}

/** Anti-doublon : évite de relancer une inscription push en rafale. */
let lastTokenRegistrationAt = 0;

/**
 * Ré-enregistre le token push de l'appareil après une connexion / inscription.
 *
 * Nécessaire car : l'initialisation complète n'a lieu qu'au démarrage de l'app,
 * et le logout DÉSENREGISTRE le token. Sans cet appel, un utilisateur qui se
 * connecte (ou se reconnecte) après le démarrage ne recevrait plus aucun push
 * (clients comme vendeurs).
 *
 * Silencieux et non bloquant : ne redemande PAS la permission (elle a été
 * demandée au premier lancement) et ne fait rien si elle est refusée.
 * Anti-doublon : pas plus d'une inscription toutes les 15 s (les écrans
 * vendeurs appellent cette fonction à chaque focus).
 */
export async function ensurePushTokenRegistered(): Promise<void> {
  if (Platform.OS === 'web') return;

  const now = Date.now();
  if (now - lastTokenRegistrationAt < 15_000) return;
  lastTokenRegistrationAt = now;

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  try {
    const { status } = await Notifications.getPermissionsAsync();

    // Permission jamais tranchée (dialogue ignoré au 1er lancement) : on la
    // redemande ici. Sans cela, le token n'était jamais enregistré → aucun push
    // quand l'app est fermée. Si refus définitif, on n'insiste pas.
    if (status === 'undetermined') {
      const asked = await requestNotificationPermission();
      if (asked !== 'granted') return;
    } else if (status !== 'granted') {
      return;
    }

    const token = await getExpoPushToken();
    if (!token) return;

    await registerPushToken(token, Platform.OS as 'ios' | 'android' | 'web');
    console.log('[notifications] ✅ Token (ré)enregistré après connexion');
  } catch (err) {
    console.warn('[notifications] ensurePushTokenRegistered error:', err);
  }
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
    router.navigate('/(tabs)/explore');
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
      const notifId = response.notification.request.identifier;

      // 🛑 Garde anti-redirection (retour au premier plan) : sur Android, l'OS
      // peut RE-DÉLIVRER une réponse de notification déjà traitée quand l'app
      // revient au premier plan — sans AUCUN tap de l'utilisateur. Sans cette
      // garde, l'app redirigeait vers /notifications quelques instants après le
      // retour, alors qu'on devait rester sur l'écran en cours (Profil, marché…).
      // On ne navigue que si cette notification n'a JAMAIS été traitée
      // (ni au boot, ni par un tap précédent).
      void (async () => {
        if (await isNotificationAlreadyHandled(notifId)) {
          return;
        }
        console.log('[notifications] 👆 Tappée:', response.notification.request.content.title);
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data as NotifData);
        // Marquer APRÈS le tap : évite que getLastNotificationResponseAsync()
        // ne la renvoie au prochain lancement (redirection intempestive).
        void markNotificationHandled(notifId);
        onResponse?.(response);
      })();
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

  try {
    // 🛑 Garde 1 : hors connexion (1er lancement, jamais connecté), on ne
    // redirige JAMAIS automatiquement. L'utilisateur doit rester sur
    // l'accueil / la connexion — pas sur /notifications.
    const { getSessionToken } = await import('@/lib/auth');
    const sessionToken = await getSessionToken();
    if (!sessionToken) return;

    const Notifications = await loadExpoNotifications();
    if (!Notifications) return;

    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;

    // Identifiant stable de la notification : l'identifiant de requête côté Expo.
    const notifId = response.notification.request.identifier;

    // 🛑 Garde 2 : sans identifiant stable, impossible de dédupliquer — on ne
    // navigue jamais automatiquement (sinon boucle /notifications à chaque
    // lancement, le garde en dessous ne pouvant rien mémoriser).
    if (!notifId) return;

    // ⚠️ getLastNotificationResponseAsync() renvoie la DERNIÈRE notification
    // tapée, même si elle l'a été lors d'un lancement précédent (l'OS ne la
    // nettoie pas). Sans cette garde, l'utilisateur serait renvoyé sur
    // /notifications à chaque ouverture de l'app.
    if (await isNotificationAlreadyHandled(notifId)) {
      return;
    }

    const data = response.notification.request.content.data as NotifData;
    const action = getAction(data);

    // 🛑 Garde 3 : seules les actions de deep-link EXPLICITES déclenchent
    // une navigation automatique au lancement. Un tap générique sur une
    // notification (sans action connue) ne renvoie JAMAIS vers /notifications
    // automatiquement : l'utilisateur y accède via l'icône de notification
    // dans l'app. Cette garde corrige le bug où l'utilisateur atterrissait
    // sur /notifications à chaque ouverture de l'app.
    const isKnownAction =
      action === 'open_delivery' ||
      action === 'courier_missions' ||
      action === 'vendor_orders' ||
      action === 'open_orders';

    if (!isKnownAction) {
      await markNotificationHandled(notifId);
      return;
    }

    await markNotificationHandled(notifId);
    console.log('[notifications] 🚀 App ouverte depuis une notification');
    setTimeout(() => {
      handleNotificationNavigation(data);
    }, 500);
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

// ─── Web (Notification API navigateur) ──────────────────────────────────────
// No-ops sur natif : le natif utilise les push Expo (FCM/APNs). Les vraies
// implémentations web sont dans notifications-service.web.ts (utilisées
// automatiquement par Metro sur la plateforme web).

export function showWebNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>,
): void {
  /* no-op natif */
}

export function playWebNotificationSound(): void {
  /* no-op natif */
}
