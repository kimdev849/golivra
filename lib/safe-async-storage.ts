/**
 * Safe AsyncStorage wrapper for web.
 * On native (iOS/Android), it uses the real AsyncStorage.
 * On web, it wraps every call in try/catch and falls back to in-memory
 * storage when localStorage is blocked (incognito, iframes, etc.).
 */
import { Platform } from 'react-native';

let memoryStore: Record<string, string> = {};

function isWebBlocked(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    const test = '__async_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return false;
  } catch {
    return true;
  }
}

const blocked = isWebBlocked();

// Lazy import to avoid crash on web when localStorage is blocked
let realAsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;

async function getReal(): Promise<typeof import('@react-native-async-storage/async-storage').default> {
  if (realAsyncStorage) return realAsyncStorage;
  const mod = await import('@react-native-async-storage/async-storage');
  realAsyncStorage = mod.default;
  return realAsyncStorage;
}

export const SafeAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (blocked) return memoryStore[key] ?? null;
    try {
      const store = await getReal();
      return await store.getItem(key);
    } catch {
      return memoryStore[key] ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (blocked) { memoryStore[key] = value; return; }
    try {
      const store = await getReal();
      await store.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    if (blocked) { delete memoryStore[key]; return; }
    try {
      const store = await getReal();
      await store.removeItem(key);
    } catch {
      delete memoryStore[key];
    }
  },

  async clear(): Promise<void> {
    if (blocked) { memoryStore = {}; return; }
    try {
      const store = await getReal();
      await store.clear();
    } catch {
      memoryStore = {};
    }
  },
};
