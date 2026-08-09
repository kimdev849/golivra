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
  // Bêta fermée : si l'admin a activé beta_mode et que ce téléphone n'est pas
  // autorisé, on refuse l'accès (le message remonte à l'écran de connexion).
  try {
    const { isPhoneAllowedInBeta } = await import('@/lib/app-status');
    const allowed = await isPhoneAllowedInBeta(session.user.telephone);
    if (!allowed) {
      await logoutLocal();
      throw new Error(
        "Accès restreint : GoLivra est en test privé. Votre numéro n'est pas encore autorisé."
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Accès restreint')) throw error;
    /* hors-ligne : on laisse passer, le filet n'est pas un bloqueur */
  }
  // Push notifications : le token est DÉSENREGISTRÉ au logout et l'init complète
  // n'a lieu qu'au démarrage de l'app. On le (ré)enregistre donc après chaque
  // connexion/inscription pour garantir la réception (fire-and-forget).
  // Import dynamique pour éviter une dépendance circulaire (auth → notifications → auth).
  void import('@/lib/notifications-service')
    .then((m) => m.ensurePushTokenRegistered?.())
    .catch(() => undefined);
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
    // Vide le panier SERVEUR de l'ancien compte (le token est capturé, donc
    // l'appel reste valide même après clearSessionToken) : sinon le panier
    // revenait à la reconnexion (persistance après déconnexion).
    void (async () => {
      try {
        const { clearRemoteCart } = await import('@/lib/cart-api');
        await clearRemoteCart(token);
      } catch {
        /* ignore */
      }
    })();
    void logoutRemote(token).catch(() => {
      /* réseau lent ou hors ligne : on déconnecte quand même localement */
    });
  }
  // Vide aussi le panier local (mémoire + stockage).
  try {
    const { clearCart } = await import('@/lib/cart-local');
    await clearCart();
  } catch {
    /* ignore */
  }
  await clearSessionToken();
}
