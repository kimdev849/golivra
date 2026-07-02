import { apiFetch } from '@/lib/api';
import {
  fetchEnterpriseByIdCached,
  fetchEnterprisesByType,
  fetchProductsForEnterpriseCached,
} from '@/lib/client-data';
import { getSessionToken } from '@/lib/auth';

export type EnterprisePublic = {
  id: string;
  nom: string | null;
  type: 'restaurant' | 'boutique';
  description?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  image_url?: string | null;
  ouvert?: boolean;
  categorie_id?: string | null;
  categorie_nom?: string | null;
  delai_preparation_min?: number;
  delai_livraison_min?: number;
  livraison_propre?: boolean;
  frais_livraison?: number;
  note_moyenne?: number;
  nb_avis?: number;
  /** Présent si l’API le renvoie : hors `active`, le commerce n’apparaît pas sur le marketplace public. */
  statut_moderation?: 'en_attente' | 'active' | 'suspendu' | string | null;
};

export type ProductPublic = {
  id: string;
  entreprise_id: string;
  nom: string | null;
  description?: string | null;
  prix: number | string;
  prix_promo?: number | null;
  promo_debut_at?: string | null;
  promo_fin_at?: string | null;
  stock?: number | string | null;
  stock_illimite?: boolean;
  est_disponible?: boolean;
  image_url?: string | null;
  /** Galerie complémentaire (jusqu'à 8 URLs). La 1re entrée est identique à `image_url`. */
  images_urls?: string[] | null;
  kind?: 'plat' | 'article' | string;
  /** Compteurs d'engagement renvoyés par l'API (engagement produit). */
  nb_vues?: number;
  nb_clics?: number;
  nb_ventes?: number;
  /** Options de personnalisation (uniquement plats) : groupes de choix avec supplément. */
  options?: ProductOptionGroup[] | null;
  /** Tags / catégories secondaires (utile pour la fiche produit). */
  tags?: string[] | null;
  /** Catégorie de produit (FK categorie_id resolue cote API). */
  categorie_id?: string | null;
  /** Hydratation par le feed cross-commerces (optionnel sur l'endpoint /enterprise/:id). */
  enterprise_nom?: string | null;
  enterprise_type?: 'restaurant' | 'boutique' | null;
  enterprise_image_url?: string | null;
};

export type ProductOptionGroup = {
  nom: string;
  /** true = au moins un choix obligatoire. */
  requis?: boolean;
  choix: { label: string; prix_sup?: number }[];
};

export type ProductFeedParams = {
  type?: 'plat' | 'article' | 'all';
  promo?: boolean;
  limit?: number;
  offset?: number;
};

export type CatalogSearchType = 'all' | 'plat' | 'article' | 'restaurant' | 'boutique';

export type CatalogSearchResult = {
  products: ProductPublic[];
  enterprises: EnterprisePublic[];
};

function isPromoProduct(p: ProductPublic): boolean {
  return p.prix_promo != null && Number(p.prix_promo) < Number(p.prix);
}

function applyFeedFilters(items: ProductPublic[], params: ProductFeedParams): ProductPublic[] {
  let list = items;
  if (params.type === 'plat') list = list.filter((p) => p.kind !== 'article');
  if (params.type === 'article') list = list.filter((p) => p.kind === 'article');
  if (params.promo) list = list.filter(isPromoProduct);
  const offset = Math.max(0, params.offset ?? 0);
  const limit = params.limit ?? list.length;
  return list.slice(offset, offset + limit);
}

/** Repli local si /feed indisponible (ex. cache PostgREST incomplet côté Supabase). */
async function fetchProductFeedFromEnterprises(params: ProductFeedParams = {}): Promise<ProductPublic[]> {
  const [restaurants, boutiques] = await Promise.all([
    fetchEnterprisesByType('restaurant'),
    fetchEnterprisesByType('boutique'),
  ]);
  const enterprises = [...restaurants, ...boutiques];
  const batches = await Promise.all(
    enterprises.map(async (e) => {
      try {
        const prods = await fetchProductsForEnterprise(e.id);
        return prods.map((p) => ({
          ...p,
          enterprise_nom: e.nom,
          enterprise_type: e.type,
          enterprise_image_url: e.image_url ?? null,
        }));
      } catch {
        return [] as ProductPublic[];
      }
    }),
  );
  return applyFeedFilters(batches.flat(), params);
}

function shouldFallbackFeed(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
  return (
    code === 'SCHEMA_INCOMPLET' ||
    /schema|cache api|colonne.*absente|SCHEMA_INCOMPLET/i.test(msg)
  );
}

/**
 * Feed public de produits/dishes, agrege depuis TOUS les commerces actifs.
 */
export async function fetchProductFeed(params: ProductFeedParams = {}): Promise<ProductPublic[]> {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.promo) search.set('promo', 'true');
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  try {
    return await apiFetch<ProductPublic[]>(`/products/feed${qs ? `?${qs}` : ''}`, {
      skipIncidentReport: true,
    });
  } catch (error) {
    if (shouldFallbackFeed(error)) {
      return fetchProductFeedFromEnterprises(params);
    }
    // Repli si le feed serveur est indisponible (500, route absente, etc.)
    try {
      return await fetchProductFeedFromEnterprises(params);
    } catch {
      throw error;
    }
  }
}

/** Recherche serveur unifiée (produits + commerces). */
export async function searchCatalog(
  query: string,
  type: CatalogSearchType = 'all',
  limit = 24,
): Promise<CatalogSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { products: [], enterprises: [] };

  const search = new URLSearchParams();
  search.set('q', q);
  if (type !== 'all') search.set('type', type);
  search.set('limit', String(limit));

  try {
    return await apiFetch<CatalogSearchResult>(`/products/search?${search.toString()}`, {
      skipIncidentReport: true,
    });
  } catch {
    const [feed, restaurants, boutiques] = await Promise.all([
      fetchProductFeedFromEnterprises({ limit: 200 }),
      type === 'all' || type === 'restaurant' ? fetchEnterprisesByType('restaurant') : Promise.resolve([]),
      type === 'all' || type === 'boutique' ? fetchEnterprisesByType('boutique') : Promise.resolve([]),
    ]);
    const needle = q.toLowerCase();
    const matchText = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(needle);
    const products = feed.filter(
      (p) =>
        matchText(p.nom) ||
        matchText(p.description) ||
        matchText(p.enterprise_nom) ||
        (Array.isArray(p.tags) && p.tags.some((t) => matchText(t))),
    );
    const enterprises = [...restaurants, ...boutiques].filter(
      (e) => matchText(e.nom) || matchText(e.description) || matchText(e.adresse) || matchText(e.categorie_nom),
    );
    return {
      products: products.slice(0, limit),
      enterprises: enterprises.slice(0, 12),
    };
  }
}

export async function fetchEnterpriseById(id: string, force = false): Promise<EnterprisePublic> {
  return fetchEnterpriseByIdCached(id, force);
}

export async function fetchProductsForEnterprise(enterpriseId: string, force = false): Promise<ProductPublic[]> {
  return fetchProductsForEnterpriseCached(enterpriseId, force);
}

/** Cache en mémoire pour les produits individuels (révisite instantanée). */
const productMemoryCache = new Map<string, { data: ProductPublic; at: number }>();
const PRODUCT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function peekProductById(productId: string): ProductPublic | null {
  const hit = productMemoryCache.get(productId);
  if (!hit) return null;
  if (Date.now() - hit.at > PRODUCT_CACHE_TTL) return null;
  return hit.data;
}

/**
 * Fetch un produit par son id (cross-commerces) avec une seule requete.
 * Si on connait deja l'entreprise, preferer fetchProductsForEnterprise
 * (cache partage) + findById en local. Sinon, fallback sur le feed.
 */
export async function fetchProductById(
  productId: string,
  kind: 'plat' | 'article',
  enterpriseId?: string,
): Promise<ProductPublic | null> {
  if (enterpriseId) {
    const fromEnterprise = await fetchProductsForEnterprise(enterpriseId);
    const found = fromEnterprise.find((p) => p.id === productId);
    if (found) {
      productMemoryCache.set(productId, { data: found, at: Date.now() });
      return found;
    }
  }
  // Vérifier le cache mémoire d'abord
  const cached = peekProductById(productId);
  if (cached) return cached;

  const list = await fetchProductFeed({ type: kind, limit: 200 });
  const found = list.find((p) => p.id === productId);
  if (found) {
    productMemoryCache.set(productId, { data: found, at: Date.now() });
  }
  return found ?? null;
}

/**
 * Enregistre une vue d'un commerce (et implicitement l'exposition de ses produits).
 * Fire-and-forget : on n'attend pas la réponse, on swallow les erreurs.
 * Le backend incrémente `nb_vues` de chaque produit listé.
 */
export function trackEnterpriseView(enterpriseId: string, productIds: string[]): void {
  if (!enterpriseId) return;
  const ids = productIds.filter(Boolean);
  const fire = async () => {
    try {
      const token = await getSessionToken();
      await apiFetch<void>(`/products/enterprise/${enterpriseId}/views`, {
        method: 'POST',
        token,
        jsonBody: { ids },
        schema: undefined,
        skipIncidentReport: true,
      }).catch(() => undefined);
    } catch {
      /* tracking best-effort */
    }
  };
  void fire();
}

/** Enregistre un clic (add-to-cart) sur un produit. Fire-and-forget. */
export function trackProductClick(enterpriseId: string, productId: string): void {
  if (!enterpriseId || !productId) return;
  const fire = async () => {
    try {
      const token = await getSessionToken();
      await apiFetch<void>(`/products/enterprise/${enterpriseId}/${productId}/click`, {
        method: 'POST',
        token,
        skipIncidentReport: true,
      }).catch(() => undefined);
    } catch {
      /* tracking best-effort */
    }
  };
  void fire();
}

