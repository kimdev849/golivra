import type { Href } from 'expo-router';

/** Routes statiques espace vendeur (typage Expo Router). */
export const VENDOR_HREF = {
  root: '/vendor' as Href,
  statistics: '/vendor/statistics' as Href,
  ordersTab: '/vendor/orders' as Href,
  deliveriesTab: '/vendor/deliveries' as Href,
  productsTab: '/vendor/products' as Href,
  catalog: '/vendor/catalog' as Href,
  categories: '/vendor/categories' as Href,
  delivery: '/vendor/delivery' as Href,
  wallet: '/vendor/wallet' as Href,
  notifications: '/vendor/notifications' as Href,
  addProduct: '/vendor/add-product' as Href,
  shopInfo: '/vendor/shop-info' as Href,
  horaires: '/vendor/horaires' as Href,
  shopAddresses: '/vendor/shop-addresses' as Href,
  shopPayments: '/vendor/shop-payments' as Href,
  shopSettings: '/vendor/shop-settings' as Href,
  share: '/vendor/share' as Href,
  helpCenter: '/vendor/help-center' as Href,
} as const;

export function hrefVendorOrder(id: string): Href {
  return { pathname: '/vendor/order/[id]', params: { id } };
}

export function hrefVendorPreparation(id: string): Href {
  return { pathname: '/vendor/preparation/[id]', params: { id } };
}

export function hrefVendorStock(id: string): Href {
  return { pathname: '/vendor/stock/[id]', params: { id } };
}
