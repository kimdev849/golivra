/**
 * Textes utilisateur — simples, cohérents, sans jargon technique.
 * Une idée = une phrase. Ne jamais exposer les clés backend (snake_case).
 */

export const UX_ERRORS: Readonly<Record<string, string>> = {
  network: 'Problème de connexion. Vérifiez votre internet.',
  generic: 'Une erreur est survenue. Réessayez.',
  auth: 'Numéro ou mot de passe incorrect.',
  otp: 'Code invalide ou expiré.',
  session: 'Reconnectez-vous pour continuer.',
  notFound: 'Élément introuvable.',
  forbidden: 'Action non autorisée.',
};

export const UX_ONBOARDING = [
  {
    title: 'Commandez facilement autour de vous',
    subtitle: 'Restaurants, boutiques et services livrés chez vous.',
  },
  {
    title: 'Livraison rapide et simple',
    subtitle: 'Suivez votre commande en temps réel.',
  },
  {
    title: 'Tout en un seul endroit',
    subtitle: 'Mangez, achetez, recevez.',
  },
] as const;

export function normalizeStatutKey(statut: string | null | undefined): string {
  return (statut ?? '').trim().toLowerCase().replace(/-/g, '_');
}

/** Statut commande côté client (accueil, mes commandes). */
export function orderStatusLabel(statut: string | null | undefined): string {
  if (!statut?.trim()) return 'En cours';
  const key = normalizeStatutKey(statut);
  const map: Record<string, string> = {
    en_attente: 'En attente',
    commande_creee: 'Commande envoyée',
    partiellement_acceptee: 'Certains commerces ont accepté',
    acceptee: 'Acceptée',
    en_preparation: 'En préparation',
    prete: 'Prête',
    en_livraison: 'En livraison',
    livree: 'Livrée',
    partiellement_livree: 'Une partie est déjà livrée',
    annulee: 'Annulée',
    remboursee: 'Remboursée',
    en_attente_vendeur: 'En attente du commerce',
    probleme: 'Un problème est survenu',
    refusee: 'Refusée',
  };
  return map[key] ?? 'En cours';
}

/** Statut commande côté vendeur. */
export function vendorOrderStatusLabel(statut: string | null | undefined): string {
  const key = normalizeStatutKey(statut) as string;
  const map: Record<string, string> = {
    en_attente: 'Nouvelle commande',
    acceptee: 'Acceptée',
    a_preparer: 'À préparer',
    en_preparation: 'En préparation',
    prete: 'Prête pour le livreur',
    en_livraison: 'En livraison',
    livree: 'Livrée',
    annulee: 'Annulée',
    refusee: 'Refusée',
  };
  return map[key] ?? 'En cours';
}

/** Suivi livraison côté vendeur. */
export function deliveryTrackingLabel(statut: string | null | undefined): string {
  const key = normalizeStatutKey(statut);
  const map: Record<string, string> = {
    en_attente: 'En attente d’un livreur',
    attribuee: 'Livreur en route vers vous',
    assignee: 'Livreur en route vers vous',
    en_collecte: 'Le livreur arrive',
    collectee: 'Commande récupérée',
    en_route: 'En route vers le client',
    livree: 'Livrée',
    echec: 'Livraison impossible',
    annulee: 'Annulée',
  };
  return map[key] ?? 'Suivi en cours';
}

/** Statut course côté livreur. */
export function courierMissionStatusLabel(statut: string | null | undefined): string {
  const key = normalizeStatutKey(statut);
  const map: Record<string, string> = {
    en_attente: 'Disponible',
    attribuee: 'À récupérer',
    assignee: 'À récupérer',
    en_collecte: 'Récupération',
    collectee: 'Récupérée',
    en_route: 'En livraison',
    en_cours: 'En livraison',
    livree: 'Terminée',
    terminee: 'Terminée',
    annulee: 'Annulée',
    echec: 'Annulée',
  };
  return map[key] ?? 'En cours';
}

const BACKEND_MESSAGE_MAP: Record<string, string> = {
  'sous-commande introuvable': 'Commande introuvable.',
  'statut de sous-commande non pris en charge': UX_ERRORS.generic,
  'statut de commande principal non pris en charge': UX_ERRORS.generic,
  'aucune sous-commande pour cet établissement': 'Aucune commande pour votre commerce.',
  'jeton de session invalide': UX_ERRORS.session,
  'session révoquée': UX_ERRORS.session,
  'en-tête authorization manquant': UX_ERRORS.session,
  'action non autorisée': UX_ERRORS.forbidden,
  'établissement introuvable': 'Commerce introuvable.',
};

/** Transforme un message technique (API / backend) en texte lisible. */
export function friendlyErrorMessage(raw: unknown, fallback: string = UX_ERRORS.generic): string {
  const msg = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  const trimmed = msg.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  if (/network request failed|failed to fetch|unable to resolve host|econnrefused|timeout|connexion impossible/i.test(lower)) {
    return UX_ERRORS.network;
  }
  if (/route api|endpoint api|erreur http|réponse html|backend render|base api|cannot post/i.test(lower)) {
    return UX_ERRORS.generic;
  }
  if (/session expirée|session révoquée|jeton|token|unauthorized|401/i.test(lower)) {
    return UX_ERRORS.session;
  }
  if (/mot de passe|credentials|identifiant|403 forbidden/i.test(lower) && /incorrect|invalide|refus/i.test(lower)) {
    return UX_ERRORS.auth;
  }
  if (/otp|code.*sms|vérification/i.test(lower) && /invalide|expir/i.test(lower)) {
    return UX_ERRORS.otp;
  }
  if (/sous-commande|sous_commande/i.test(lower)) {
    for (const [needle, replacement] of Object.entries(BACKEND_MESSAGE_MAP)) {
      if (lower.includes(needle)) return replacement;
    }
    return 'Problème avec cette commande. Réessayez.';
  }

  for (const [needle, replacement] of Object.entries(BACKEND_MESSAGE_MAP)) {
    if (lower.includes(needle)) return replacement;
  }

  if (/^[a-z]+(_[a-z]+)+$/.test(lower)) {
    return fallback;
  }

  if (trimmed.length > 120) return fallback;

  return trimmed;
}
