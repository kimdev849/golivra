import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let secureStore: typeof import('expo-secure-store') | null = null;
let nativeAvailable: boolean | null = null;

const IS_WEB = Platform.OS === 'web';

async function getSecureStore() {
  if (secureStore !== null) return secureStore;
  try {
    secureStore = await import('expo-secure-store');
    await secureStore.setItemAsync('__probe__', '1');
    await secureStore.deleteItemAsync('__probe__');
    nativeAvailable = true;
  } catch {
    secureStore = null;
    nativeAvailable = false;
  }
  return secureStore;
}

/** Vrai si SecureStore (Keychain/Keystore natif) est disponible sur cette plateforme. */
export async function isSecureStoreAvailable(): Promise<boolean> {
  const ss = await getSecureStore();
  return ss !== null;
}

// ── Tier 1 : SECURESTORE pour les secrets (token de session) ──
// - Natif : SecureStore UNIQUEMENT, jamais de repli AsyncStorage.
// - Web : repli localStorage — SecureStore n'est pas disponible sur le web,
//   et localStorage est le seul stockage persistant côté client dans un
//   navigateur (origin-bound, HTTPS-only). C'est le standard pour les SPAs.
export async function secureGetItem(key: string): Promise<string | null> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      return await ss.getItemAsync(key);
    } catch {
      return null;
    }
  }
  // Web fallback : localStorage persiste au-delà de la session navigateur.
  if (IS_WEB) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

/** Retourne false si le secret n'a pas pu être persisté. */
export async function secureSetItem(key: string, value: string): Promise<boolean> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      await ss.setItemAsync(key, value);
      return true;
    } catch {
      console.warn('[secure-store] Écriture SecureStore échouée — secret non persisté.');
      return false;
    }
  }
  // Web fallback : localStorage.
  if (IS_WEB) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.warn('[secure-store] localStorage indisponible — secret non persisté.');
      return false;
    }
  }
  console.warn('[secure-store] SecureStore indisponible — secret non persisté (reconnexion requise au prochain lancement).');
  return false;
}

export async function secureDeleteItem(key: string): Promise<void> {
  const ss = await getSecureStore();
  if (ss) {
    try {
      await ss.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
    return;
  }
  // Web fallback : localStorage.
  if (IS_WEB) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

// ── Tier 2 : SecureStore d'abord, repli AsyncStorage (données NON sensibles) ─
// Préférences (onboarding, taille de texte), caches, panier local : un vol de
// ces données n'équivaut pas à une prise de contrôle du compte.
export async function safeGetItem(key: string): Promise<string | null> {
  const ss = await getSecureStore();
  if (ss) return ss.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

export async function safeSetItem(key: string, value: string): Promise<void> {
  const ss = await getSecureStore();
  if (ss) {
    await ss.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

export async function safeDeleteItem(key: string): Promise<void> {
  const ss = await getSecureStore();
  if (ss) {
    await ss.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}
