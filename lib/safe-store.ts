import AsyncStorage from '@react-native-async-storage/async-storage';

let secureStore: typeof import('expo-secure-store') | null = null;
let nativeAvailable: boolean | null = null;

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

// ── Tier 1 : SECURESTORE UNIQUEMENT (pour les secrets — token de session) ──
// Pas de repli vers AsyncStorage : si SecureStore est indisponible (web, cas
// rare), le secret n'est PAS persisté → reconnexion nécessaire au prochain
// lancement. C'est un choix volontaire : jamais de secret en clair dans un
// stockage non sécurisé (voir docs/security/checklist.md).
export async function secureGetItem(key: string): Promise<string | null> {
  const ss = await getSecureStore();
  if (!ss) return null;
  try {
    return await ss.getItemAsync(key);
  } catch {
    return null;
  }
}

/** Retourne false si le secret n'a pas pu être persisté (SecureStore indisponible). */
export async function secureSetItem(key: string, value: string): Promise<boolean> {
  const ss = await getSecureStore();
  if (!ss) {
    console.warn('[secure-store] SecureStore indisponible — secret non persisté (reconnexion requise au prochain lancement).');
    return false;
  }
  try {
    await ss.setItemAsync(key, value);
    return true;
  } catch {
    console.warn('[secure-store] Écriture SecureStore échouée — secret non persisté.');
    return false;
  }
}

export async function secureDeleteItem(key: string): Promise<void> {
  const ss = await getSecureStore();
  if (!ss) return;
  try {
    await ss.deleteItemAsync(key);
  } catch {
    /* ignore */
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
