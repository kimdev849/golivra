/**
 * API client pour les campagnes marketing (merchandising).
 * Utilisé par l'app mobile pour afficher l'offre du jour et les campagnes actives.
 */
import { apiFetch } from '@/lib/api';

export type CampaignVille = {
  id: string;
  nom: string;
};

export type MarketingCampaign = {
  id: string;
  nom: string;
  description: string | null;
  type: string;
  image_url: string | null;
  date_debut: string | null;
  date_fin: string | null;
  villes: CampaignVille[];
};

/**
 * Récupère les campagnes actives pour l'affichage sur l'accueil.
 * @param villeId - Optionnel, filtre par ville pour la pertinence locale
 */
export async function fetchActiveCampaigns(villeId?: string | null): Promise<MarketingCampaign[]> {
  const qs = villeId ? `?ville_id=${encodeURIComponent(villeId)}` : '';
  const data = await apiFetch<MarketingCampaign[]>(`/api/campaigns/active${qs}`, {
    method: 'GET',
    skipIncidentReport: true,
  });
  return Array.isArray(data) ? data : [];
}
