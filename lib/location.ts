/**
 * API client pour le référentiel géographique (pays / villes).
 */

import { apiFetch } from '@/lib/api';

export type Pays = {
  id: string;
  nom: string;
  code_iso2: string;
  code_iso3: string;
  indicatif: string | null;
  phone_digits: number | null;
  phone_format: string | null;
};

export type Ville = {
  id: string;
  pays_id: string;
  nom: string;
  sort_order: number;
};

export type Arrondissement = {
  id: string;
  ville_id: string;
  nom: string;
  zone_id: string | null;
  sort_order: number;
};

export type DetectResult = {
  ip: string;
  pays: Pays | null;
  villes: Ville[];
  detected_ville: string | null;
  ville_suggestion: Ville | null;
};

/** Liste tous les pays disponibles. */
export async function fetchPays(): Promise<Pays[]> {
  const data = await apiFetch<Pays[]>('/api/locations/pays', { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Liste les villes d'un pays. */
export async function fetchVillesByPays(paysId: string): Promise<Ville[]> {
  const data = await apiFetch<Ville[]>(`/api/locations/villes/${paysId}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Liste les arrondissements d'une ville. */
export async function fetchArrondissementsByVille(villeId: string): Promise<Arrondissement[]> {
  const data = await apiFetch<Arrondissement[]>(`/api/locations/arrondissements/${villeId}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Détection de localisation par IP. */
export async function detectLocation(): Promise<DetectResult> {
  return apiFetch<DetectResult>('/api/locations/detect', { method: 'GET' });
}
