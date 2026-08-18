import { safeGetItem, safeSetItem } from '@/lib/safe-store';
import type { Href } from 'expo-router';

import { getSessionToken, hydrateSessionToken } from '@/lib/auth';
import { hydrateCart } from '@/lib/cart-local';
import { prefetchClientCatalog } from '@/lib/client-data';
import { hydratePersistentCache } from '@/lib/request-cache';
import { homeHrefForRole } from '@/lib/roles';
import { hydrateSessionSnapshot } from '@/lib/session-store';
import { hydrateTextScale } from '@/contexts/text-scale-context';

const ONBOARDING_SEEN_KEY = 'golivra_onboarding_v2';

export type BootstrapTarget =
  | { kind: 'onboarding' }
  | { kind: 'auth' }
  | { kind: 'home'; href: Href };

// ── Signal « bootstrap terminé » ────────────────────────────────────────────
// Le splash JS reste affiché tant que le bootstrap n'a pas rendu son verdict :
// ainsi, plus jamais d'écran intermédiaire (blanc/noir) ni de transition
// visible entre le splash et l'app. Résolue une seule fois au démarrage.
let resolveBootstrapSettled: (() => void) | null = null;

export const bootstrapSettled: Promise<void> = new Promise((resolve) => {
  resolveBootstrapSettled = resolve;
});

/** À appeler quand le bootstrap a choisi sa route (ou le landing). Idempotent. */
export function signalBootstrapSettled(): void {
  resolveBootstrapSettled?.();
  resolveBootstrapSettled = null;
}

/** Prépare cache local + session sans appel réseau bloquant. */
export async function warmAppCaches(): Promise<void> {
  await Promise.all([
    hydratePersistentCache(),
    hydrateSessionToken(),
    hydrateSessionSnapshot(),
    hydrateCart(),
    // Réglages utilisateur (ex. taille du texte) : chargés avant le 1er rendu
    // pour qu'ils s'appliquent immédiatement, sans retour à la valeur par défaut.
    hydrateTextScale(),
  ]);
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

  // Landing (image + slogan + bouton Connexion) : UNIQUEMENT à la toute
  // première ouverture, quand aucun compte n'est connecté. Le flag est posé
  // quand l'utilisateur appuie sur « Connexion » (markOnboardingComplete) —
  // jamais automatiquement. Ensuite : connexion directe si déconnecté, accueil
  // si une session est active.
  if (!token && !(await isOnboardingComplete())) {
    return { kind: 'onboarding' };
  }

  if (token) {
    prefetchClientCatalog();
    return { kind: 'home', href: homeHrefForRole(snapshot?.role) };
  }

  return { kind: 'auth' };
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
