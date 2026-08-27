import { SafeAsyncStorage as AsyncStorage } from '@/lib/safe-async-storage';

import type { AuthSession } from '@/lib/auth';

// v2 : le token a été RETIRÉ du snapshot (il dupliquait le secret en clair dans
// AsyncStorage — il vit uniquement dans SecureStore via lib/auth.ts).
const SESSION_SNAPSHOT_KEY = 'golivra_session_snapshot_v2';
// Ancienne clé v1 : contenait le token en clair. Purge au premier démarrage.
const LEGACY_SESSION_SNAPSHOT_KEY = 'golivra_session_snapshot_v1';

export type SessionSnapshot = {
  userId: string;
  nom: string | null;
  telephone: string;
  role: string | null;
  roleId: string | number;
  savedAt: string;
};

let memorySnapshot: SessionSnapshot | null = null;
let snapshotHydrated = false;

export function getSessionSnapshotSync(): SessionSnapshot | null {
  return memorySnapshot;
}

export async function hydrateSessionSnapshot(): Promise<SessionSnapshot | null> {
  if (snapshotHydrated) return memorySnapshot;
  try {
    // Purge de l'ancien snapshot v1 qui contenait le token en clair.
    await AsyncStorage.removeItem(LEGACY_SESSION_SNAPSHOT_KEY);

    const raw = await AsyncStorage.getItem(SESSION_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
      // Si un snapshot v2 (ou futur) contient encore un champ token, on l'ignore
      // et on le purge : le token ne doit JAMAIS être persisté hors SecureStore.
      if ('token' in parsed) {
        await AsyncStorage.removeItem(SESSION_SNAPSHOT_KEY);
        memorySnapshot = null;
      } else {
        memorySnapshot = parsed as SessionSnapshot;
      }
    }
  } catch {
    memorySnapshot = null;
  }
  snapshotHydrated = true;
  return memorySnapshot;
}

export async function saveSessionSnapshot(session: AuthSession): Promise<void> {
  const snap: SessionSnapshot = {
    userId: session.user.id,
    nom: session.user.nom,
    telephone: session.user.telephone,
    role: session.user.role ?? null,
    roleId: session.user.roleId,
    savedAt: new Date().toISOString(),
  };
  memorySnapshot = snap;
  snapshotHydrated = true;
  await AsyncStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snap));
}

export async function clearSessionSnapshot(): Promise<void> {
  memorySnapshot = null;
  snapshotHydrated = true;
  try {
    await AsyncStorage.removeItem(SESSION_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
