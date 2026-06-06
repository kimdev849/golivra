import { apiFetch } from '@/lib/api';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import { fetchCached, invalidateCached, peekCached } from '@/lib/request-cache';
import type { EnterpriseCategory } from '@/lib/enterprise';

const TTL_ENTERPRISES = 120_000;
const TTL_CATEGORIES = 300_000;
const TTL_PRODUCTS = 90_000;
const TTL_ENTERPRISE = 180_000;
const TTL_ME = 180_000;

export type AuthMe = {
  id: string;
  nom: string | null;
  telephone: string;
  role?: string | null;
  role_id?: string | number;
  roleId?: string | number;
  image_url?: string | null;
  imageUrl?: string | null;
  cree_le?: string;
  created_at?: string;
};

export function prefetchClientCatalog(): void {
  void fetchAllEnterprises().catch(() => {});
  void fetchEnterpriseCategories('restaurant').catch(() => {});
  void import('@/lib/catalog').then(({ fetchProductFeed }) =>
    fetchProductFeed({ limit: 24, offset: 0 }).catch(() => {}),
  );
}

export async function fetchAllEnterprises(force = false): Promise<EnterprisePublic[]> {
  const data = await fetchCached(
    'enterprises:all',
    () => apiFetch<EnterprisePublic[]>('/api/enterprises', { method: 'GET' }),
    TTL_ENTERPRISES,
    force
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchEnterprisesByType(
  type: 'restaurant' | 'boutique',
  force = false
): Promise<EnterprisePublic[]> {
  const key = `enterprises:${type}`;
  const data = await fetchCached(
    key,
    () => apiFetch<EnterprisePublic[]>(`/api/enterprises?type=${type}`, { method: 'GET' }),
    TTL_ENTERPRISES,
    force
  );
  return Array.isArray(data) ? data : [];
}

export function peekEnterprisesByType(type: 'restaurant' | 'boutique'): EnterprisePublic[] | null {
  return peekCached<EnterprisePublic[]>(`enterprises:${type}`, TTL_ENTERPRISES);
}

export function peekAllEnterprises(): EnterprisePublic[] | null {
  return peekCached<EnterprisePublic[]>('enterprises:all', TTL_ENTERPRISES);
}

export async function fetchEnterpriseCategories(
  type: 'restaurant' | 'boutique',
  force = false
): Promise<EnterpriseCategory[]> {
  const data = await fetchCached(
    `categories:${type}`,
    () => apiFetch<EnterpriseCategory[]>(`/api/enterprises/categories/${type}`, { method: 'GET' }),
    TTL_CATEGORIES,
    force
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchEnterpriseByIdCached(id: string, force = false): Promise<EnterprisePublic> {
  return fetchCached(
    `enterprise:${id}`,
    () => apiFetch<EnterprisePublic>(`/api/enterprises/${id}`, { method: 'GET' }),
    TTL_ENTERPRISE,
    force
  );
}

export function peekEnterpriseById(id: string): EnterprisePublic | null {
  return peekCached<EnterprisePublic>(`enterprise:${id}`, TTL_ENTERPRISE);
}

export async function fetchProductsForEnterpriseCached(
  enterpriseId: string,
  force = false
): Promise<ProductPublic[]> {
  const data = await fetchCached(
    `products:${enterpriseId}`,
    () => apiFetch<ProductPublic[]>(`/api/products/enterprise/${enterpriseId}`, { method: 'GET' }),
    TTL_PRODUCTS,
    force
  );
  return Array.isArray(data) ? data : [];
}

export function peekProductsForEnterprise(enterpriseId: string): ProductPublic[] | null {
  return peekCached<ProductPublic[]>(`products:${enterpriseId}`, TTL_PRODUCTS);
}

export async function fetchAuthMe(token: string, force = false): Promise<AuthMe> {
  return fetchCached(
    `auth:me:${token.slice(0, 24)}`,
    () => apiFetch<AuthMe>('/api/auth/me', { method: 'GET', token }),
    TTL_ME,
    force
  );
}

export function peekAuthMe(token: string): AuthMe | null {
  return peekCached<AuthMe>(`auth:me:${token.slice(0, 24)}`, TTL_ME);
}

export function clearClientDataCache(): void {
  invalidateCached();
}

/** Après une nouvelle note : invalide le cache commerces pour rafraîchir note_moyenne / nb_avis. */
export function invalidateEnterprisesCache(): void {
  invalidateCached('enterprises:');
  invalidateCached('enterprise:');
}
