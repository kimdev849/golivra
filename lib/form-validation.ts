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
// Rejette le HTML/JS dangereux dans les champs libres (adresse, description) :
// balises (`<script>`, `</div>`, `<!DOCTYPE>`), schémas `javascript:` /
// `data:text/html` et attributs de gestion d'événements (`onerror=`, `onclick=`…).
// Les emojis et accents restent autorisés — seule la vraie « poubelle » est refusée.
const DANGEROUS_MARKUP_REGEX = /<\s*[a-zA-Z\/!]|javascript\s*:|data\s*:\s*text\/html|on(?:error|load|click|mouseover|mouseenter|focus|blur|change|submit|input)\s*=/i;
const NAME_REGEX_PERSON = /^[\p{L}][\p{L}\p{M}\s'’\-.]{0,79}$/u;
// Les emojis restent autorisés dans les noms de commerce / produits (app
// moderne : « Boutique Javer 🛍️ », « 🍕 Pizza spéciale 🔥 ») : le nom doit
// quand même contenir au moins une lettre (EMOJI_ONLY est rejeté plus bas).
const NAME_REGEX_COMMERCE = /^[\p{L}0-9\p{Emoji_Presentation}\p{Extended_Pictographic}@][\p{L}\p{M}0-9\s'’\-.,&()@\p{Emoji_Presentation}\p{Extended_Pictographic}]{0,79}$/u;
const NAME_REGEX_PRODUCT = /^[\p{L}0-9\p{Emoji_Presentation}\p{Extended_Pictographic}@][\p{L}\p{M}0-9\s'’\-.,()/&°@\p{Emoji_Presentation}\p{Extended_Pictographic}]{0,99}$/u;
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const STRICT_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const OTP_REGEX = /^[0-9]{6}$/;

/* --------------------- HELPERS D'AUTO-CORRECTION --------------------- */

/**
 * Nettoie une chaîne saisie : trim + retire espaces doubles + casse titre.
 * N'altère pas le contenu, seulement la présentation.
 */
export function sanitizeText(raw: string): string {
  if (!raw) return '';
  // Retire les caractères de contrôle dangereux / invisibles (hors \n \t \r) :
  // rien d'exécutable ni de « fantôme » ne doit entrer en base.
  const noControl = String(raw).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const trimmed = noControl.trim();
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
  if (v.length === 0) return fail('Écrivez votre prénom et votre nom, par exemple « Marie Claire ».');
  if (v.length < 2) return fail('Votre nom est trop court : écrivez au moins 2 lettres, par exemple « Ana ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas un nom. Écrivez votre prénom et votre nom, par exemple « Jean Paul ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Les symboles seuls ne font pas un nom. Écrivez votre prénom et votre nom, par exemple « Jean Paul ».');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Les emojis seuls ne font pas un nom. Écrivez votre prénom et votre nom, par exemple « Jean Paul ».');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Votre nom doit contenir des lettres. Écrivez votre prénom et votre nom, par exemple « Jean Paul ».');
  if (!NAME_REGEX_PERSON.test(v)) return fail('Votre nom ne peut contenir que des lettres, des espaces, des tirets et des apostrophes — comme « Jean-Claude » ou « Awa N\'Guessan ».');
  return ok(titleCase(v));
}

export function validateCommerceName(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Donnez un nom à votre commerce, par exemple « Chez Maman ».');
  if (v.length < 2) return fail('Le nom est trop court : écrivez au moins 2 lettres, par exemple « Chez Maman ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas un nom. Donnez un nom à votre commerce, par exemple « Chez Maman ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Les symboles seuls ne font pas un nom. Donnez un nom à votre commerce, par exemple « Chez Maman ».');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Les emojis seuls ne font pas un nom. Donnez un nom à votre commerce, par exemple « Chez Maman ».');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Le nom de votre commerce doit contenir des lettres, par exemple « Chez Maman ».');
  if (!NAME_REGEX_COMMERCE.test(v)) return fail('Ce nom ne peut contenir que des lettres, des chiffres, des espaces, des tirets, &, des parenthèses et des virgules — comme « Mode & Co ».');
  return ok(smartTitleCase(v));
}

export function validateProductName(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Donnez un nom à votre produit, par exemple « Poulet braisé ».');
  if (v.length < 2) return fail('Le nom est trop court : écrivez au moins 2 lettres, par exemple « Poulet braisé ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas un nom. Donnez un nom à votre produit, par exemple « Poulet braisé ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Les symboles seuls ne font pas un nom. Donnez un nom à votre produit, par exemple « Poulet braisé ».');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Les emojis seuls ne font pas un nom. Donnez un nom à votre produit, par exemple « Poulet braisé ».');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Le nom de votre produit doit contenir des lettres, par exemple « Poulet braisé » ou « Coca Cola 33cl ».');
  if (!NAME_REGEX_PRODUCT.test(v)) return fail('Ce nom contient des caractères non autorisés. Gardez des lettres, des chiffres et des espaces, par exemple « Poulet braisé ».');
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
  if (v.length === 0) return fail('Écrivez votre numéro de téléphone, par exemple +242 06 123 45 67.');
  if (!HAS_DIGIT_REGEX.test(v)) return fail('Votre numéro doit contenir des chiffres, par exemple +242 06 123 45 67.');

  const activeIndicatif = indicatif || detectCountryCode(v);

  // Récupérer les infos téléphone du pays depuis le cache
  const country = getCachedCountryByIndicatif(activeIndicatif);
  const expectedDigits = country?.phone_digits ?? 9;
  const prefixDigits = activeIndicatif.replace(/\D/g, '');
  const allDigits = v.replace(/\D/g, '');
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + expectedDigits)
    : allDigits.slice(0, expectedDigits);

  // Trop de chiffres saisis (collage, numéro faux…) → invalide : on refuse de
  // tronquer silencieusement, sinon un OTP pourrait partir vers un numéro
  // tronqué sans que l'utilisateur s'en rende compte.
  if (allDigits.length > prefixDigits.length + expectedDigits) {
    return fail(`Ce numéro semble trop long : il doit contenir ${expectedDigits} chiffres après l'indicatif, par exemple ${generateExample(activeIndicatif, expectedDigits)}.`);
  }
  if (nationalDigits.length !== expectedDigits) {
    const example = generateExample(activeIndicatif, expectedDigits);
    return fail(`Vérifiez votre numéro : il doit ressembler à ${example} (${expectedDigits} chiffres après l'indicatif).`);
  }
  if (!/^\d+$/.test(nationalDigits)) {
    return fail('Votre numéro ne doit contenir que des chiffres, par exemple +242 06 123 45 67.');
  }

  return ok(v);
}

/** Génère un exemple de format lisible pour l'indicatif donné.
 *  +242 avec 9 chiffres → '+242 06 987 65 43'
 */
function generateExample(indicatif: string, digits: number): string {
  if (indicatif === '+242' && digits === 9) return '+242 06 987 65 43';
  if (indicatif === '+242' && digits === 10) return '+242 06 9876 5432';
  // Générer un exemple générique
  const xs = '0'.repeat(Math.min(digits, 12));
  // Insérer un espace tous les 2-3 chiffres pour la lisibilité
  const spaced = xs.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return `${indicatif} ${spaced}`;
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
  if (!EMAIL_REGEX.test(v)) return fail('Cette adresse e-mail ne semble pas valide. Vérifiez le format, par exemple marie@exemple.com.');
  return ok(v.toLowerCase());
}

export function validateEmailRequired(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return fail('Écrivez votre adresse e-mail, par exemple marie@exemple.com.');
  if (!EMAIL_REGEX.test(v)) return fail('Cette adresse e-mail ne semble pas valide. Vérifiez le format, par exemple marie@exemple.com.');
  return ok(v.toLowerCase());
}

/* --------------------- VALIDATEURS MOT DE PASSE --------------------- */

export function validatePassword(value: string): ValidationResult {
  if (value.length === 0) return fail('Choisissez un mot de passe pour protéger votre compte.');
  if (value.length < 8) return fail('Votre mot de passe doit contenir au moins 8 caractères.');
  if (value.length > 128) return fail('Votre mot de passe est trop long (128 caractères maximum).');
  if (!STRICT_PASSWORD_REGEX.test(value)) return fail('Votre mot de passe doit contenir au moins 1 lettre et 1 chiffre, par exemple « maison2024 ».');
  return ok(value);
}

export function validatePasswordConfirmation(value: string, original: string): ValidationResult {
  if (value.length === 0) return fail('Répétez votre mot de passe pour confirmer.');
  if (value !== original) return fail('Les deux mots de passe ne sont pas identiques. Saisissez le même mot de passe dans les deux champs.');
  return ok(value);
}

/* --------------------- VALIDATEURS ADRESSE --------------------- */

export function validateAddress(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) {
    return required ? fail('Indiquez votre adresse : quartier, rue ou repère, par exemple « Bacongo, avenue de la Paix ».') : ok('');
  }
  if (v.length < 4) return fail('Votre adresse est trop courte. Précisez le quartier, la rue ou un repère, par exemple « Bacongo, avenue de la Paix ».');
  if (v.length > 300) return fail('Votre adresse est trop longue (300 caractères maximum).');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Une adresse ne peut pas être uniquement des chiffres. Ajoutez le quartier ou la rue, par exemple « Rue 12, Bacongo ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Une adresse ne peut pas être uniquement des symboles. Écrivez le quartier ou la rue, par exemple « Bacongo ».');
  if (DANGEROUS_MARKUP_REGEX.test(v)) return fail('Cette adresse contient des caractères non autorisés. Écrivez simplement le quartier, la rue ou un repère.');
  // Les adresses de type « @6363 » ou « @Avenue » (repères) sont acceptées.
  const isAtHandle = /^@\p{L}+[\p{L}\d\s'’\-.,&()]*$/u.test(v);
  if (!isAtHandle && !HAS_LETTER_REGEX.test(v)) return fail('Indiquez le quartier, la rue ou un repère, par exemple « Face à la station Total ».');
  // Rejette les saisies de test absurdes du type « @##fff », « 555@#$$kk » :
  // il faut au moins 2 lettres ET pas plus de 2 symboles avant la première
  // lettre (les adresses réelles commencent par une lettre ou un numéro de
  // rue, ex. « PK 45 », « 12 rue de la Paix », « Av. de la Paix »).
  if (!isAtHandle) {
    const letters = (v.match(/\p{L}/gu) ?? []).length;
    if (letters < 2) return fail('Votre adresse doit contenir au moins 2 lettres, par exemple « Rue Mbochis ».');
    // Poubelle avant la première lettre : seuls les SYMBOLES / ponctuation
    // comptent. Les chiffres (numéro de rue), les espaces et les emojis sont
    // autorisés (« 📍 Avenue de la Paix », « 🏠 Résidence X ») — mais pas
    // « @##fff » ni « 555@#$$kk ».
    const firstLetterIdx = v.search(/\p{L}/u);
    const prefix = firstLetterIdx === -1 ? v : v.slice(0, firstLetterIdx);
    const leadingGarbage = prefix.replace(/[\d\s\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').length;
    if (leadingGarbage > 2) return fail('Votre adresse commence de façon étrange. Commencez par le quartier, la rue ou un repère, par exemple « Bacongo, rue de la Paix ».');
  }
  return ok(v);
}

export function validateAddressLabel(value: string): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return ok('');
  if (v.length < 2) return fail('Donnez un nom à cette adresse, par exemple « Maison » ou « Travail ».');
  if (v.length > 50) return fail('Ce nom est trop long (50 caractères maximum).');
  if (DANGEROUS_MARKUP_REGEX.test(v)) return fail('Ce nom contient des caractères non autorisés. Utilisez des lettres, par exemple « Maison ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas un nom. Donnez un nom à cette adresse, par exemple « Maison ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Les symboles seuls ne font pas un nom. Donnez un nom à cette adresse, par exemple « Maison ».');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Les emojis seuls ne font pas un nom. Donnez un nom à cette adresse, par exemple « Maison ».');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Ce nom doit contenir des lettres, par exemple « Maison », « Travail » ou « Chez maman ».');
  // Même règle anti-poubelle que l'adresse : pas plus de 2 symboles avant la
  // première lettre (« @$%3ddf » refusé, « 🏠 Maison » accepté).
  const firstLetterIdx = v.search(/\p{L}/u);
  const prefix = firstLetterIdx === -1 ? v : v.slice(0, firstLetterIdx);
  const leadingGarbage = prefix.replace(/[\d\s\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').length;
  if (leadingGarbage > 2) return fail('Ce nom doit commencer par une lettre, par exemple « Maison » ou « Travail ».');
  return ok(v);
}

/**
 * Valide un « Point de repère » ou des « Instructions livreur » : champ libre
 * mais pas de poubelle. Mêmes règles anti-symboles que l'adresse — « @#####^ »,
 * « !!! », « 12345 » refusés ; « Face station Puma », « Sonner 2 fois » acceptés.
 */
export function validateLandmark(value: string, max: number = 300): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return ok('');
  if (v.length < 2) return fail('Écrivez un repère simple, par exemple « Face à la station Puma ».');
  if (v.length > max) return fail(`Votre texte est trop long (${max} caractères maximum).`);
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne suffisent pas. Ajoutez un repère, par exemple « Portail vert, sonner 2 fois ».');
  if (PUNCTUATION_ONLY_REGEX.test(v)) return fail('Les symboles seuls ne suffisent pas. Écrivez un repère, par exemple « Face à la station Puma ».');
  if (EMOJI_ONLY_REGEX.test(v)) return fail('Les emojis seuls ne suffisent pas. Écrivez un repère, par exemple « Face à la station Puma ».');
  if (DANGEROUS_MARKUP_REGEX.test(v)) return fail('Ce texte contient des caractères non autorisés. Écrivez simplement votre repère ou vos instructions.');
  if (!HAS_LETTER_REGEX.test(v)) return fail('Écrivez un repère ou une instruction avec des lettres, par exemple « Sonner 2 fois ».');
  // Même règle anti-poubelle que l'adresse : au moins 2 lettres ET pas plus de
  // 2 symboles avant la première lettre (« @#####^ », « $%&3ddf » refusés ;
  // « Face station Puma », « 12e étage », « 🏠 Portail vert » acceptés).
  const letters = (v.match(/\p{L}/gu) ?? []).length;
  if (letters < 2) return fail('Votre texte doit contenir au moins 2 lettres, par exemple « Face station Puma ».');
  const firstLetterIdx = v.search(/\p{L}/u);
  const prefix = firstLetterIdx === -1 ? v : v.slice(0, firstLetterIdx);
  const leadingGarbage = prefix.replace(/[\d\s\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').length;
  if (leadingGarbage > 2) return fail('Votre texte commence de façon étrange. Commencez par une lettre ou un chiffre, par exemple « 12e étage ».');
  return ok(v);
}

export function validateQuartier(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return required ? fail('Choisissez votre quartier, par exemple « Poto-Poto » ou « Bacongo ».') : ok('');
  if (v.length < 2) return fail('Le quartier est trop court. Choisissez ou écrivez votre quartier, par exemple « Poto-Poto ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas un quartier. Écrivez le nom du quartier, par exemple « Bacongo ».');
  return ok(smartTitleCase(v));
}

export function validateVille(value: string, required: boolean = true): ValidationResult {
  const v = sanitizeText(value);
  if (v.length === 0) return required ? fail('Indiquez votre ville, par exemple « Brazzaville ».') : ok('');
  if (v.length < 2) return fail('La ville est trop courte. Écrivez le nom de la ville, par exemple « Brazzaville ».');
  if (NUMERIC_ONLY_REGEX.test(v)) return fail('Les chiffres seuls ne font pas une ville. Écrivez le nom de la ville, par exemple « Brazzaville ».');
  return ok(smartTitleCase(v));
}

/* --------------------- VALIDATEURS LIBRE / NUMÉRIQUE --------------------- */

export function validateDescription(value: string, max: number = 500): ValidationResult {
  const v = sanitizeText(value);
  if (v.length > max) return fail(`Votre description est trop longue (${max} caractères maximum).`);
  if (DANGEROUS_MARKUP_REGEX.test(v)) return fail('Votre description contient des caractères non autorisés. Écrivez simplement votre texte.');
  return ok(v);
}

/**
 * Prix minimal autorisé pour un produit / plat (FCFA) — miroir du backend.
 * Les montants étant exprimés en FCFA (plus petite unité), aucun produit ne
 * peut être vendu en dessous de 25 FCFA.
 */
export const MIN_PRICE = 10;

/**
 * Prix maximal autorisé pour un produit / plat (FCFA) — miroir du backend.
 * Porté de 10 M à 999 999 999 (près d'un milliard).
 */
export const MAX_PRICE = 999_999_999;

export function validatePrice(value: string | number): ValidationResult {
  const raw = typeof value === 'number' ? String(value) : sanitizeText(String(value));
  const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return fail('Indiquez un prix en FCFA, par exemple 1500.');
  if (n < MIN_PRICE) return fail(`Le prix le plus bas autorisé est de ${MIN_PRICE} FCFA.`);
  if (n > MAX_PRICE) return fail(`Ce prix est trop élevé : le maximum est de ${MAX_PRICE.toLocaleString('fr-FR')} FCFA.`);
  return ok(String(n));
}

export function validateStock(value: string | number, required: boolean = false): ValidationResult {
  if (value === '' || value === null || value === undefined) {
    return required ? fail('Stock requis.') : ok('');
  }
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fail('Indiquez un nombre entier d\'articles, par exemple 10.');
  if (n < 0) return fail('Le nombre d\'articles ne peut pas être négatif.');
  if (n > 999_999) return fail('Ce nombre d\'articles est trop élevé.');
  return ok(String(n));
}

export function validateOtp(value: string): ValidationResult {
  if (!OTP_REGEX.test(sanitizeText(value))) return fail('Le code SMS doit contenir 6 chiffres, par exemple 123456.');
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
      return { ok: false, field: 'prixPromo', message: 'Pas de promo en cours : retirez les dates si vous n\'en voulez pas.' };
    }
    return { ok: true, prixPromo: '', debut: '', fin: '' };
  }

  const priceCheck = validatePrice(prixPromo);
  if (!priceCheck.ok) return { ok: false, field: 'prixPromo', message: priceCheck.message };
  const promoNum = Number(priceCheck.value);

  if (!Number.isFinite(normal) || normal <= 0) {
    return { ok: false, field: 'prixPromo', message: 'Indiquez d\'abord un prix normal valide.' };
  }
  if (promoNum >= normal) {
    return { ok: false, field: 'prixPromo', message: 'Le prix promo doit être inférieur au prix normal.' };
  }

  if (!promoDebutAt) {
    return { ok: false, field: 'promoDebutAt', message: 'Choisissez la date de début de la promo.' };
  }
  if (!promoFinAt) {
    return { ok: false, field: 'promoFinAt', message: 'Choisissez la date de fin de la promo.' };
  }

  const start = new Date(`${promoDebutAt}T00:00:00`);
  const end = new Date(`${promoFinAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, field: 'promoDebutAt', message: 'Cette date de début ne semble pas valide.' };
  }
  if (Number.isNaN(end.getTime())) {
    return { ok: false, field: 'promoFinAt', message: 'Cette date de fin ne semble pas valide.' };
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
    return { ok: false, field: 'promoFinAt', message: `La promo ne peut pas durer plus de ${MAX_PROMO_MONTHS} mois.` };
  }

  return { ok: true, prixPromo: priceCheck.value, debut: promoDebutAt, fin: promoFinAt };
}
