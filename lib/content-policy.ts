/**
 * Règles de contenu GoLivra — annonces produits / plats.
 * Miroir backend : `golivra-backendcd/lib/content-policy.js`
 */

import type { ValidationResult } from '@/lib/form-validation';
import { sanitizeText } from '@/lib/form-validation';

const ok = (): ValidationResult => ({ ok: true, value: '' });
const fail = (message: string): ValidationResult => ({ ok: false, message });

const URL_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[\w-]+\.(com|fr|org|net|io|co|cg|info|biz|me|app|link|shop|store|tv|xyz|dev|site|online|pro|live|click|ly)\b/i,
  /\bt\.me\b/i,
  /\bwa\.me\b/i,
  /\bbit\.ly\b/i,
  /\btinyurl\.com\b/i,
  /\binstagram\.com\b/i,
  /\bfacebook\.com\b/i,
  /\btiktok\.com\b/i,
  /\bsnapchat\.com\b/i,
  /\bwhatsapp\.com\b/i,
  /\byoutube\.com\b/i,
  /\blinkedin\.com\b/i,
  /\bx\.com\b/i,
  /\btwitter\.com\b/i,
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Numéros / contacts hors plateforme (Congo + formats courants). */
const PHONE_PATTERNS = [
  /\+242[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/,
  /\b0[456]\d[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b/,
  /\b\d{3}[\s.-]\d{3}[\s.-]\d{3,4}\b/,
  /\b(?:tel|tél|phone|whatsapp|appel(?:ez)?|contact(?:ez)?)\s*[:\-]?\s*\+?\d/i,
];

/** Contenu adulte, arnaques ou hors cadre marketplace alimentaire / commerce local. */
const PROHIBITED_TERMS = [
  'porn', 'porno', 'pornograph', 'xxx', 'onlyfans', 'nude', 'nudité', 'nudite', 'nu(e)?\\s+(?:sur|photo|pic)',
  'sexe\\s+(?:gratuit|payant|cam)', 'escort', 'prostitu', 'nudisme',
  'arnaque', 'escroquerie', 'crypto\\s+gratuit', 'double\\s+votre\\s+argent',
  'viagra', 'casino\\s+en\\s+ligne', 'pari\\s+sportif',
];

const PROHIBITED_REGEXES = PROHIBITED_TERMS.map((t) => new RegExp(`\\b${t}`, 'iu'));

export function containsExternalLink(text: string): boolean {
  const v = text.trim();
  if (!v) return false;
  return URL_PATTERNS.some((re) => re.test(v));
}

export function containsEmail(text: string): boolean {
  return EMAIL_PATTERN.test(text.trim());
}

export function containsPhoneContact(text: string): boolean {
  const v = text.trim();
  if (!v) return false;
  return PHONE_PATTERNS.some((re) => re.test(v));
}

export function containsProhibitedContent(text: string): boolean {
  const v = text.trim().toLowerCase();
  if (!v) return false;
  return PROHIBITED_REGEXES.some((re) => re.test(v));
}

export type ListingTextOptions = {
  fieldLabel?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  allowEmpty?: boolean;
};

/**
 * Valide un texte d'annonce (nom, description, tag, option…).
 * Bloque liens, emails, téléphones et contenus interdits.
 */
export function validateListingText(raw: string, opts: ListingTextOptions = {}): ValidationResult {
  const {
    fieldLabel = 'Ce champ',
    required = false,
    minLength = 0,
    maxLength = 500,
    allowEmpty = !required,
  } = opts;

  const v = sanitizeText(raw);

  if (v.length === 0) {
    return allowEmpty ? { ok: true, value: '' } : fail(`${fieldLabel} est requis.`);
  }
  if (minLength > 0 && v.length < minLength) {
    return fail(`${fieldLabel} : ${minLength} caractères minimum.`);
  }
  if (v.length > maxLength) {
    return fail(`${fieldLabel} : maximum ${maxLength} caractères.`);
  }
  if (containsExternalLink(v)) {
    return fail('Les liens et réseaux sociaux ne sont pas autorisés dans les annonces.');
  }
  if (containsEmail(v)) {
    return fail('Les adresses e-mail ne sont pas autorisées — utilisez la messagerie GoLivra.');
  }
  if (containsPhoneContact(v)) {
    return fail('Les numéros de téléphone ne sont pas autorisés dans les annonces.');
  }
  if (containsProhibitedContent(v)) {
    return fail('Ce contenu ne respecte pas les règles de la plateforme.');
  }
  return { ok: true, value: v };
}

export function validateListingDescription(raw: string, max = 500): ValidationResult {
  const v = sanitizeText(raw);
  if (v.length === 0) return { ok: true, value: '' };
  return validateListingText(v, {
    fieldLabel: 'La description',
    minLength: 10,
    maxLength: max,
    allowEmpty: true,
  });
}

export function validateListingTagsText(raw: string): ValidationResult {
  const v = sanitizeText(raw);
  if (v.length === 0) return { ok: true, value: '' };

  const tags = v
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (tags.length > 10) {
    return fail('Maximum 10 tags.');
  }

  for (const tag of tags) {
    if (tag.length < 2) return fail(`Tag trop court : « ${tag} ».`);
    if (tag.length > 30) return fail(`Tag trop long : « ${tag.slice(0, 20)}… ».`);
    const check = validateListingText(tag, { fieldLabel: `Le tag « ${tag} »`, maxLength: 30 });
    if (!check.ok) return check;
  }

  return { ok: true, value: v };
}

export function validateListingBrand(raw: string): ValidationResult {
  const v = sanitizeText(raw);
  if (v.length === 0) return { ok: true, value: '' };
  return validateListingText(v, { fieldLabel: 'La marque', minLength: 2, maxLength: 60, allowEmpty: true });
}

export type OptionGroupInput = { nom: string; choix: { label: string; prix_sup?: number }[] };

export function validateListingOptionGroups(groups: OptionGroupInput[]): ValidationResult {
  if (!groups.length) return ok();

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const nom = sanitizeText(g.nom ?? '');
    if (!nom) {
      return fail(`Nom manquant pour le groupe d'options ${i + 1}.`);
    }
    const nomCheck = validateListingText(nom, { fieldLabel: `Le groupe « ${nom} »`, minLength: 2, maxLength: 40 });
    if (!nomCheck.ok) return nomCheck;

    const choix = (g.choix ?? []).filter((c) => sanitizeText(c.label ?? '').length > 0);
    if (choix.length === 0) {
      return fail(`Ajoutez au moins un choix pour « ${nom} ».`);
    }
    for (const c of choix) {
      const labelCheck = validateListingText(c.label, {
        fieldLabel: `L'option « ${c.label} »`,
        minLength: 1,
        maxLength: 60,
      });
      if (!labelCheck.ok) return labelCheck;
    }
  }

  return ok();
}

/** Règles affichées aux vendeurs (UI). */
export const LISTING_RULES = [
  'Photos réelles du produit ou du plat (pas de contenu choquant).',
  'Pas de liens, réseaux sociaux, e-mails ou numéros de téléphone.',
  'Description honnête : ingrédients, état, contenu du colis.',
  'Prix en FCFA, cohérent avec ce que le client recevra.',
] as const;
