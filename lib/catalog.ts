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
  kind?: 'plat' | 'article' | string;
  /** Compteurs d'engagement renvoyés par l'API (engagement produit). */
  nb_vues?: number;
  nb_clics?: number;
  nb_ventes?: number;
};

export async function fetchEnterpriseById(id: string, force = false): Promise<EnterprisePublic> {
  return fetchEnterpriseByIdCached(id, force);
}

export async function fetchProductsForEnterprise(enterpriseId: string, force = false): Promise<ProductPublic[]> {
  return fetchProductsForEnterpriseCached(enterpriseId, force);
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

