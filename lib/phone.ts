/**
 * Formatage téléphone dynamique multi-pays.
 *
 * Chaque pays a son propre indicatif, nombre de chiffres, et motif de formatage.
 * Les fonctions détectent automatiquement le pays à partir du préfixe saisi.
 */

/* -------------------------------------------------------------------------- */
/*  Configuration pays                                                       */
/* -------------------------------------------------------------------------- */

export type CountryPhoneConfig = {
  indicatif: string;
  name: string;
  /** Nombre de chiffres après l'indicatif (sans le 0 éventuel). */
  nationalDigits: number;
  /**
   * Tableau de tailles de groupes pour le formatage, ex [2,3,2,2] → "XX XXX XX XX".
   * Les groupes sont appliqués dans l'ordre sans séparateur fixe,
   * chaque élément définit le nombre de caractères à prendre pour ce groupe.
   */
  groups: number[];
  /** Nom utilisé pour les messages d'erreur. */
  country: string;
};

const COUNTRY_CONFIGS: CountryPhoneConfig[] = [
  { indicatif: '+242', name: '+242', nationalDigits: 9, groups: [2, 3, 2, 2], country: 'Congo' },
  { indicatif: '+237', name: '+237', nationalDigits: 9, groups: [3, 2, 2, 2], country: 'Cameroun' },
  { indicatif: '+221', name: '+221', nationalDigits: 9, groups: [2, 3, 2, 2], country: 'Sénégal' },
  { indicatif: '+225', name: '+225', nationalDigits: 10, groups: [2, 2, 2, 2, 2], country: 'Côte d\'Ivoire' },
  { indicatif: '+241', name: '+241', nationalDigits: 8, groups: [1, 2, 2, 3], country: 'Gabon' },
  { indicatif: '+243', name: '+243', nationalDigits: 9, groups: [2, 3, 2, 2], country: 'RDC' },
  { indicatif: '+229', name: '+229', nationalDigits: 8, groups: [2, 2, 2, 2], country: 'Bénin' },
  { indicatif: '+228', name: '+228', nationalDigits: 8, groups: [2, 2, 2, 2], country: 'Togo' },
  { indicatif: '+224', name: '+224', nationalDigits: 9, groups: [2, 3, 2, 2], country: 'Guinée' },
  { indicatif: '+223', name: '+223', nationalDigits: 8, groups: [2, 2, 2, 2], country: 'Mali' },
  { indicatif: '+226', name: '+226', nationalDigits: 8, groups: [2, 2, 2, 2], country: 'Burkina Faso' },
  { indicatif: '+227', name: '+227', nationalDigits: 8, groups: [2, 2, 2, 2], country: 'Niger' },
  { indicatif: '+234', name: '+234', nationalDigits: 10, groups: [3, 3, 4], country: 'Nigeria' },
  { indicatif: '+33', name: '+33', nationalDigits: 9, groups: [1, 2, 2, 2, 2], country: 'France' },
];

/** Index par indicatif pour lookup rapide. */
const CONFIG_BY_INDICATIF: Record<string, CountryPhoneConfig> = {};
for (const cfg of COUNTRY_CONFIGS) {
  CONFIG_BY_INDICATIF[cfg.indicatif] = cfg;
}

export const DEFAULT_INDICATIF = '+242';
export const COUNTRY_CONFIGS_LIST = COUNTRY_CONFIGS;
export const DEFAULT_COUNTRY_CONFIG = CONFIG_BY_INDICATIF[DEFAULT_INDICATIF]!;

/* -------------------------------------------------------------------------- */
/*  Détection du pays à partir d'une chaîne                                   */
/* -------------------------------------------------------------------------- */

/**
 * Détecte l'indicatif du pays à partir d'un numéro partiellement saisi.
 * Vérifie d'abord les préfixes longs (+242, +237, +225…) puis les plus courts (+33).
 */
export function detectCountryCode(value: string): string {
  const cleaned = value.replace(/\s/g, '');
  // Trier par longueur d'indicatif décroissante pour matcher +242 avant +24
  const sorted = [...COUNTRY_CONFIGS].sort((a, b) => b.indicatif.length - a.indicatif.length);
  for (const cfg of sorted) {
    if (cleaned.startsWith(cfg.indicatif)) return cfg.indicatif;
  }
  // Si ça commence par + mais match aucun connu, on garde le préfixe tapé
  if (/^\+\d/.test(cleaned)) {
    const match = cleaned.match(/^(\+\d{1,4})/);
    if (match) return match[1];
  }
  return DEFAULT_INDICATIF;
}

export function getCountryConfig(indicatif: string): CountryPhoneConfig {
  return CONFIG_BY_INDICATIF[indicatif] ?? DEFAULT_COUNTRY_CONFIG;
}

/* -------------------------------------------------------------------------- */
/*  Formatage                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Formate un numéro selon les règles du pays détecté.
 * @param value  La valeur brute tapée par l'utilisateur
 * @param indicatif  Indicatif forcé (si déjà connu, ex. depuis la sélection pays)
 */
export function formatPhone(value: string, indicatif?: string): string {
  const activeIndicatif = indicatif || detectCountryCode(value);
  const config = getCountryConfig(activeIndicatif);
  const prefixDigits = activeIndicatif.replace(/\D/g, '');

  // Extraire les chiffres nationaux
  const allDigits = value.replace(/\D/g, '');
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + config.nationalDigits)
    : allDigits.slice(0, config.nationalDigits);

  if (!nationalDigits) return `${activeIndicatif} `;

  // Appliquer les groupes de formatage
  const formatted = formatGroups(nationalDigits, config.groups);
  return `${activeIndicatif} ${formatted}`;
}

/**
 * Applique un motif de groupes à une chaîne de chiffres.
 * Ex: "060001234" avec [2,3,2,2] → "06 000 12 34"
 */
function formatGroups(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let pos = 0;
  for (const size of groups) {
    if (pos >= digits.length) break;
    parts.push(digits.slice(pos, pos + size));
    pos += size;
  }
  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/*  Conversion E164                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Convertit un numéro formaté en E164 (+242060001234).
 * Retourne null si le nombre de chiffres nationaux est incorrect.
 */
export function toE164(value: string): string | null {
  const activeIndicatif = detectCountryCode(value);
  const config = getCountryConfig(activeIndicatif);
  const prefixDigits = activeIndicatif.replace(/\D/g, '');

  const allDigits = value.replace(/\D/g, '');
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + config.nationalDigits)
    : allDigits.slice(0, config.nationalDigits);

  if (nationalDigits.length !== config.nationalDigits) return null;
  return `${activeIndicatif}${nationalDigits}`;
}

/* -------------------------------------------------------------------------- */
/*  Rétrocompatibilité (Congo uniquement)                                     */
/* -------------------------------------------------------------------------- */

/**
 * @deprecated Utilisez `formatPhone(value)` à la place.
 */
export function formatCgPhone(value: string): string {
  return formatPhone(value, '+242');
}

/**
 * @deprecated Utilisez `toE164(value)` à la place.
 */
export function toCgE164(value: string): string | null {
  // Rediriger vers la version générique mais en forçant +242
  const config = getCountryConfig('+242');
  const digits = value.replace(/\D/g, '');
  const nationalDigits = digits.startsWith('242') ? digits.slice(3, 12) : digits.slice(0, 9);
  if (nationalDigits.length !== config.nationalDigits) return null;
  return `+242${nationalDigits}`;
}

export { COUNTRY_CONFIGS as COUNTRY_PHONE_CONFIGS };
