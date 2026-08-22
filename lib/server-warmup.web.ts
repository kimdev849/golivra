import { getApiOrigin } from '@/lib/config';

/**
 * Warm-up du serveur API — version web.
 *
 * Le backend Render (plan gratuit) s'endort après ~15 min sans requête : le
 * premier appel suivant met 30-60 s à répondre (cold start). Sur web, AppState
 * (React Native) n'est pas disponible → on utilise document.visibilitychange
 * pour détecter quand l'onglet redevient actif.
 */
const HEALTH_PATH = '/health';
const WARMUP_INTERVAL_MS = 4 * 60 * 1000;
const PING_TIMEOUT_MS = 30_000;

let started = false;

async function pingServer(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      await fetch(`${getApiOrigin()}${HEALTH_PATH}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'X-Client-Source': 'web-warmup' },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Silencieux : le warmup ne doit jamais déranger l'utilisateur.
  }
}

export function startServerWarmup(): void {
  if (started) return;
  started = true;

  // Ping immédiat pour réveiller le serveur dès le chargement de la page.
  // On attend 2 s pour laisser le splash/le premier render se faire.
  setTimeout(() => void pingServer(), 2_000);

  // Puis toutes les 4 min tant que l'onglet est visible.
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void pingServer();
    }
  }, WARMUP_INTERVAL_MS);

  // Aussi ping quand l'onglet redevient actif (après minimisation / autre onglet).
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void pingServer();
      }
    });
  }
}
