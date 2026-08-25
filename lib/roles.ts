import type { Href } from 'expo-router';

/** Rôles professionnels (accès espace vendeur). */
export function isMerchantRole(role: string | null | undefined): boolean {
  return role === 'restaurateur' || role === 'commercant';
}

/** Livreur GoLivra (espace courses). */
export function isCourierRole(role: string | null | undefined): boolean {
  return role === 'livreur';
}

/** Gestionnaire logistique (centre opérationnel). */
export function isLogisticsRole(role: string | null | undefined): boolean {
  return role === 'gestionnaire_logistique';
}

/** Route d'accueil après connexion selon le rôle. */
export function homeHrefForRole(role: string | null | undefined): Href {
  if (isLogisticsRole(role)) return '/logistics';
  if (isMerchantRole(role)) return '/vendor';
  if (isCourierRole(role)) return '/courier';
  return '/(tabs)';
}
