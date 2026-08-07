/**
 * Stubs web — évite d'importer expo-notifications (push token listener, SSR, mémoire).
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function markNotificationHandled(_id: string | null | undefined): Promise<void> {
  /* no-op web */
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  return 'denied';
}

export async function getExpoPushToken(): Promise<string | null> {
  return null;
}

export async function initializeNotifications(): Promise<NotificationPermissionStatus> {
  return 'denied';
}

export async function ensurePushTokenRegistered(): Promise<void> {
  /* no-op web : pas de push natif sur le web */
}

export function handleNotificationNavigation(_data: Record<string, unknown> | null | undefined): void {
  /* no-op web */
}

export function setupNotificationListeners(
  _onReceived?: unknown,
  _onResponse?: unknown,
): () => void {
  return () => undefined;
}

export async function handleInitialNotification(): Promise<void> {
  /* no-op web */
}

export async function cancelAllNotifications(): Promise<void> {
  /* no-op web */
}

export async function sendLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  /* no-op web */
}
