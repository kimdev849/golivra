import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** SDK 53+ : push distantes Android indisponibles dans Expo Go (import = erreur au boot). */
export function isExpoGoAndroidPushUnavailable(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

type ExpoNotifications = typeof import('expo-notifications');

let loadPromise: Promise<ExpoNotifications | null> | undefined;
let handlerInstalled = false;

export function loadExpoNotifications(): Promise<ExpoNotifications | null> {
  if (Platform.OS === 'web' || isExpoGoAndroidPushUnavailable()) {
    return Promise.resolve(null);
  }
  if (!loadPromise) {
    loadPromise = import('expo-notifications')
      .then((Notifications) => {
        if (!handlerInstalled) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          handlerInstalled = true;
        }
        return Notifications;
      })
      .catch(() => null);
  }
  return loadPromise;
}
