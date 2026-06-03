import { apiFetch } from '@/lib/api';
import { fetchEnterpriseByIdCached, fetchProductsForEnterpriseCached } from '@/lib/client-data';
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

export async function fetchEnterpriseById(id: string, force = false): Promise<EnterprisePublic> {
  return fetchEnterpriseByIdCached(id, force);
}

export async function fetchProductsForEnterprise(enterpriseId: string, force = false): Promise<ProductPublic[]> {
  return fetchProductsForEnterpriseCached(enterpriseId, force);
}

/**
 * Feed public de produits/dishes, agrege depuis TOUS les commerces actifs.
 * Utilise par l'accueil client pour la grille 2 colonnes. Renvoie un tableau
 * plat de produits enrichis avec enterprise_nom/type/image_url.
 */
export async function fetchProductFeed(params: ProductFeedParams = {}): Promise<ProductPublic[]> {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.promo) search.set('promo', 'true');
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  return apiFetch<ProductPublic[]>(`/products/feed${qs ? `?${qs}` : ''}`, {
    skipIncidentReport: true,
  });
}

/**
 * Fetch un produit par son id (cross-commerces) avec une seule requete.
 * Si on connait deja l'entreprise, preferer fetchProductsForEnterprise
 * (cache partage) + findById en local. Sinon, fallback sur le feed.
 */
export async function fetchProductById(
  productId: string,
  kind: 'plat' | 'article',
): Promise<ProductPublic | null> {
  // Strategie simple: requeter le feed avec une grande limite et filtrer.
  // Les UUIDs sont uniques donc 1 match garanti. Pas de nouvel endpoint
  // dedie pour eviter la duplication de logique.
  const list = await fetchProductFeed({ type: kind, limit: 100 });
  return list.find((p) => p.id === productId) ?? null;
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

