import { apiFetch } from '@/lib/api';

export type FavoriteEnterprise = {
  enterprise_id: string;
  type: 'restaurant' | 'boutique';
  nom: string | null;
  statut?: string | null;
  est_ouvert?: boolean | null;
  favorited_at?: string;
};

export async function fetchFavorites(token: string): Promise<{
  items: FavoriteEnterprise[];
  enterprise_ids: string[];
}> {
  return apiFetch('/api/favorites', { method: 'GET', token });
}

export async function toggleFavoriteRemote(
  token: string,
  enterpriseId: string,
  enterpriseType?: 'restaurant' | 'boutique',
): Promise<{ enterprise_id: string; favori: boolean }> {
  return apiFetch('/api/favorites/toggle', {
    method: 'POST',
    token,
    jsonBody: { enterpriseId, enterpriseType },
  });
}

/**
 * Bascule un entreprise en favori.
 * @returns true si ajouté aux favoris, false si retiré
 */
export async function toggleFavorite(
  token: string,
  enterpriseId: string,
  enterpriseNom: string,
  enterpriseType?: 'restaurant' | 'boutique',
): Promise<boolean> {
  const result = await toggleFavoriteRemote(token, enterpriseId, enterpriseType);
  return result.favori;
}

/**
 * Vérifie si une entreprise est dans les favoris.
 */
export async function isFavorite(token: string, enterpriseId: string): Promise<boolean> {
  try {
    const { enterprise_ids } = await fetchFavorites(token);
    return enterprise_ids.includes(enterpriseId);
  } catch {
    return false;
  }
}

export async function syncFavoritesRemote(token: string, enterpriseIds: string[]): Promise<{
  items: FavoriteEnterprise[];
  enterprise_ids: string[];
}> {
  return apiFetch('/api/favorites/sync', {
    method: 'POST',
    token,
    jsonBody: { enterpriseIds },
  });
}

export type FavoriteProductRef = {
  produit_id: string;
  produit_kind: 'plat' | 'article';
  favorited_at?: string;
};

export async function fetchFavoriteProducts(token: string): Promise<{ items: FavoriteProductRef[] }> {
  return apiFetch('/api/favorites/products', { method: 'GET', token });
}

export async function toggleFavoriteProductRemote(
  token: string,
  productId: string,
  kind: 'plat' | 'article',
): Promise<{ produit_id: string; produit_kind: string; favori: boolean }> {
  return apiFetch('/api/favorites/products/toggle', {
    method: 'POST',
    token,
    jsonBody: { produitId: productId, produitKind: kind },
  });
}
