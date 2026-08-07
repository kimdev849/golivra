import { useEffect, useState } from 'react';

import { fetchUserAddresses } from '@/lib/addresses';
import { getSessionToken } from '@/lib/auth';
import { deliveryEstimateForQuartier, fetchPublicPricing } from '@/lib/pricing';

export type DeliveryEstimate = {
  /** Minutes de livraison estimées selon la zone (30 / 45 / 60) ou null si indéterminé. */
  minutes: number | null;
  /** « Zone proche » / « Zone moyenne » / « Zone éloignée » ou null. */
  tierLabel: string | null;
  /** Quartier de l'adresse principale utilisée pour l'estimation. */
  quartier: string | null;
  /** true tant que pricing + adresses ne sont pas encore résolus. */
  loading: boolean;
};

const EMPTY: DeliveryEstimate = { minutes: null, tierLabel: null, quartier: null, loading: false };
const LOADING: DeliveryEstimate = { minutes: null, tierLabel: null, quartier: null, loading: true };

// Cache partagé (module-level) : tous les écrans/cartes qui utilisent ce hook
// partagent UN SEUL résolve pricing + adresses, sans re-fetch à chaque montage.
// TTL 5 min : un changement d'adresse principale est répercuté au prochain
// cycle (le panier, lui, recalcule en direct depuis le quartier choisi).
let shared: Promise<DeliveryEstimate> | null = null;
let sharedAt = 0;
const SHARED_TTL = 5 * 60_000;

async function resolveEstimate(): Promise<DeliveryEstimate> {
  try {
    let pricing: Awaited<ReturnType<typeof fetchPublicPricing>> | null = null;
    try {
      pricing = await fetchPublicPricing();
    } catch {
      pricing = null;
    }
    let quartier: string | null = null;
    try {
      const token = await getSessionToken();
      if (token) {
        const rows = await fetchUserAddresses(token);
        const principal = rows.find((a) => a.est_principale) ?? rows[0];
        quartier = principal?.quartier?.trim() || null;
      }
    } catch {
      /* pas d'adresses / hors ligne */
    }

    const est = pricing ? deliveryEstimateForQuartier(quartier, pricing) : null;
    return {
      minutes: est?.minutes ?? null,
      tierLabel: est?.tierLabel ?? null,
      quartier,
      loading: false,
    };
  } catch {
    return EMPTY;
  }
}

function sharedEstimate(): Promise<DeliveryEstimate> {
  const now = Date.now();
  if (!shared || now - sharedAt >= SHARED_TTL) {
    shared = resolveEstimate();
    sharedAt = now;
  }
  return shared;
}

/**
 * Estime le temps de livraison GoLivra (géré par la plateforme) selon la zone
 * de l'adresse principale du client : proche ~30 min, moyenne ~45 min,
 * éloignée ~60 min. Retourne `minutes: null` tant que la zone n'est pas
 * déterminable (pas d'adresse enregistrée ou config zones absente).
 *
 * Le résultat est partagé entre tous les appelsants (cache module-level avec
 * TTL 5 min) : l'accueil qui affiche N cartes ne déclenche qu'un seul fetch
 * pricing+adresses par fenêtre de 5 min.
 */
export function useDeliveryEstimate(): DeliveryEstimate {
  const [estimate, setEstimate] = useState<DeliveryEstimate>(LOADING);

  useEffect(() => {
    let alive = true;
    void sharedEstimate().then((value) => {
      if (alive) setEstimate(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return estimate;
}
