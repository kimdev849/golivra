import { safeGetItem, safeSetItem } from '@/lib/safe-store';

import { getSessionToken } from '@/lib/auth';
import {
  fetchFavorites,
  fetchFavoriteProducts,
  syncFavoritesRemote,
  toggleFavoriteProductRemote,
  toggleFavoriteRemote,
} from '@/lib/favorites-api';

const STORAGE_KEY = 'golivra_client_favorites_v1';
const STORAGE_KEY_PRODUCTS = 'golivra_client_favorite_products_v1';

export type FavoriteProductRef = { produit_id: string; produit_kind: 'plat' | 'article' };

async function readIds(): Promise<string[]> {
  try {
    const raw = await safeGetItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

async function writeIds(ids: string[]): Promise<void> {
  await safeSetItem(STORAGE_KEY, JSON.stringify(ids));
}

async function readProductRefs(): Promise<FavoriteProductRef[]> {
  try {
    const raw = await safeGetItem(STORAGE_KEY_PRODUCTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is FavoriteProductRef =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as { produit_id?: unknown }).produit_id === 'string' &&
          ((x as { produit_kind?: unknown }).produit_kind === 'plat' ||
            (x as { produit_kind?: unknown }).produit_kind === 'article'),
      );
  } catch {
    return [];
  }
}

async function writeProductRefs(refs: FavoriteProductRef[]): Promise<void> {
  await safeSetItem(STORAGE_KEY_PRODUCTS, JSON.stringify(refs));
}

export async function getFavoriteEnterpriseIds(): Promise<string[]> {
  const token = await getSessionToken();
  if (token) {
    try {
      const remote = await fetchFavorites(token);
      const ids = remote.enterprise_ids ?? [];
      await writeIds(ids);
      return ids;
    } catch {
      /* fallback local */
    }
  }
  return readIds();
}

export async function isFavoriteEnterprise(id: string): Promise<boolean> {
  const ids = await getFavoriteEnterpriseIds();
  return ids.includes(id);
}

/** Ajoute ou retire l’ID ; renvoie true si désormais favori. */
export async function toggleFavoriteEnterpriseId(
  id: string,
  enterpriseType?: 'restaurant' | 'boutique',
): Promise<boolean> {
  const token = await getSessionToken();
  if (token) {
    try {
      const res = await toggleFavoriteRemote(token, id, enterpriseType);
      const ids = await readIds();
      const next = res.favori ? [...new Set([...ids, id])] : ids.filter((x) => x !== id);
      await writeIds(next);
      return res.favori;
    } catch {
      /* fallback local */
    }
  }

  const ids = await readIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((x) => x !== id) : [...ids, id];
  await writeIds(next);
  return !has;
}

/** Synchronise les favoris locaux vers le serveur après connexion. */
export async function syncFavoritesWithServer(): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  const local = await readIds();
  try {
    const remote = await syncFavoritesRemote(token, local);
    await writeIds(remote.enterprise_ids ?? []);
  } catch {
    /* ignore */
  }
}

/* ============================================================ */
/* FAVORIS PRODUITS (plats + articles)                          */
/* ============================================================ */

function productRefKey(ref: FavoriteProductRef): string {
  return `${ref.produit_kind}:${ref.produit_id}`;
}

export async function getFavoriteProducts(): Promise<FavoriteProductRef[]> {
  const token = await getSessionToken();
  if (token) {
    try {
      const remote = await fetchFavoriteProducts(token);
      const items = (remote.items ?? []) as FavoriteProductRef[];
      await writeProductRefs(items);
      return items;
    } catch {
      /* fallback local */
    }
  }
  return readProductRefs();
}

export async function isFavoriteProduct(productId: string, kind: 'plat' | 'article'): Promise<boolean> {
  const refs = await getFavoriteProducts();
  return refs.some((r) => r.produit_id === productId && r.produit_kind === kind);
}

/** Ajoute ou retire le produit ; renvoie true si désormais favori. */
export async function toggleFavoriteProduct(
  productId: string,
  kind: 'plat' | 'article',
): Promise<boolean> {
  const token = await getSessionToken();
  const ref: FavoriteProductRef = { produit_id: productId, produit_kind: kind };
  const key = productRefKey(ref);

  if (token) {
    try {
      const res = await toggleFavoriteProductRemote(token, productId, kind);
      const current = await readProductRefs();
      const has = current.some((r) => productRefKey(r) === key);
      const next = res.favori
        ? has
          ? current
          : [...current, ref]
        : current.filter((r) => productRefKey(r) !== key);
      await writeProductRefs(next);
      return res.favori;
    } catch {
      /* fallback local */
    }
  }

  const refs = await readProductRefs();
  const has = refs.some((r) => productRefKey(r) === key);
  const next = has ? refs.filter((r) => productRefKey(r) !== key) : [...refs, ref];
  await writeProductRefs(next);
  return !has;
}
