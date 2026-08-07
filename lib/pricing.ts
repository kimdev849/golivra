import { apiFetch } from '@/lib/api';

/** Valeurs affichées si l’API tarifs n’est pas encore chargée. */
export const FALLBACK_DELIVERY_FEE_FCFA = 1000;
export const FALLBACK_MIN_ORDER_FCFA = 1000;

export type ZonesPublicConfig = {
  zones: {
    id: string;
    name: string;
    label: string;
    price_base: number;
    is_active: boolean;
    sort_order?: number;
  }[];
  arrondissements: { id: string; name: string; zone_id: string; sort_order?: number }[];
  price_by_arrondissement: Record<string, number>;
  default_price_fcfa: number;
};

export type PublicPricing = {
  frais_livraison_base_fcfa: number;
  frais_livraison_min_fcfa: number;
  frais_livraison_max_fcfa: number;
  montant_min_commande_fcfa: number;
  zones?: ZonesPublicConfig | null;
};

/** Snapshot utilisé avant chargement API ou si l’API échoue. */
export const DEFAULT_PUBLIC_PRICING: PublicPricing = {
  frais_livraison_base_fcfa: FALLBACK_DELIVERY_FEE_FCFA,
  frais_livraison_min_fcfa: FALLBACK_DELIVERY_FEE_FCFA,
  frais_livraison_max_fcfa: 2500,
  montant_min_commande_fcfa: FALLBACK_MIN_ORDER_FCFA,
};

let cached: PublicPricing | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function parseZonesPublic(raw: unknown): ZonesPublicConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const zonesRaw = Array.isArray(o.zones) ? o.zones : [];
  const arrRaw = Array.isArray(o.arrondissements) ? o.arrondissements : [];
  const priceMap =
    o.price_by_arrondissement && typeof o.price_by_arrondissement === 'object'
      ? (o.price_by_arrondissement as Record<string, number>)
      : {};
  const defaultPrice = Number(o.default_price_fcfa);
  return {
    zones: zonesRaw
      .map((z) => {
        const row = z as Record<string, unknown>;
        const price = Math.round(Number(row.price_base));
        if (!row.id || !row.name || !Number.isFinite(price)) return null;
        return {
          id: String(row.id),
          name: String(row.name),
          label: String(row.label ?? row.name),
          price_base: price,
          is_active: row.is_active !== false,
          sort_order: Number(row.sort_order) || 0,
        };
      })
      .filter((z): z is NonNullable<typeof z> => z != null),
    arrondissements: arrRaw
      .map((a) => {
        const row = a as Record<string, unknown>;
        if (!row.id || !row.name || !row.zone_id) return null;
        return {
          id: String(row.id),
          name: String(row.name),
          zone_id: String(row.zone_id),
          sort_order: Number(row.sort_order) || 0,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a != null),
    price_by_arrondissement: Object.fromEntries(
      Object.entries(priceMap).map(([k, v]) => [k, Math.round(Number(v))]),
    ),
    default_price_fcfa:
      Number.isFinite(defaultPrice) && defaultPrice > 0
        ? Math.round(defaultPrice)
        : FALLBACK_DELIVERY_FEE_FCFA,
  };
}

function toPricing(raw: Record<string, unknown>): PublicPricing {
  const base = Number(raw.frais_livraison_base_fcfa);
  const minFee = Number(raw.frais_livraison_min_fcfa);
  const maxFee = Number(raw.frais_livraison_max_fcfa);
  const minOrder = Number(raw.montant_min_commande_fcfa);
  const baseFcfa = Number.isFinite(base) && base > 0 ? Math.round(base) : FALLBACK_DELIVERY_FEE_FCFA;
  const minFcfa = Number.isFinite(minFee) && minFee > 0 ? Math.round(minFee) : FALLBACK_DELIVERY_FEE_FCFA;
  const maxFcfa = Number.isFinite(maxFee) && maxFee > 0 ? Math.round(maxFee) : 2500;
  const minOrderFcfa =
    Number.isFinite(minOrder) && minOrder > 0 ? Math.round(minOrder) : FALLBACK_MIN_ORDER_FCFA;

  return {
    frais_livraison_base_fcfa: Math.max(baseFcfa, FALLBACK_DELIVERY_FEE_FCFA),
    frais_livraison_min_fcfa: Math.max(minFcfa, FALLBACK_DELIVERY_FEE_FCFA),
    frais_livraison_max_fcfa: Math.max(maxFcfa, FALLBACK_DELIVERY_FEE_FCFA),
    montant_min_commande_fcfa: Math.max(minOrderFcfa, FALLBACK_MIN_ORDER_FCFA),
    zones: parseZonesPublic(raw.zones),
  };
}

export async function fetchPublicPricing(force = false): Promise<PublicPricing> {
  const now = Date.now();
  if (!force && cached && now < cacheAt) return cached;
  try {
    const data = await apiFetch<Record<string, unknown>>('/api/orders/pricing-config', { method: 'GET' });
    cached = toPricing(data);
    cacheAt = now + CACHE_MS;
    return cached;
  } catch {
    return { ...DEFAULT_PUBLIC_PRICING };
  }
}

/**
 * Frais affichés pour un commerce.
 * Les valeurs en base sous le minimum plateforme (ex. ancien défaut 500 FCFA) sont remplacées par le tarif public.
 */
/** Frais selon l'arrondissement choisi (tarif zone admin). */
export function deliveryFeeForQuartier(
  quartier: string | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): number {
  const q = String(quartier || '').trim();
  const zones = pricing.zones;
  if (zones && q) {
    const fromMap = zones.price_by_arrondissement[q];
    if (Number.isFinite(fromMap) && fromMap > 0) return Math.round(fromMap);
  }
  return pricing.frais_livraison_base_fcfa;
}

export function zoneLabelForQuartier(
  quartier: string | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): string | null {
  const q = String(quartier || '').trim();
  const zones = pricing.zones;
  if (!zones || !q) return null;
  const arr = zones.arrondissements.find((a) => a.name === q);
  if (!arr) return null;
  const zone = zones.zones.find((z) => z.id === arr.zone_id);
  return zone ? `Zone ${zone.name}` : null;
}

export function displayDeliveryFeeFcfa(
  commerceFee: number | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): number {
  const min = pricing.frais_livraison_min_fcfa;
  const base = pricing.frais_livraison_base_fcfa;
  const max = pricing.frais_livraison_max_fcfa;
  const fromCommerce = Number(commerceFee);
  if (Number.isFinite(fromCommerce) && fromCommerce > 0) {
    const fee = Math.round(fromCommerce);
    if (fee < min) return base;
    if (fee > max) return max;
    return fee;
  }
  return base;
}

// ─── Temps de livraison dynamique (GoLivra) ─────────────────────────────
//
// Le temps de livraison est géré par GoLivra (livreur) et dépend de la ZONE
// de livraison du client, pas du commerce :
//   - Zone proche  → ~30 min
//   - Zone moyenne → ~45 min
//   - Zone éloignée → ~60 min
// Le temps de PRÉPARATION, lui, reste géré par le commerce (delai_preparation_min).

export const DELIVERY_MINUTES_TIERS = [30, 45, 60] as const;

export type DeliveryZoneTier = 'proche' | 'moyenne' | 'éloignée';

export const DELIVERY_ZONE_TIER_LABEL: Record<DeliveryZoneTier, string> = {
  proche: 'Zone proche',
  moyenne: 'Zone moyenne',
  éloignée: 'Zone éloignée',
};

/**
 * Rang d'une zone (0 = la moins chère → proche, 1 = moyenne, 2+ = éloignée),
 * classées par prix de livraison croissant (tiebreaker : `sort_order`).
 * `null` si aucune zone configurée ou quartier inconnu.
 *
 * Note : en l'absence de champ « temps de livraison » par zone en base, le
 * prix sert de proxy de distance — heuristique V1 assumée, remplaçable dès
 * qu'une durée par zone sera ajoutée côté admin.
 */
function zoneTierForQuartier(
  quartier: string | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): DeliveryZoneTier | null {
  const q = String(quartier || '').trim();
  const zones = pricing.zones;
  if (!zones || !q || zones.zones.length === 0) return null;

  const arr = zones.arrondissements.find((a) => a.name === q);
  if (!arr) return null;

  const sorted = [...zones.zones]
    .filter((z) => z.is_active)
    .sort(
      (a, b) =>
        a.price_base - b.price_base || (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  const idx = sorted.findIndex((z) => z.id === arr.zone_id);
  if (idx < 0) return null;
  if (idx === 0) return 'proche';
  if (idx === 1) return 'moyenne';
  return 'éloignée';
}

const TIER_MINUTES: Record<DeliveryZoneTier, number> = {
  proche: 30,
  moyenne: 45,
  éloignée: 60,
};

export type DeliveryEstimateForQuartier = {
  /** Minutes estimées (30/45/60) ou null si la zone n'est pas déterminable. */
  minutes: number | null;
  /** 'proche' | 'moyenne' | 'éloignée' ou null. */
  tier: DeliveryZoneTier | null;
  /** « Zone proche » / « Zone moyenne » / « Zone éloignée » ou null. */
  tierLabel: string | null;
};

/**
 * Estimation complète du temps de livraison (GoLivra) pour le quartier du
 * client : minutes + palier + libellé, en une seule passe.
 */
export function deliveryEstimateForQuartier(
  quartier: string | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): DeliveryEstimateForQuartier {
  const tier = zoneTierForQuartier(quartier, pricing);
  if (!tier) return { minutes: null, tier: null, tierLabel: null };
  return {
    minutes: TIER_MINUTES[tier],
    tier,
    tierLabel: DELIVERY_ZONE_TIER_LABEL[tier],
  };
}

/**
 * Temps de livraison estimé (min) pour le quartier du client, selon la zone :
 * proche 30 min · moyenne 45 min · éloignée 60 min.
 * `null` si la zone n'est pas déterminable (pas de config zones / quartier inconnu).
 */
export function deliveryMinutesForQuartier(
  quartier: string | null | undefined,
  pricing: PublicPricing = DEFAULT_PUBLIC_PRICING,
): number | null {
  return deliveryEstimateForQuartier(quartier, pricing).minutes;
}
