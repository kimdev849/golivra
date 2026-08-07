/**
 * API client pour le référentiel géographique (pays / villes)
 * + capture GPS silencieuse de la position actuelle.
 */

import * as Location from 'expo-location';

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

/**
 * Capture la position GPS courante (best-effort, jamais bloquante).
 * - Demande la permission si nécessaire (boîte de dialogue native).
 * - Retourne `null` si l'utilisateur refuse, si le GPS échoue ou après 8 s max.
 * À utiliser en arrière-plan lors de l'enregistrement d'une adresse.
 */
export async function captureCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  // Timeout qui absorbe aussi les rejets tardifs (pas de rejet non géré).
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      p.then(
        (v) => { clearTimeout(timer); resolve(v); },
        () => { clearTimeout(timer); resolve(null); },
      );
    });

  try {
    const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 6000);
    if (permission?.status !== 'granted') return null;
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      8000,
    );
    if (!pos?.coords || !Number.isFinite(pos.coords.latitude) || !Number.isFinite(pos.coords.longitude)) {
      return null;
    }
    return {
      latitude: Number(pos.coords.latitude.toFixed(8)),
      longitude: Number(pos.coords.longitude.toFixed(8)),
    };
  } catch {
    return null;
  }
}
