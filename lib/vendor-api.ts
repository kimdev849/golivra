import { apiFetch } from '@/lib/api';
import type { DeliveryAddressFields } from '@/lib/format-address';
import type { ArticleCategory, ProductOptionGroup } from '@/lib/vendor-product-types';
import { normalizeImageUrlList } from '@/lib/vendor-image-urls';
import type {
  VendorEngagementInput,
  VendorOrder,
  VendorOrderStatus,
  VendorProduct,
} from '@/lib/vendor-types';

export type { VendorEngagementInput } from '@/lib/vendor-types';

type ApiProduct = {
  id: string;
  nom: string;
  description?: string | null;
  prix: number;
  prix_promo?: number | null;
  promo_debut_at?: string | null;
  promo_fin_at?: string | null;
  stock?: number | null;
  stock_illimite?: boolean;
  est_disponible?: boolean;
  est_en_vedette?: boolean;
  image_url?: string | null;
  images_urls?: string[];
  reference?: string | null;
  unite?: string | null;
  categorie_id?: string | null;
  tags?: string[];
  allergenes?: string[];
  type_produit?: string | null;
  etat_produit?: string | null;
  marque?: string | null;
  poids_kg?: number | null;
  dimensions?: { l?: number; w?: number; h?: number } | null;
  options?: ProductOptionGroup[] | null;
  kind?: string;
};

export type VendorProductWriteBody = {
  nom: string;
  description?: string;
  prix: number;
  prixPromo?: number | null;
  stock?: number | null;
  stockIllimite?: boolean;
  imageUrl?: string;
  imagesUrls?: string[];
  categorieId?: string | null;
  estEnVedette?: boolean;
  estDisponible?: boolean;
  reference?: string;
  unite?: string;
  options?: ProductOptionGroup[] | null;
  tags?: string[];
  allergenes?: string[];
  promoDebutAt?: string | null;
  promoFinAt?: string | null;
  typeProduit?: string;
  etatProduit?: string;
  marque?: string;
  poidsKg?: number | null;
  dimensions?: { l?: number; w?: number; h?: number } | null;
};

function mapApiProduct(p: ApiProduct): VendorProduct {
  const stockIllimite = p.stock_illimite === true || p.stock === null || p.stock === undefined;
  return {
    id: p.id,
    nom: p.nom,
    prix: Number(p.prix),
    prixPromo: p.prix_promo != null ? Number(p.prix_promo) : null,
    promoDebutAt: p.promo_debut_at ?? null,
    promoFinAt: p.promo_fin_at ?? null,
    stock: stockIllimite ? 999 : Math.max(0, Math.floor(Number(p.stock ?? 0))),
    stockIllimite,
    enLigne: p.est_disponible !== false,
    description: p.description ?? null,
    imageUrl: p.image_url ?? null,
    imagesUrls: normalizeImageUrlList(p.images_urls),
    reference: p.reference ?? null,
    unite: p.unite ?? null,
    enVedette: p.est_en_vedette === true,
    categorieId: p.categorie_id ?? null,
    tags: p.tags ?? [],
    allergenes: p.allergenes ?? [],
    typeProduit: p.type_produit ?? null,
    etatProduit: p.etat_produit ?? null,
    marque: p.marque ?? null,
    poidsKg: p.poids_kg ?? null,
    dimensions: p.dimensions ?? null,
    optionGroups: p.options ?? null,
  };
}

export async function fetchVendorProducts(token: string, enterpriseId: string): Promise<VendorProduct[]> {
  const data = await apiFetch<ApiProduct[]>(`/api/products/enterprise/${enterpriseId}`, {
    method: 'GET',
    token,
  });
  return (Array.isArray(data) ? data : []).map(mapApiProduct);
}

export async function createVendorProduct(
  token: string,
  enterpriseId: string,
  body: VendorProductWriteBody,
): Promise<VendorProduct> {
  const data = await apiFetch<ApiProduct>(`/api/products/enterprise/${enterpriseId}`, {
    method: 'POST',
    token,
    jsonBody: body,
  });
  return mapApiProduct(data);
}

export async function updateVendorProduct(
  token: string,
  enterpriseId: string,
  productId: string,
  body: Partial<VendorProductWriteBody>,
): Promise<VendorProduct> {
  const data = await apiFetch<ApiProduct>(`/api/products/enterprise/${enterpriseId}/${productId}`, {
    method: 'PATCH',
    token,
    jsonBody: body,
  });
  return mapApiProduct(data);
}

export async function deleteVendorProduct(
  token: string,
  enterpriseId: string,
  productId: string,
): Promise<void> {
  await apiFetch(`/api/products/enterprise/${enterpriseId}/${productId}`, {
    method: 'DELETE',
    token,
  });
}

export type EnterpriseStatsResponse = {
  enterprise?: { id: string; nom: string; type?: string };
  orders?: unknown;
  revenue?: unknown;
  engagement?: VendorEngagementInput;
  [key: string]: unknown;
};

/**
 * Récupère les stats du commerce courant (vues/clics/top produits/etc.).
 * Rétrocompatible : `engagement` peut être absent tant que la migration SQL n'est pas appliquée.
 */
export async function fetchMyEnterpriseStats(
  token: string,
  enterpriseId: string,
): Promise<EnterpriseStatsResponse> {
  const data = await apiFetch<EnterpriseStatsResponse>(
    `/api/enterprises/${enterpriseId}/stats`,
    { method: 'GET', token },
  );
  return data ?? {};
}

export async function fetchArticleCategories(token: string, enterpriseId: string): Promise<ArticleCategory[]> {
  const data = await apiFetch<ArticleCategory[]>(`/api/products/enterprise/${enterpriseId}/categories`, {
    method: 'GET',
    token,
  });
  return Array.isArray(data) ? data : [];
}

export async function createArticleCategory(
  token: string,
  enterpriseId: string,
  body: { nom: string; description?: string },
): Promise<ArticleCategory> {
  return apiFetch<ArticleCategory>(`/api/products/enterprise/${enterpriseId}/categories`, {
    method: 'POST',
    token,
    jsonBody: body,
  });
}

type ApiVendorOrder = VendorOrder;

export async function fetchVendorOrders(token: string): Promise<VendorOrder[]> {
  const data = await apiFetch<ApiVendorOrder[]>('/api/orders/vendor/mine', { method: 'GET', token });
  return Array.isArray(data) ? data : [];
}

export async function fetchVendorOrder(token: string, orderId: string): Promise<VendorOrder> {
  return apiFetch<VendorOrder>(`/api/orders/vendor/${orderId}`, { method: 'GET', token });
}

const VENDOR_TO_API_STATUT: Record<string, string> = {
  en_attente: 'en_attente',
  acceptee: 'acceptee',
  a_preparer: 'acceptee',
  en_preparation: 'en_preparation',
  prete: 'prete',
  en_livraison: 'collectee',
  livree: 'livree',
  annulee: 'annulee',
};

export async function updateVendorOrderStatus(
  token: string,
  orderId: string,
  statut: VendorOrderStatus | string,
  sousCommandeId?: string,
  raisonRefus?: string,
): Promise<unknown> {
  const apiStatut = VENDOR_TO_API_STATUT[statut] ?? statut;
  return apiFetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    jsonBody: {
      statut: apiStatut,
      ...(sousCommandeId ? { sousCommandeId } : {}),
      ...(raisonRefus ? { raisonRefus } : {}),
    },
  });
}

export type DeliveryStatusResponse = {
  orderId: string;
  orderStatus: string;
  delivery: { statut?: string | null } | null;
  deliveries?: unknown[];
};

export async function fetchDeliveryStatus(
  token: string,
  orderId: string,
): Promise<DeliveryStatusResponse> {
  return apiFetch<DeliveryStatusResponse>(`/api/delivery/status/${orderId}`, {
    method: 'GET',
    token,
  });
}

/** Livraison externe (commerce, hors commande client). */
export type VendorExternalDelivery = {
  id: string;
  source: 'externe';
  type_livraison: 'externe';
  statut: string;
  client_nom: string;
  client_telephone?: string | null;
  adresse: string;
  note?: string | null;
  establishment_nom?: string;
  montant_livraison?: number | null;
  livreur?: { nom: string; tel: string };
  created_at: string;
  attribuee_at?: string | null;
  livree_at?: string | null;
};

export type CreateExternalDeliveryBody = {
  establishmentId: string;
  establishmentType: 'restaurant' | 'boutique';
  clientNom: string;
  clientTelephone: string;
  adresse: DeliveryAddressFields;
  note?: string;
  methodePaiement?: 'airtel_money' | 'mtn_money';
};

export async function fetchVendorExternalDeliveries(token: string): Promise<VendorExternalDelivery[]> {
  const data = await apiFetch<VendorExternalDelivery[]>('/api/delivery/vendor/externe', {
    method: 'GET',
    token,
  });
  return Array.isArray(data) ? data : [];
}

export async function createVendorExternalDelivery(
  token: string,
  body: CreateExternalDeliveryBody,
): Promise<VendorExternalDelivery> {
  return apiFetch<VendorExternalDelivery>('/api/delivery/vendor/externe', {
    method: 'POST',
    token,
    jsonBody: body,
  });
}

/** @deprecated utilisez fetchVendorExternalDeliveries */
export const fetchVendorDirectDeliveries = fetchVendorExternalDeliveries;

/** @deprecated utilisez createVendorExternalDelivery */
export const createVendorDirectDelivery = createVendorExternalDelivery;

/** @deprecated */
export type VendorDirectDelivery = VendorExternalDelivery;

export { deliveryTrackingLabel as livraisonStatutLabel } from '@/lib/ux-copy';
