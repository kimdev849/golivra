import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import type { EnterpriseCategory } from '@/lib/enterprise';
import { fetchCached } from '@/lib/request-cache';
import { peekAllEnterprises, peekEnterprisesByType } from '@/lib/client-data';
import { EnterprisePublicSchema, ProductPublicSchema } from '@/lib/schemas';
import { z } from 'zod';

const TTL_ENTERPRISES_MS = 1000 * 60 * 2; // 2 minutes

export function useEnterprises(type: 'restaurant' | 'boutique' | 'all') {
  return useQuery({
    queryKey: ['enterprises', type],
    queryFn: async () => {
      const url = type === 'all' ? '/api/enterprises' : `/api/enterprises?type=${type}`;
      return apiFetch<EnterprisePublic[]>(url, {
        method: 'GET',
        schema: z.array(EnterprisePublicSchema),
        // Cold start Render : laisser respirer la 1re requête du réveil.
        timeoutMs: 25_000,
      });
    },
    // Affiche IMMÉDIATEMENT les commerces du cache disque (dernière session)
    // pendant que le réseau rafraîchit en arrière-plan → accueil plus rapide.
    placeholderData: () => {
      if (type === 'all') return peekAllEnterprises() ?? undefined;
      return peekEnterprisesByType(type) ?? undefined;
    },
    staleTime: TTL_ENTERPRISES_MS,
  });
}

export function useEnterpriseCategories(type: 'restaurant' | 'boutique') {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      return fetchCached(
        `categories:${type}`,
        () => apiFetch<EnterpriseCategory[]>(`/api/enterprises/categories/${type}`, { method: 'GET' }),
        1000 * 60 * 5,
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useEnterpriseDetails(id: string) {
  return useQuery({
    queryKey: ['enterprise', id],
    queryFn: async () => {
      return apiFetch<EnterprisePublic>(`/api/enterprises/${id}`, {
        method: 'GET',
        schema: EnterprisePublicSchema,
      });
    },
    staleTime: 1000 * 60 * 3,
    enabled: !!id,
  });
}

export function useEnterpriseProducts(enterpriseId: string) {
  return useQuery({
    queryKey: ['products', enterpriseId],
    queryFn: async () => {
      return fetchCached(
        `products:${enterpriseId}`,
        () => apiFetch<ProductPublic[]>(`/api/products/enterprise/${enterpriseId}`, {
          method: 'GET',
          schema: z.array(ProductPublicSchema),
        }),
        1000 * 60 * 1.5,
      );
    },
    staleTime: 1000 * 60 * 1.5,
    enabled: !!enterpriseId,
  });
}
