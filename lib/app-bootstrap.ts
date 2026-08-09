import { safeGetItem, safeSetItem } from '@/lib/safe-store';
import type { Href } from 'expo-router';

import { getSessionToken, hydrateSessionToken } from '@/lib/auth';
import { hydrateCart } from '@/lib/cart-local';
import { prefetchClientCatalog } from '@/lib/client-data';
import { hydratePersistentCache } from '@/lib/request-cache';
import { homeHrefForRole } from '@/lib/roles';
import { hydrateSessionSnapshot } from '@/lib/session-store';

const ONBOARDING_SEEN_KEY = 'golivra_onboarding_v2';

export type BootstrapTarget =
  | { kind: 'onboarding' }
  | { kind: 'auth' }
  | { kind: 'home'; href: Href };

/** Prépare cache local + session sans appel réseau bloquant. */
export async function warmAppCaches(): Promise<void> {
  await Promise.all([hydratePersistentCache(), hydrateSessionToken(), hydrateSessionSnapshot(), hydrateCart()]);
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    return (await safeGetItem(ONBOARDING_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  await safeSetItem(ONBOARDING_SEEN_KEY, '1');
}

export async function resolveBootstrapTarget(): Promise<BootstrapTarget> {
  await warmAppCaches();

  const token = await getSessionToken();
  const snapshot = await hydrateSessionSnapshot();

  if (token) {
    prefetchClientCatalog();
    return { kind: 'home', href: homeHrefForRole(snapshot?.role) };
  }

  // Pas de session : on affiche TOUJOURS l'écran d'accueil (image + slogan).
  // L'ancien drapeau one-shot faisait sauter ce landing dès que l'app avait
  // déjà été ouverte une fois (même sur un téléphone d'essai), et l'utilisateur
  // tombait directement sur la connexion sans jamais voir l'image ni le slogan.
  return { kind: 'onboarding' };
}

export function isAuthErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('session') ||
    m.includes('401') ||
    m.includes('jeton') ||
    m.includes('token') ||
    m.includes('unauthorized') ||
    m.includes('révoquée') ||
    m.includes('revoquee')
  );
}
