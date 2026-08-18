import { normalizeStatutKey } from '@/lib/ux-copy';

/** Statuts terminaux — plus de polling ni widget actif. */
export const TERMINAL_ORDER_STATUSES = new Set([
  'livree',
  'partiellement_livree',
  'annulee',
  'refusee',
  'remboursee',
]);

export function isActiveOrderStatus(statut: string | null | undefined): boolean {
  if (!statut?.trim()) return false;
  return !TERMINAL_ORDER_STATUSES.has(normalizeStatutKey(statut));
}

/** Intervalle de polling React Query selon l'avancement de la commande. */
export function orderPollingIntervalMs(statut: string | null | undefined): number | false {
  const key = normalizeStatutKey(statut);

  if (TERMINAL_ORDER_STATUSES.has(key)) return false;

  if (
    key === 'livreur_en_route_pickup' ||
    key === 'en_livraison' ||
    key === 'collectee' ||
    key === 'en_route' ||
    key === 'en_collecte'
  ) {
    return 5_000;
  }

  if (key === 'en_preparation' || key === 'prete' || key === 'acceptee' || key === 'a_preparer') {
    return 15_000;
  }

  if (key === 'en_attente_vendeur' || key === 'en_attente' || key === 'commande_creee') {
    return 30_000;
  }

  return 15_000;
}

/** Estimation affichée sur l'accueil (indicatif, pas une promesse API). */
export function orderEtaMinutes(statut: string | null | undefined): number | null {
  const key = normalizeStatutKey(statut);
  const map: Record<string, number> = {
    en_attente_vendeur: 25,
    en_attente: 25,
    commande_creee: 25,
    partiellement_acceptee: 22,
    acceptee: 20,
    a_preparer: 18,
    en_preparation: 15,
    prete: 12,
    livreur_en_route_pickup: 10,
    en_collecte: 10,
    collectee: 8,
    en_livraison: 8,
    en_route: 8,
  };
  return map[key] ?? null;
}

/** Clé normalisée pour les calculs de progression (accueil, widgets). */
export function normalizeStatusForProgress(statut: string | null | undefined): string {
  return normalizeStatutKey(statut);
}

export function compactOrderRef(id: string): string {
  const clean = id.replace(/-/g, '');
  const slice = clean.slice(0, 8).toUpperCase();
  return slice.length >= 8 ? slice : id.slice(0, 12);
}
