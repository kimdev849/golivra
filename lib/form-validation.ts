/**
 * Validateurs GoLivra + helpers d'auto-correction.
 *
 * Trois principes :
 *   1. Refus explicite des saisies absurdes (numériques pures, ponctuation, symboles, etc.).
 *   2. Messages d'erreur pédagogiques qui disent au user *pourquoi* c'est refusé.
 *   3. Auto-correction cosmétique (trim, espaces doubles, casse normalisée) avant validation.
 *
 * Le backend doit revalider ces mêmes règles — voir `golivra-backendcd/src/lib/validators.ts`.
 */

export type ValidationResult = { ok: true; value: string } | { ok: false; message: string };

const ok = (value: string): ValidationResult => ({ ok: true, value });
const fail = (message: string): ValidationResult => ({ ok: false, message });

/* --------------------- RÈGLES GÉNÉRALES (tous champs "nom") --------------------- */

const NUMERIC_ONLY_REGEX = /^[0-9\s]+$/;
const PUNCTUATION_ONLY_REGEX = /^[\s\.\-_/\\,;:'"!?@#$%^&*()+=<>[\]{}|`~*]+$/;
const EMOJI_ONLY_REGEX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u;
const HAS_LETTER_REGEX = /\p{L}/u;
const HAS_DIGIT_REGEX = /\d/;
const DOUBLE_SPACE_REGEX = /\s{2,}/;
const NAME_REGEX_PERSON = /^[\p{L}][\p{L}\p{M}\s'’\-.]{0,79}$/u;
const NAME_REGEX_COMMERCE = /^[\p{L}0-9][\p{L}\p{M}\s'’\-.,&()]{0,79}$/u;
const NAME_REGEX_PRODUCT = /^[\p{L}0-9][\p{L}\p{M}0-9\s'’\-.,()/&°]{0,99}$/u;
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const STRICT_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
const OTP_REGEX = /^[0-9]{6}$/;

/* --------------------- HELPERS D'AUTO-CORRECTION --------------------- */

/**
 * Nettoie une chaîne saisie : trim + retire espaces doubles + casse titre.
 * N'altère pas le contenu, seulement la présentation.
 */
export function sanitizeText(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const collapsed = trimmed.replace(DOUBLE_SPACE_REGEX, ' ');
  return collapseSpaces(collapsed);
}

function collapseSpaces(s: string): string {
  return s.split(' ').filter((w) => w.length > 0).join(' ');
}

/** Capitalise la première lettre de chaque mot (pour les noms, commerces). */
export function titleCase(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length === 0 ? w : w[0].toLocaleUpperCase() + w.slice(1)))
    .join(' ');
}

/** Garde la casse si elle est significative (acronymes, sigles), sinon title case. */
export function smartTitleCase(s: string): string {
  if (!s) return '';
  if (s === s.toUpperCase() && /[A-Z]{2,}/.test(s)) return s;
  return titleCase(s);
}

/* --------------------- VALIDATEURS NOMS --------------------- */

export function validatePersonName(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Indiquez votre nom.');
  if (v.length < 2) return fail('Le nom doit contenir au moins 2 caractères.');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Un nom ne peut pas être uniquement des chiffres.');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Un nom ne peut pas être uniquement de la ponctuation.');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Un nom ne peut pas être uniquement des emojis.');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Le nom doit contenir au moins une lettre.');
  if (!NAME_REGEX_PERSON.test(v)) return fail('Ce champ n\'accepte que des lettres, espaces, tirets et apostrophes (ex. Jean-Claude).');
  return ok(titleCase(v));
}

export function validateCommerceName(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Indiquez le nom du commerce.');
  if (v.length < 2) return fail('Le nom du commerce doit contenir au moins 2 caractères.');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Un nom de commerce ne peut pas être uniquement des chiffres.');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Un nom de commerce ne peut pas être uniquement de la ponctuation.');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Un nom de commerce ne peut pas être uniquement des emojis.');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Le nom du commerce doit contenir au moins une lettre.');
  if (!NAME_REGEX_COMMERCE.test(v)) return fail('Ce champ n\'accepte que des lettres, chiffres, espaces, tirets, &, parenthèses et virgules.');
  return ok(smartTitleCase(v));
}

export function validateProductName(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Indiquez le nom du produit.');
  if (v.length < 2) return fail('Le nom du produit doit contenir au moins 2 caractères.');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Un nom de produit ne peut pas être uniquement des chiffres (ex. « 123 » est interdit).');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Un nom de produit ne peut pas être uniquement de la ponctuation (ex. « !!! » est interdit).');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Un nom de produit ne peut pas être uniquement des emojis.');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Le nom du produit doit contenir au moins une lettre (ex. « Poulet braisé », « Coca Cola 33cl »).');
  if (!NAME_REGEX_PRODUCT.test(v)) return fail('Caractères non autorisés.');
  return ok(smartTitleCase(v));
}

/* --------------------- VALIDATEURS CONTACT --------------------- */

import { detectCountryCode, getCachedCountryByIndicatif, initPhoneCountries } from '@/lib/phone';

/**
 * Valide un numéro de téléphone de façon dynamique selon le pays détecté.
 * @param value     Numéro saisi (avec indicatif)
 * @param indicatif Indicatif forcé si déjà connu (ex. depuis la sélection pays)
 */
export function validatePhone(value: string, indicatif?: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Numéro de téléphone requis.');
  if (!HAS_DIGIT_REGEX.test(v)) return fail('Le numéro doit contenir des chiffres.');

  const activeIndicatif = indicatif || detectCountryCode(v);

  // Récupérer les infos téléphone du pays depuis le cache
  const country = getCachedCountryByIndicatif(activeIndicatif);
  const expectedDigits = country?.phone_digits ?? 9;
  const prefixDigits = activeIndicatif.replace(/\D/g, '');
  const allDigits = v.replace(/\D/g, '');
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + expectedDigits)
    : allDigits.slice(0, expectedDigits);

  if (nationalDigits.length !== expectedDigits) {
    const example = generateExample(activeIndicatif, expectedDigits);
    return fail(`Format attendu : ${example}`);
  }
  if (!/^\d+$/.test(nationalDigits)) {
    return fail('Le numéro doit contenir uniquement des chiffres.');
  }

  return ok(v);
}

/** Génère un exemple de format pour l'indicatif donné (basé sur phone_digits de l'API). */
function generateExample(indicatif: string, digits: number): string {
  const xs = 'X'.repeat(Math.min(digits, 12));
  return `${indicatif} ${xs}`;
}

/**
 * @deprecated Utilisez `validatePhone(value, indicatif)` à la place.
 */
export function validatePhoneCg(value: string): ValidationResult {
  return validatePhone(value, '+242');
}

export function validateEmailOptional(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return ok('');
  if (!EMAIL_REGEX.test(v)) return fail('Email invalide (ex. exemple@domaine.com).');
  return ok(v.toLowerCase());
}

export function validateEmailRequired(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Email requis.');
  if (!EMAIL_REGEX.test(v)) return fail('Email invalide (ex. exemple@domaine.com).');
  return ok(v.toLowerCase());
}

/* --------------------- VALIDATEURS MOT DE PASSE --------------------- */

export function validatePassword(value: string): ValidationResult {
  if (value.length === 0) return fail('Mot de passe requis.');
  if (value.length < 6) return fail('Le mot de passe doit contenir au moins 6 caractères.');
  if (!STRICT_PASSWORD_REGEX.test(value)) return fail('Le mot de passe doit contenir au moins 1 lettre et 1 chiffre.');
  return ok(value);
}

export function validatePasswordConfirmation(value: string, original: string): ValidationResult {
  if (value.length === 0) return fail('Confirmez le mot de passe.');
  if (value !== original) return fail('Les mots de passe ne correspondent pas.');
  return ok(value);
}

/* --------------------- VALIDATEURS ADRESSE --------------------- */

export function validateAddress(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) {
    return required ? fail('Adresse requise.') : ok('');
  }
  if (v.length < 5) return fail('Adresse trop courte (5 caractères minimum).');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Une adresse ne peut pas être uniquement des chiffres.');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Une adresse ne peut pas être uniquement de la ponctuation.');
  if (!HAS_LETTER_REGEX.test(v)) return fail('L\'adresse doit contenir au moins une lettre (rue, repère ou quartier).');
  return ok(v);
}

export function validateQuartier(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return required ? fail('Quartier requis.') : ok('');
  if (v.length < 2) return fail('Quartier trop court.');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Quartier invalide.');
  return ok(smartTitleCase(v));
}

export function validateVille(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return required ? fail('Ville requise.') : ok('');
  if (v.length < 2) return fail('Ville trop courte.');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Ville invalide.');
  return ok(smartTitleCase(v));
}

/* --------------------- VALIDATEURS LIBRE / NUMÉRIQUE --------------------- */

export function validateDescription(value: string, max: number = 500): ValidationResult {
  const v = sanitizeText(value);
  if (v.length > max) return fail(`Maximum ${max} caractères.`);
  return ok(v);
}

/**
 * Prix maximal autorisé pour un produit / plat (FCFA) — miroir du backend.
 * Porté de 10 M à 999 999 999 (près d'un milliard).
 */
export const MAX_PRICE = 999_999_999;

export function validatePrice(value: string | number): ValidationResult {
  const raw = typeof value === 'number' ? String(value) : sanitizeText(String(value));
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return fail('Prix invalide (ex. 1500).');
  if (n <= 0) return fail('Le prix doit être supérieur à 0.');
  if (n > MAX_PRICE) return fail(`Le prix est trop élevé (maximum ${MAX_PRICE.toLocaleString('fr-FR')} FCFA).`);
  return ok(String(n));
}

export function validateStock(value: string | number, required: boolean = false): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return required ? fail('Stock requis.') : ok('');
  }
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fail('Stock invalide (entier attendu).');
  if (n < 0) return fail('Le stock ne peut pas être négatif.');
  if (n > 999_999) return fail('Le stock est trop élevé.');
  return ok(String(n));
}

export function validateOtp(value: string): ValidationResult {
  if (!OTP_REGEX.test(sanitizeText(value))) return fail('Le code doit comporter 6 chiffres.');
  return ok(sanitizeText(value));
}

/* --------------------- CHAÎNAGE --------------------- */

export function firstError(...results: ValidationResult[]): string | null {
  for (const r of results) {
    if (!r.ok) return r.message;
  }
  return null;
}

/**
 * Helper pour formulaires : applique un validateur à une valeur et retourne
 * soit la valeur nettoyée, soit un message d'erreur.
 */
export function applyValidator(value: string, validator: (v: string) => ValidationResult): { value: string; error: string | null } {
  const r = validator(value);
  return r.ok ? { value: r.value, error: null } : { value, error: r.message };
}

/* --------------------- BLOC PROMO --------------------- */

export type PromoField = 'prixPromo' | 'promoDebutAt' | 'promoFinAt';
export type PromoBlockResult =
  | { ok: true; prixPromo: string; debut: string; fin: string }
  | { ok: false; field: PromoField; message: string };

export type PromoBlockInput = {
  prixNormal: number | string;
  prixPromo: string;
  promoDebutAt: string;
  promoFinAt: string;
};

const MAX_PROMO_MONTHS = 12;

/**
 * Règles métier du bloc promo :
 *   - prixPromo absent → dates forcément vides (pas de demi-promo)
 *   - prixPromo doit être un prix valide ET strictement inférieur au prix normal
 *   - dates début et fin obligatoires dès qu'un prix promo est saisi
 *   - date début >= aujourd'hui (jamais dans le passé)
 *   - date fin > date début
 *   - durée <= 12 mois calendaires (start + 1 an)
 * Retourne un résultat typé pour cibler le champ en erreur.
 */
export function validatePromoBlock(input: PromoBlockInput): PromoBlockResult {
  const { prixNormal, prixPromo, promoDebutAt, promoFinAt } = input;
  const normal = Number(prixNormal);
  const hasPromo = prixPromo.trim().length > 0;

  if (!hasPromo) {
    if (promoDebutAt || promoFinAt) {
      return { ok: false, field: 'prixPromo', message: 'Aucune promo en cours : retirez les dates.' };
    }
    return { ok: true, prixPromo: '', debut: '', fin: '' };
  }

  const priceCheck = validatePrice(prixPromo);
  if (!priceCheck.ok) return { ok: false, field: 'prixPromo', message: priceCheck.message };
  const promoNum = Number(priceCheck.value);

  if (!Number.isFinite(normal) || normal <= 0) {
    return { ok: false, field: 'prixPromo', message: 'Prix normal invalide.' };
  }
  if (promoNum >= normal) {
    return { ok: false, field: 'prixPromo', message: 'Le prix promo doit être inférieur au prix normal.' };
  }

  if (!promoDebutAt) {
    return { ok: false, field: 'promoDebutAt', message: 'Date de début de promo requise.' };
  }
  if (!promoFinAt) {
    return { ok: false, field: 'promoFinAt', message: 'Date de fin de promo requise.' };
  }

  const start = new Date(`${promoDebutAt}T00:00:00`);
  const end = new Date(`${promoFinAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, field: 'promoDebutAt', message: 'Date de début invalide.' };
  }
  if (Number.isNaN(end.getTime())) {
    return { ok: false, field: 'promoFinAt', message: 'Date de fin invalide.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start.getTime() < today.getTime()) {
    return { ok: false, field: 'promoDebutAt', message: 'La date de début ne peut pas être dans le passé.' };
  }
  if (end.getTime() <= start.getTime()) {
    return { ok: false, field: 'promoFinAt', message: 'La date de fin doit être après la date de début.' };
  }

  const oneYearLater = new Date(start);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  if (end.getTime() > oneYearLater.getTime()) {
    return { ok: false, field: 'promoFinAt', message: `La promo ne peut pas dépasser ${MAX_PROMO_MONTHS} mois.` };
  }

  return { ok: true, prixPromo: priceCheck.value, debut: promoDebutAt, fin: promoFinAt };
}
