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
