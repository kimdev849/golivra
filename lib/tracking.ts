import { apiFetch } from './api';
import { getSessionToken } from './auth';

export type InteractionType = 
  | 'view_product' 
  | 'view_enterprise' 
  | 'search' 
  | 'category_click' 
  | 'add_to_cart';

export type TargetType = 'product' | 'restaurant' | 'boutique' | 'category';

export interface InteractionParams {
  type: InteractionType;
  targetId?: string;
  targetType?: TargetType;
  categoryId?: string;
  metadata?: Record<string, any>;
}

/**
 * Envoie une interaction utilisateur au backend pour la personnalisation algorithmique.
 * Échoue silencieusement pour ne pas perturber l'expérience utilisateur.
 */
export async function trackInteraction(params: InteractionParams) {
  try {
    const token = await getSessionToken();
    if (!token) return; // Pas de tracking pour les anonymes (conformité RGPD simplifiée)

    await apiFetch('/track/interaction', {
      method: 'POST',
      token,
      jsonBody: params,
    });
  } catch (error) {
    // On ignore les erreurs de tracking
    console.warn('[Tracking Error]', error);
  }
}
