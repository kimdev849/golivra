import { apiFetch } from '@/lib/api';
import type { DeliveryAddressFields } from '@/lib/format-address';

export type UserAddress = DeliveryAddressFields & {
  id: string;
  libelle?: string | null;
  type?: string;
  ligne2?: string | null;
  est_principale?: boolean;
  created_at?: string;
  updated_at?: string;
};

export async function fetchUserAddresses(token: string): Promise<UserAddress[]> {
  const data = await apiFetch<UserAddress[]>('/api/addresses', { method: 'GET', token });
  return Array.isArray(data) ? data : [];
}

export type AddressBody = DeliveryAddressFields & {
  est_principale?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export async function createUserAddress(
  token: string,
  body: AddressBody,
): Promise<UserAddress> {
  return apiFetch<UserAddress>('/api/addresses', { method: 'POST', token, jsonBody: body });
}

export async function updateUserAddress(
  token: string,
  addressId: string,
  body: Partial<AddressBody>,
): Promise<UserAddress> {
  return apiFetch<UserAddress>(`/api/addresses/${addressId}`, {
    method: 'PATCH',
    token,
    jsonBody: body,
  });
}

export async function deleteUserAddress(token: string, addressId: string): Promise<void> {
  await apiFetch(`/api/addresses/${addressId}`, { method: 'DELETE', token });
}

export async function setPrincipalAddress(token: string, addressId: string): Promise<UserAddress> {
  return apiFetch<UserAddress>(`/api/addresses/${addressId}/principal`, {
    method: 'POST',
    token,
  });
}
