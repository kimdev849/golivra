import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = { data: T; at: number };

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DISK_CACHE_KEY = 'golivra_persistent_cache_v1';
let diskHydrated = false;
let diskWriteTimer: ReturnType<typeof setTimeout> | null = null;

/** Taille max du cache mémoire (en nombre d'entrées). Au-delà, les plus anciennes sont évincées. */
const MAX_CACHE_ENTRIES = 200;

function evictIfNeeded(): void {
  if (store.size <= MAX_CACHE_ENTRIES) return;
  // Trier par date et supprimer les plus anciennes
  const entries = Array.from(store.entries()).sort((a, b) => a[1].at - b[1].at);
  const toRemove = entries.slice(0, store.size - MAX_CACHE_ENTRIES);
  for (const [key] of toRemove) {
    store.delete(key);
  }
}

function shouldPersistToDisk(key: string): boolean {
  return (
    key.startsWith('enterprises:') ||
    key.startsWith('enterprise:') ||
    key.startsWith('products:') ||
    key.startsWith('product:') ||
    key.startsWith('categories:') ||
    key.startsWith('feed:') ||
    key.startsWith('auth:me:') ||
    key.startsWith('orders:')
  );
}

function scheduleDiskFlush(): void {
  if (diskWriteTimer) clearTimeout(diskWriteTimer);
  diskWriteTimer = setTimeout(() => {
    diskWriteTimer = null;
    void flushDiskCache();
  }, 400);
}

async function flushDiskCache(): Promise<void> {
  try {
    const payload: Record<string, CacheEntry<unknown>> = {};
    for (const [key, entry] of store.entries()) {
      if (shouldPersistToDisk(key)) payload[key] = entry;
    }
    await AsyncStorage.setItem(DISK_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / IO */
  }
}

/** Restaure le cache mémoire depuis le disque (appel au démarrage). */
export async function hydratePersistentCache(): Promise<void> {
  if (diskHydrated) return;
  diskHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(DISK_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry<unknown>>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry?.data !== undefined) store.set(key, { data: entry.data, at: entry.at ?? Date.now() });
    }
  } catch {
    /* ignore */
  }
}

export function peekCached<T>(key: string, ttlMs?: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (ttlMs != null && ttlMs !== Number.POSITIVE_INFINITY && Date.now() - hit.at >= ttlMs) {
    return null;
  }
  return hit.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
  evictIfNeeded();
  if (shouldPersistToDisk(key)) scheduleDiskFlush();
}

export function invalidateCached(prefix?: string): void {
  if (!prefix) {
    store.clear();
    inflight.clear();
    void AsyncStorage.removeItem(DISK_CACHE_KEY).catch(() => undefined);
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
  scheduleDiskFlush();
}

/** GET avec cache mémoire + disque, déduplication, TTL et repli hors ligne. */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 90_000,
  force = false
): Promise<T> {
  if (!force) {
    const hit = peekCached<T>(key, ttlMs);
    if (hit != null) return hit;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const promise = fetcher()
    .then((data) => {
      setCached(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      const stale = peekCached<T>(key, Number.POSITIVE_INFINITY);
      if (stale != null) return stale;
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}
