import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { z } from 'zod';

import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { isActiveOrderStatus, orderPollingIntervalMs } from '@/lib/order-status';
import { ClientOrderListItemSchema, type ClientOrderListItemZod } from '@/lib/schemas';

const ClientOrdersSchema = z.array(ClientOrderListItemSchema);

function fastestPollingInterval(orders: ClientOrderListItemZod[]): number | false {
  const active = orders.filter((o) => isActiveOrderStatus(o.statut));
  if (!active.length) return false;

  let fastest = Infinity;
  for (const o of active) {
    const interval = orderPollingIntervalMs(o.statut);
    if (interval !== false && interval < fastest) fastest = interval;
  }
  return fastest === Infinity ? false : fastest;
}

export function useActiveOrders() {
  const query = useQuery({
    queryKey: ['orders', 'client'],
    queryFn: async () => {
      const token = await getSessionToken();
      if (!token) return [] as ClientOrderListItemZod[];
      return apiFetch<ClientOrderListItemZod[]>('/api/orders', {
        method: 'GET',
        token,
        schema: ClientOrdersSchema,
      });
    },
    refetchInterval: (q) => {
      const data = q.state.data;
      // Aucune commande active : inutile de poller toutes les 30 s (le focus
      // écran rafraîchit au retour). 5 min suffisent à garder la liste à jour.
      if (!data?.length) return 5 * 60_000;
      return fastestPollingInterval(data);
    },
    staleTime: 10_000,
  });

  const activeOrders = useMemo(() => {
    const list = query.data ?? [];
    return [...list]
      .filter((o) => isActiveOrderStatus(o.statut))
      .sort((a, b) => {
        const da = a.cree_le ? new Date(a.cree_le).getTime() : 0;
        const db = b.cree_le ? new Date(b.cree_le).getTime() : 0;
        return db - da;
      });
  }, [query.data]);

  return {
    ...query,
    activeOrders,
    heroOrder: activeOrders[0] ?? null,
  };
}
