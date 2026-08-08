import { apiFetch } from '@/lib/api';
import { fetchEnterpriseCategories as fetchEnterpriseCategoriesCached } from '@/lib/client-data';

export type EnterprisePayload = {
  nom: string;
  type: 'restaurant' | 'boutique';
  categorieId: string;
  description?: string | null;
  telephone: string;
  /** Adresse détaillée. Requise pour les restaurants, OPTIONNELLE pour les boutiques (e-commerce). */
  adresse?: string;
  /** URL publique (Supabase Storage) après upload. */
  imageUrl?: string | null;
  /** Secours si l’upload Storage échoue : enregistrement BYTEA côté API. */
  imageDataUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type EnterpriseCategory = {
  id: string;
  nom: string;
  description?: string | null;
  ordre?: number;
};

const FALLBACK_CATEGORIES: Record<string, EnterpriseCategory[]> = {
  restaurant: [
    { id: 'resto-1', nom: 'Cuisine africaine', ordre: 1 },
    { id: 'resto-2', nom: 'Fast-food / Snacks', ordre: 2 },
    { id: 'resto-3', nom: 'Pizzeria', ordre: 3 },
    { id: 'resto-4', nom: 'Grill / Brochettes', ordre: 4 },
    { id: 'resto-5', nom: 'Café / Salon de thé', ordre: 5 },
    { id: 'resto-6', nom: 'Pâtisserie / Boulangerie', ordre: 6 },
    { id: 'resto-7', nom: 'Cuisine asiatique', ordre: 7 },
    { id: 'resto-8', nom: 'Cuisine libanaise', ordre: 8 },
    { id: 'resto-9', nom: 'Gastronomique', ordre: 9 },
  ],
  boutique: [
    { id: 'bout-1', nom: 'Mode & Vêtements', ordre: 1 },
    { id: 'bout-2', nom: 'Épicerie & Alimentation', ordre: 2 },
    { id: 'bout-3', nom: 'Technologies & Électronique', ordre: 3 },
    { id: 'bout-4', nom: 'Beauté & Bien-être', ordre: 4 },
    { id: 'bout-5', nom: 'Maison & Décoration', ordre: 5 },
    { id: 'bout-6', nom: 'Sport & Loisirs', ordre: 6 },
    { id: 'bout-7', nom: 'Bijoux & Accessoires', ordre: 7 },
    { id: 'bout-8', nom: 'Librairie / Papeterie', ordre: 8 },
    { id: 'bout-9', nom: 'Autre', ordre: 9 },
  ],
};

export async function fetchEnterpriseCategories(
  type: 'restaurant' | 'boutique',
  force = false
): Promise<EnterpriseCategory[]> {
  try {
    return await fetchEnterpriseCategoriesCached(type, force);
  } catch {
    return FALLBACK_CATEGORIES[type] ?? [];
  }
}

/** Réponse API après création d’entreprise. */
export type EnterpriseCreated = {
  id: string;
  statut_moderation?: 'en_attente' | 'active' | 'suspendu' | 'suspendue' | string | null;
  nom?: string | null;
  type?: string | null;
  description?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  adresse_quartier?: string | null;
  adresse_ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categorie_nom?: string | null;
  ouvert?: boolean;
  image_url?: string | null;
  livraison_propre?: boolean;
  delai_preparation_min?: number;
  delai_livraison_min?: number;
};

export async function createEnterpriseRemote(token: string, body: EnterprisePayload): Promise<EnterpriseCreated> {
  return apiFetch<EnterpriseCreated>('/api/enterprises', {
    method: 'POST',
    token,
    jsonBody: body,
  });
}

export async function fetchMyEnterprises(token: string): Promise<EnterpriseCreated[]> {
  const data = await apiFetch<EnterpriseCreated[]>('/api/enterprises/mine', { method: 'GET', token });
  return Array.isArray(data) ? data : [];
}

export type EnterprisePatchBody = {
  nom?: string;
  description?: string | null;
  telephone?: string;
  adresse?: string;
  adresseQuartier?: string | null;
  adresseVille?: string;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  /** Secours si l’upload Storage échoue (enregistrement direct en base). */
  imageDataUrl?: string | null;
  /** Temps de préparation (min) — restaurant → delai_preparation_min, boutique → delai_livraison_min. */
  delaiPreparationMin?: number;
  /** Variantes snake_case du nom de colonne (rétrocompatibilité : certaines versions d'API ne lisaient que ces noms). */
  delai_preparation_min?: number;
  delai_livraison_min?: number;
};

export async function patchEnterprise(
  token: string,
  enterpriseId: string,
  body: EnterprisePatchBody,
): Promise<EnterpriseCreated> {
  return apiFetch<EnterpriseCreated>(`/api/enterprises/${enterpriseId}`, {
    method: 'PATCH',
    token,
    jsonBody: body,
  });
}

export type EnterpriseHoraires = {
  jour: number;
  ouverture: string | null;
  fermeture: string | null;
};

export type EnterpriseHorairesPayload = {
  horaires: EnterpriseHoraires[];
};

export async function fetchEnterpriseHoraires(
  token: string,
  enterpriseId: string,
): Promise<EnterpriseHoraires[]> {
  const data = await apiFetch<{ horaires: EnterpriseHoraires[] }>(
    `/api/enterprises/${enterpriseId}/horaires`,
    { method: 'GET', token },
  );
  return Array.isArray(data?.horaires) ? data.horaires : [];
}

export async function saveEnterpriseHoraires(
  token: string,
  enterpriseId: string,
  horaires: EnterpriseHoraires[],
): Promise<EnterpriseHoraires[]> {
  const data = await apiFetch<{ horaires: EnterpriseHoraires[] }>(
    `/api/enterprises/${enterpriseId}/horaires`,
    { method: 'PUT', token, jsonBody: { horaires } },
  );
  return Array.isArray(data?.horaires) ? data.horaires : [];
}
