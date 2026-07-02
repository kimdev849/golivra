import { safeGetItem, safeSetItem, safeDeleteItem } from '@/lib/safe-store';

import { apiFetch } from '@/lib/api';
import { clearSessionSnapshot, saveSessionSnapshot } from '@/lib/session-store';

const TOKEN_KEY = 'golivra_session_token';

let memoryToken: string | null = null;
let tokenHydrated = false;

export type AuthUser = {
  id: string;
  nom: string;
  telephone: string;
  imageUrl?: string | null;
  /** L’API peut renvoyer un nombre (JSON) ; on accepte les deux. */
  roleId: string | number;
  /** Nom du rôle PostgreSQL (ex. client, restaurateur, commercant). */
  role?: string | null;
};

export type AuthSession = {
  token: string;
  expireLe: string;
  user: AuthUser;
};

export function getSessionTokenSync(): string | null {
  return memoryToken;
}

export async function hydrateSessionToken(): Promise<string | null> {
  if (tokenHydrated) return memoryToken;
  try {
    memoryToken = await safeGetItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  tokenHydrated = true;
  return memoryToken;
}

export async function getSessionToken(): Promise<string | null> {
  if (tokenHydrated) return memoryToken;
  return hydrateSessionToken();
}

export async function setSessionToken(token: string): Promise<void> {
  memoryToken = token;
  tokenHydrated = true;
  await safeSetItem(TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  memoryToken = null;
  tokenHydrated = true;
  try {
    await safeDeleteItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Après login / inscription : token + snapshot pour démarrage instantané. */
export async function persistAuthSession(session: AuthSession): Promise<void> {
  await setSessionToken(session.token);
  await saveSessionSnapshot(session);
}

export async function registerAccount(payload: {
  nom: string;
  telephone: string;
  motDePasse: string;
  otpCode: string;
  role: 'client' | 'restaurateur' | 'commercant';
  imageUrl?: string | null;
  pays_id?: string | null;
  ville_id?: string | null;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>('/api/auth/register', {
    method: 'POST',
    jsonBody: payload,
  });
}

export type RegisterVendorPayload = {
  nom: string;
  telephone: string;
  motDePasse: string;
  otpCode: string;
  role: 'restaurateur' | 'commercant';
  imageUrl?: string | null;
  pays_id?: string | null;
  ville_id?: string | null;
  enterprise: {
    type: 'restaurant' | 'boutique';
    nom: string;
    telephone: string;
    categorieId: string;
    description?: string | null;
    /** Requise pour restaurant, OPTIONNELLE pour boutique. */
    adresse?: string;
    imageUrl?: string | null;
    /** Secours si l'upload Storage échoue (BYTEA côté API). */
    imageDataUrl?: string | null;
  };
};

export type RegisterVendorResult = AuthSession & {
  enterprise: Record<string, unknown>;
};

/**
 * Inscription ATOMIQUE d'un vendeur : crée l'utilisateur ET son commerce
 * (restaurant ou boutique) en une seule requête HTTP. En cas d'échec d'un
 * des deux côtés, le backend ROLLBACK l'autre → l'utilisateur n'est JAMAIS
 * créé si son commerce ne peut pas l'être (et inversement).
 */
export async function registerVendorAccount(payload: RegisterVendorPayload): Promise<RegisterVendorResult> {
  return apiFetch<RegisterVendorResult>('/api/auth/register-vendor', {
    method: 'POST',
    jsonBody: payload,
  });
}

export async function loginAccount(payload: {
  telephone: string;
  motDePasse: string;
}): Promise<AuthSession> {
  return apiFetch<AuthSession>('/api/auth/login', {
    method: 'POST',
    jsonBody: payload,
  });
}

export async function logoutRemote(token: string): Promise<void> {
  await apiFetch('/api/auth/logout', {
    method: 'POST',
    token,
    jsonBody: {},
  });
}

export async function deleteAccountRemote(payload: {
  token: string;
  password: string;
  reason?: string | null;
}): Promise<{ message: string; supprime_at: string }> {
  return apiFetch<{ message: string; supprime_at: string }>('/api/auth/delete-account', {
    method: 'POST',
    token: payload.token,
    jsonBody: {
      password: payload.password,
      reason: payload.reason ?? null,
    },
  });
}

export async function resetPassword(payload: {
  telephone: string;
  otpCode: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    jsonBody: payload,
  });
}

export async function logoutLocal(): Promise<void> {
  const token = await getSessionToken();
  try {
    const { clearClientDataCache } = await import('@/lib/client-data');
    clearClientDataCache();
  } catch {
    /* ignore */
  }
  await clearSessionSnapshot();
  if (token) {
    void logoutRemote(token).catch(() => {
      /* réseau lent ou hors ligne : on déconnecte quand même localement */
    });
  }
  await clearSessionToken();
}
