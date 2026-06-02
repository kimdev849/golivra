import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

import { getSessionToken } from '@/lib/auth';
import { fetchMyEnterprises, type EnterpriseCreated } from '@/lib/enterprise';
import { resolveRemoteImageUrl } from '@/lib/images';
import { fetchVendorOrders, fetchVendorProducts } from '@/lib/vendor-api';
import type { VendorCommerceType } from '@/lib/vendor-theme';
import type { VendorOrder, VendorProduct, VendorShop } from '@/lib/vendor-types';

type VendorStore = {
  loading: boolean;
  shop: VendorShop | null;
  orders: VendorOrder[];
  products: VendorProduct[];
  pendingModeration: boolean;
  refresh: () => Promise<void>;
  setProducts: (updater: VendorProduct[] | ((prev: VendorProduct[]) => VendorProduct[])) => void;
  setOrders: (updater: VendorOrder[] | ((prev: VendorOrder[]) => VendorOrder[])) => void;
};

function mapEnterpriseToShop(e: EnterpriseCreated): VendorShop {
  const type: VendorCommerceType = e.type === 'restaurant' ? 'restaurant' : 'boutique';
  return {
    id: e.id,
    type,
    nom: e.nom || 'Mon commerce',
    categorie: e.categorie_nom || (type === 'restaurant' ? 'Restaurant' : 'Boutique'),
    enLigne: e.statut_moderation === 'active' && e.ouvert === true,
    avatar: resolveRemoteImageUrl(e.image_url),
    description: e.description ?? null,
    telephone: e.telephone ?? null,
    adresse: e.adresse ?? null,
    adresse_quartier: e.adresse_quartier ?? null,
    adresse_ville: e.adresse_ville ?? null,
    latitude: e.latitude ?? null,
    longitude: e.longitude ?? null,
    statut_moderation: e.statut_moderation ?? null,
    livraison_propre: e.livraison_propre === true,
  };
}

export const useVendor = create<VendorStore>((set) => ({
  loading: true,
  shop: null,
  orders: [],
  products: [],
  pendingModeration: false,
  refresh: async () => {
    set({ loading: true });
    const token = await getSessionToken();
    if (!token) {
      set({ shop: null, orders: [], products: [], pendingModeration: false, loading: false });
      return;
    }

    try {
      const enterprises = await fetchMyEnterprises(token);
      const primary = enterprises[0] ?? null;
      if (!primary) {
        set({ shop: null, orders: [], products: [], pendingModeration: false, loading: false });
        return;
      }

      const mapped = mapEnterpriseToShop(primary);

      const [ordersData, productsData] = await Promise.all([
        fetchVendorOrders(token).catch(() => [] as VendorOrder[]),
        fetchVendorProducts(token, primary.id).catch(() => [] as VendorProduct[]),
      ]);

      set({
        shop: mapped,
        orders: ordersData,
        products: productsData,
        pendingModeration: mapped.statut_moderation === 'en_attente',
      });
    } catch {
      set({ shop: null, orders: [], products: [], pendingModeration: false });
    } finally {
      set({ loading: false });
    }
  },
  setProducts: (updater) => {
    set((state) => ({
      products: typeof updater === 'function' ? updater(state.products) : updater,
    }));
  },
  setOrders: (updater) => {
    set((state) => ({
      orders: typeof updater === 'function' ? updater(state.orders) : updater,
    }));
  },
}));

export function VendorProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useVendor.getState().refresh();
  }, []);

  return <>{children}</>;
}
