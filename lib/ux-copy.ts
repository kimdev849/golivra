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
  /** Réponse 404 « Cannot GET/PUT… » d'une API pas encore redéployée. */
  serverOutdated:
    "Cette fonction n'est pas encore disponible : le serveur n'est pas à jour. L'équipe doit redéployer l'API.",
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
    expiree: 'Expirée',
    en_attente_vendeur: 'En attente du commerce',
    probleme: 'Un problème est survenu',
    refusee: 'Refusée',
  };
  return map[key] ?? 'En cours';
}

/**
 * Message expliquant le remboursement sur une commande annulée / expirée.
 * Renvoie null si la commande n'est pas concernée par un remboursement.
 */
export function orderRefundMessage(statut: string | null | undefined): string | null {
  const key = normalizeStatutKey(statut);
  if (key === 'remboursee' || key === 'expiree') {
    return "Le restaurant n'a pas confirmé votre commande. Votre remboursement est en cours.";
  }
  if (key === 'refusee' || key === 'annulee') {
    return 'Cette commande a été annulée. Vous serez remboursé si le paiement a été effectué.';
  }
  return null;
}

/** Type de commerce affiché au client (parle comme une personne). */
export type CommerceKind = 'boutique' | 'restaurant' | 'commerce';

/** Les mots du commerce selon son type : « la boutique » / « le restaurant ». */
export function commerceKindWords(kind: CommerceKind | null | undefined): {
  word: string;
  Who: string;
  il: string;
  de: string;
} {
  const isBoutique = kind === 'boutique';
  const isResto = kind === 'restaurant';
  return {
    word: isBoutique ? 'la boutique' : isResto ? 'le restaurant' : 'le commerce',
    Who: isBoutique ? 'La boutique' : isResto ? 'Le restaurant' : 'Le commerce',
    il: isBoutique ? 'elle' : 'il',
    de: isBoutique ? 'de la boutique' : isResto ? 'du restaurant' : 'du commerce',
  };
}

/**
 * Raison d'une commande annulée, en langage simple (jamais technique).
 * no_response : le commerce n'a pas répondu à temps.
 * refused     : le commerce a refusé la commande.
 * unpaid      : acceptée mais le paiement n'a pas été fait.
 * client_cancel : le client a annulé lui-même.
 */
export type OrderCancellationReason =
  | 'no_response'
  | 'refused'
  | 'unpaid'
  | 'client_cancel'
  | 'unknown';

export function orderCancellationReason(
  statut: string | null | undefined,
  annulationMotif: string | null | undefined,
  sousStatuts?: string[] | null,
): OrderCancellationReason {
  const k = normalizeStatutKey(statut);
  const motif = String(annulationMotif || '').toLowerCase();
  if (k === 'remboursee' || k === 'expiree') return 'no_response';
  if (k === 'refusee') return 'refused';
  if (k === 'annulee') {
    if ((sousStatuts || []).includes('refusee')) return 'refused';
    if (motif.includes('paiement')) return 'unpaid';
    if (motif.includes('client')) return 'client_cancel';
    return 'unknown';
  }
  return 'unknown';
}

/** Étiquette courte + détail pour la liste « Mes commandes ». */
export function orderCancelledChip(
  statut: string | null | undefined,
  annulationMotif: string | null | undefined,
  kind: CommerceKind | null | undefined,
  sousStatuts?: string[] | null,
): { label: string; detail: string; tone: 'warn' | 'error' | 'neutral' } {
  const reason = orderCancellationReason(statut, annulationMotif, sousStatuts);
  const isResto = kind === 'restaurant';
  switch (reason) {
    case 'no_response':
      return {
        label: isResto ? 'Pas de réponse du restaurant' : 'Pas de réponse de la boutique',
        detail: "Nous n'avons pas reçu de réponse à temps.",
        tone: 'warn',
      };
    case 'refused':
      return {
        label: isResto ? 'Commande refusée par le restaurant' : 'Commande refusée',
        detail: isResto
          ? 'Le restaurant ne pouvait pas préparer cette commande.'
          : 'La boutique ne pouvait pas préparer cette commande.',
        tone: 'error',
      };
    case 'unpaid':
      return {
        label: 'Paiement non effectué',
        detail: "La commande avait été acceptée, mais le paiement n'a pas été finalisé.",
        tone: 'error',
      };
    case 'client_cancel':
      return {
        label: 'Commande annulée',
        detail: 'Vous avez annulé cette commande.',
        tone: 'neutral',
      };
    default:
      return {
        label: 'Commande annulée',
        detail: 'Cette commande a été annulée.',
        tone: 'neutral',
      };
  }
}

export type OrderStoryStep = { emoji: string; title: string; detail: string };

export type OrderCancelledInfo = {
  title: string;
  intro: string | null;
  body: string;
  note: string | null;
  steps: OrderStoryStep[];
};

/**
 * Toute l'histoire d'une commande annulée, racontée dans l'ordre et en mots
 * simples — même quelqu'un qui n'est pas à l'aise avec les applis comprend.
 * Renvoie null si la commande n'est pas annulée / remboursée / refusée.
 */
export function orderCancelledInfo({
  statut,
  annulationMotif,
  kind,
  sousStatuts,
  refusalReason,
}: {
  statut: string | null | undefined;
  annulationMotif: string | null | undefined;
  kind: CommerceKind | null | undefined;
  sousStatuts?: string[] | null;
  refusalReason?: string | null;
}): OrderCancelledInfo | null {
  const { Who, de, word } = commerceKindWords(kind);
  const key = normalizeStatutKey(statut);
  const isCancel =
    key === 'annulee' || key === 'refusee' || key === 'remboursee' || key === 'expiree';
  if (!isCancel) return null;
  const reason = orderCancellationReason(statut, annulationMotif, sousStatuts);
  if (reason === 'unknown') {
    // Annulée sans raison précise (ex. le commerce a annulé côté vendeur) :
    // message simple quand même — jamais « en préparation ».
    return {
      title: 'Commande annulée',
      intro: null,
      body: 'Cette commande a été annulée.',
      note: 'Vous pouvez essayer une autre boutique.',
      steps: [
        { emoji: '🛍️', title: 'Vous avez envoyé votre commande', detail: `${Who} a reçu votre demande.` },
        { emoji: '❌', title: 'Commande annulée', detail: 'Cette commande a été annulée.' },
      ],
    };
  }

  if (reason === 'no_response') {
    return {
      title: 'Commande non confirmée',
      intro: `Nous sommes désolés 😔\nNous avons attendu la réponse ${de} pendant 5 minutes, mais nous n'avons pas reçu de réponse.`,
      body: "Votre commande a donc été annulée automatiquement. Vous n'avez rien payé.",
      note: 'Vous pouvez essayer une autre boutique.',
      steps: [
        { emoji: '🛍️', title: 'Vous avez envoyé votre commande', detail: `${Who} a reçu votre demande.` },
        { emoji: '⏳', title: 'Nous avons attendu sa réponse', detail: `${Who} avait 5 minutes pour confirmer votre commande.` },
        {
          emoji: '❌',
          title: `${Who} n'a pas répondu`,
          detail: "Nous n'avons malheureusement pas reçu de réponse dans le délai prévu. Votre commande est donc annulée.",
        },
        { emoji: '💰', title: "Vous n'avez rien payé", detail: "Aucun montant n'a été débité." },
      ],
    };
  }

  if (reason === 'refused') {
    const { il } = commerceKindWords(kind);
    return {
      title: `${Who} ne peut pas préparer cette commande`,
      intro: `${Who} nous a informés qu'${il} ne pouvait pas préparer votre commande cette fois-ci.`,
      body: "Vous n'avez rien payé, votre commande est donc simplement annulée.",
      note: refusalReason ? `${Who} nous précise :\n« ${refusalReason} »` : null,
      steps: [
        { emoji: '🛍️', title: 'Vous avez envoyé votre commande', detail: `${Who} a reçu votre demande.` },
        { emoji: '⏳', title: 'Nous avons attendu sa réponse', detail: `${Who} avait 5 minutes pour confirmer votre commande.` },
        {
          emoji: '❌',
          title: `${Who} a refusé la commande`,
          detail: `${Who} ne pouvait pas préparer cette commande cette fois-ci.`,
        },
        { emoji: '💰', title: "Vous n'avez rien payé", detail: "Aucun montant n'a été débité." },
      ],
    };
  }

  if (reason === 'unpaid') {
    return {
      title: "Votre commande n'a pas été finalisée",
      intro: `Bonne nouvelle, ${word} avait bien accepté votre commande 😊`,
      body: "Cependant, le paiement n'a pas été effectué dans le délai prévu. La commande a donc été annulée. Aucun montant n'a été débité.",
      note: null,
      steps: [
        { emoji: '🛍️', title: 'Vous avez envoyé votre commande', detail: `${Who} a reçu votre demande.` },
        { emoji: '✅', title: `${Who} a accepté votre commande`, detail: 'Bonne nouvelle, votre commande a bien été acceptée.' },
        { emoji: '💳', title: "Le paiement n'a pas été finalisé", detail: 'Le délai pour payer a été dépassé.' },
        { emoji: '💰', title: "Vous n'avez rien payé", detail: "Aucun montant n'a été débité." },
      ],
    };
  }

  // client_cancel
  return {
    title: 'Vous avez annulé votre commande',
    intro: null,
    body: 'Votre commande a bien été annulée. Aucun paiement ne sera effectué pour cette commande.',
    note: null,
    steps: [
      { emoji: '🛍️', title: 'Vous avez envoyé votre commande', detail: `${Who} a reçu votre demande.` },
      {
        emoji: '❌',
        title: 'Vous avez annulé votre commande',
        detail: 'Aucun paiement ne sera effectué pour cette commande.',
      },
    ],
  };
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
  if (/cannot (get|put|post|patch|delete)\b/i.test(lower)) {
    return UX_ERRORS.serverOutdated;
  }
  // PATCH temps de préparation : l'API déployée ne reconnaît aucun champ du
  // corps de la requête → version serveur obsolète, le redéploiement est requis.
  if (/aucune modification à enregistrer|aucun champ reconnu/i.test(lower)) {
    return UX_ERRORS.serverOutdated;
  }
  if (/route api|endpoint api|erreur http|réponse html|backend render|base api/i.test(lower)) {
    return UX_ERRORS.generic;
  }
  if (/session expirée|session révoquée|jeton|token|unauthorized|401/i.test(lower)) {
    return UX_ERRORS.session;
  }
  if (/mot de passe|credentials|identifiant|403 forbidden/i.test(lower) && /incorrect|invalide|refus/i.test(lower)) {
    return UX_ERRORS.auth;
  }
  if (/otp|code.*sms|vérification/i.test(lower) && (/invalide|expir|introuvable|incorrect/i.test(lower))) {
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

  // Identifiant technique type snake_case (ex. "enterprise_already_exists") : on le montre tel quel
  // pour que le dev puisse le tracer, plutôt que de masquer derrière le générique.
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(lower)) {
    return trimmed;
  }

  if (trimmed.length > 180) {
    return trimmed.slice(0, 177) + '…';
  }

  return trimmed;
}
