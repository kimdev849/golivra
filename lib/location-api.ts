import { apiFetch } from '@/lib/api';

export type Pays = {
  id: string;
  nom: string;
  code_iso2: string;
  code_iso3: string;
  indicatif: string | null;
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

export type LocationTree = {
  pays: Pays[];
  villes: Ville[];
  arrondissements: Arrondissement[];
};

/** Récupère tous les pays. */
export async function fetchPays(): Promise<Pays[]> {
  const data = await apiFetch<Pays[]>('/api/locations/pays', { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Récupère les villes d'un pays. */
export async function fetchVilles(paysId: string): Promise<Ville[]> {
  const data = await apiFetch<Ville[]>(`/api/locations/villes/${paysId}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Récupère les arrondissements d'une ville. */
export async function fetchArrondissements(villeId: string): Promise<Arrondissement[]> {
  const data = await apiFetch<Arrondissement[]>(`/api/locations/arrondissements/${villeId}`, { method: 'GET' });
  return Array.isArray(data) ? data : [];
}

/** Récupère l'arbre complet pays → villes → arrondissements en un seul appel. */
export async function fetchLocationTree(): Promise<LocationTree> {
  const data = await apiFetch<LocationTree>('/api/locations/tree', { method: 'GET' });
  return data ?? { pays: [], villes: [], arrondissements: [] };
}
