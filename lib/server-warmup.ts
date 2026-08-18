import { AppState } from 'react-native';

import { getApiOrigin } from '@/lib/config';

/**
 * Warm-up du serveur API.
 *
 * Le backend Render (plan gratuit) s'endort après ~15 min sans requête : le
 * premier appel suivant met 30-60 s à répondre (cold start), ce qui dépasse le
 * timeout client (15 s) → « Connexion lente… », panier bloqué, commande
 * impossible sur l'app installée alors qu'en local le serveur était chaud.
 *
 * Ce module ping `/health` au lancement puis toutes les 4 minutes tant que
 * l'app est au premier plan : le serveur reste chaud et chaque vraie requête
 * répond vite. Le ping est silencieux (aucun toast, aucun incident report).
 */
const HEALTH_PATH = '/health';
const WARMUP_INTERVAL_MS = 4 * 60 * 1000;
const PING_TIMEOUT_MS = 10_000;

let started = false;

async function pingServer(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      await fetch(`${getApiOrigin()}${HEALTH_PATH}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'X-Client-Source': 'mobile-warmup' },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Silencieux : le warm-up ne doit jamais déranger l'utilisateur.
  }
}

/** Démarre le warm-up (idempotent). À appeler une fois au lancement de l'app. */
export function startServerWarmup(): void {
  if (started) return;
  started = true;

  // Ping immédiat (après un léger délai pour ne pas concurrencer le splash).
  setTimeout(() => void pingServer(), 1_500);

  // Puis toutes les 4 min tant que l'app est au premier plan. Le module vit
  // pour toute la durée de l'app : pas besoin de conserver ni d'arrêter l'interval.
  setInterval(() => {
    if (AppState.currentState === 'active') {
      void pingServer();
    }
  }, WARMUP_INTERVAL_MS);
}
