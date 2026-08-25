import { useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { getSessionToken } from '@/lib/auth';
import { fetchMyEnterprises, type EnterpriseCreated } from '@/lib/enterprise';
import { resolveRemoteImageUrl } from '@/lib/images';
import { enterprisePrepMinutes } from '@/lib/pricing';
import { fetchVendorOrders, fetchVendorProducts } from '@/lib/vendor-api';
import type { VendorCommerceType } from '@/lib/vendor-theme';
import type { VendorOrder, VendorProduct, VendorShop } from '@/lib/vendor-types';

type VendorStore = {
  loading: boolean;
  shop: VendorShop | null;
  orders: VendorOrder[];
  products: VendorProduct[];
  pendingModeration: boolean;
  /** Nombre de notifications non lues (mis à jour en temps réel). */
  unreadNotifCount: number;
  refresh: () => Promise<void>;
  /** Rafraîchit uniquement les commandes, sans écran de chargement (actions de statut, realtime). */
  refreshOrders: () => Promise<void>;
  /** Met à jour le compteur de notifications non lues. */
  refreshUnreadCount: () => Promise<void>;
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
    delaiPreparationMin: enterprisePrepMinutes(e),
  };
}

export const useVendor = create<VendorStore>((set, get) => ({
  loading: true,
  shop: null,
  orders: [],
  products: [],
  pendingModeration: false,
  unreadNotifCount: 0,
  refresh: async () => {
    // Le chargement plein écran n'apparaît qu'au tout premier chargement :
    // dès que des données existent, un refresh reste silencieux pour éviter
    // les écrans blancs / squelettes à chaque action.
    const hasData = get().shop !== null || get().orders.length > 0 || get().products.length > 0;
    if (!hasData) set({ loading: true });
    const token = await getSessionToken();
    if (!token) {
      set({ shop: null, orders: [], products: [], pendingModeration: false, loading: false });
      return;
    }

    try {
      const enterprises = await fetchMyEnterprises(token);
      const primary = enterprises[0] ?? null;
      if (!primary) {
        // Comme pour une erreur réseau, on garde les données actuelles si l'on
        // en a déjà (pas de flash vers un écran vide).
        if (!hasData) {
          set({ shop: null, orders: [], products: [], pendingModeration: false, loading: false });
        }
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
      if (!hasData) set({ shop: null, orders: [], products: [], pendingModeration: false });
    } finally {
      if (!hasData) set({ loading: false });
    }
  },
  refreshOrders: async () => {
    const token = await getSessionToken();
    if (!token) return;
    try {
      const ordersData = await fetchVendorOrders(token);
      set({ orders: ordersData });
    } catch {
      // Silencieux : on conserve les données actuelles en cas d'échec réseau.
    }
  },
  setProducts: (updater) => {
    set((state) => ({
      products: typeof updater === 'function' ? updater(state.products) : updater,
    }));
  },
  refreshUnreadCount: async () => {
    const token = await getSessionToken();
    if (!token) { set({ unreadNotifCount: 0 }); return; }
    try {
      const { fetchUnreadCount } = await import('@/lib/notifications-api');
      const count = await fetchUnreadCount(token);
      set({ unreadNotifCount: count });
    } catch {
      // Silencieux.
    }
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

  // Polling temps réel des notifications non lues toutes les 30 secondes.
  // Ne tourne que si l'app est au premier plan.
  const appActive = useRef(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      appActive.current = state === 'active';
      if (appActive.current) void useVendor.getState().refreshUnreadCount();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    void useVendor.getState().refreshUnreadCount();
    const id = setInterval(() => {
      if (appActive.current) void useVendor.getState().refreshUnreadCount();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return <>{children}</>;
}
