/**
 * Formatage téléphone multi-pays.
 *
 * Aucune donnée codée en dur — tout vient de l'API (`Pays` depuis la table `pays`).
 * Les pays sont mis en cache après le premier appel à `initPhoneCountries()`.
 */

import { useState, useEffect } from 'react';
import { fetchPays, type Pays } from '@/lib/location';

/* -------------------------------------------------------------------------- */
/*  Cache pays                                                                */
/* -------------------------------------------------------------------------- */

let _countries: Pays[] | null = null;
let _countriesPromise: Promise<Pays[]> | null = null;

/**
 * Initialise/récupère la liste des pays depuis l'API.
 * Le résultat est mis en cache après le premier appel réussi.
 */
export async function initPhoneCountries(): Promise<Pays[]> {
  if (_countries) return _countries;
  if (_countriesPromise) return _countriesPromise;
  _countriesPromise = fetchPays().then((list) => {
    // Filtrer uniquement les pays qui ont un indicatif
    const valid = list.filter((p) => p.indicatif && p.phone_digits);
    _countries = valid;
    _countriesPromise = null;
    return valid;
  }).catch((err) => {
    _countriesPromise = null;
    throw err;
  });
  return _countriesPromise;
}

/**
 * Vide le cache (utile pour tests ou rafraîchissement).
 */
export function resetPhoneCountries(): void {
  _countries = null;
  _countriesPromise = null;
}

/**
 * Récupère la liste des pays depuis le cache.
 * Retourne un tableau vide si `initPhoneCountries()` n'a pas été appelé.
 */
export function getCachedCountries(): Pays[] {
  return _countries ?? [];
}

/**
 * Récupère un pays par son indicatif depuis le cache.
 */
export function getCachedCountryByIndicatif(indicatif: string): Pays | undefined {
  return (_countries ?? []).find(
    (p) => p.indicatif?.replace(/\s/g, '') === indicatif.replace(/\s/g, ''),
  );
}

/* -------------------------------------------------------------------------- */
/*  Détection du pays à partir d'une chaîne                                   */
/* -------------------------------------------------------------------------- */

/**
 * Détecte l'indicatif du pays à partir d'un numéro partiellement saisi.
 * Utilise le cache — doit être initialisé avec `initPhoneCountries()`.
 */
export function detectCountryCode(value: string): string {
  const countries = _countries ?? [];
  const cleaned = value.replace(/\s/g, '');

  // Trier par longueur d'indicatif décroissante (+242 avant +24)
  const sorted = [...countries]
    .filter((p) => p.indicatif)
    .sort((a, b) => (b.indicatif?.length ?? 0) - (a.indicatif?.length ?? 0));

  for (const p of sorted) {
    if (p.indicatif && cleaned.startsWith(p.indicatif)) return p.indicatif;
  }

  // Si ça commence par + mais match aucun connu
  // • Les codes pays ITU font max 3 chiffres.
  // • Évite de capturer le début du numéro national (ex. +2420 → +242, pas +2420)
  if (/^\+\d/.test(cleaned)) {
    const match = cleaned.match(/^(\+\d{1,3})/);
    if (match) return match[1];
  }

  return '+242'; // fallback Congo
}

/**
 * Récupère les infos téléphone d'un pays depuis le cache.
 */
function getPhoneInfo(indicatif: string): { digits: number; groups: number[] } | null {
  const countries = _countries ?? [];
  const p = countries.find(
    (c) => c.indicatif?.replace(/\s/g, '') === indicatif.replace(/\s/g, ''),
  );
  if (!p || !p.phone_digits) return null;

  const groups = p.phone_format
    ? p.phone_format.split(',').map(Number).filter((n) => n > 0)
    : defaultGroups(p.phone_digits);

  return { digits: p.phone_digits, groups };
}

/**
 * Génère des groupes par défaut si aucun format n'est défini.
 */
function defaultGroups(digits: number): number[] {
  if (digits <= 2) return [digits];
  if (digits <= 4) return [2, digits - 2];
  // Pour la plupart des numéros: groupes de 2, le dernier prend le reste
  const groups: number[] = [];
  let remaining = digits;
  while (remaining > 0) {
    groups.push(Math.min(2, remaining));
    remaining -= 2;
  }
  return groups;
}

/* -------------------------------------------------------------------------- */
/*  Formatage                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Formate un numéro selon les règles du pays détecté.
 * @param value     La valeur brute tapée par l'utilisateur
 * @param indicatif Indicatif forcé (si déjà connu)
 */
export function formatPhone(value: string, indicatif?: string): string {
  const activeIndicatif = indicatif || detectCountryCode(value);
  const info = getPhoneInfo(activeIndicatif);

  if (!info) {
    // Fallback: pas d'infos disponibles (cache pas encore chargé)
    // Extraire les chiffres nationaux (sans le préfixe) avant de formater
    const prefixDigits = activeIndicatif.replace(/\D/g, '');
    const allDigits = value.replace(/\D/g, '');
    const nationalDigits = allDigits.startsWith(prefixDigits)
      ? allDigits.slice(prefixDigits.length)
      : allDigits;
    if (!nationalDigits) return `${activeIndicatif} `;
    // Grouper par 2
    const formatted = nationalDigits.replace(/(\d{2})(?=\d)/g, '$1 ');
    return `${activeIndicatif} ${formatted}`;
  }

  const prefixDigits = activeIndicatif.replace(/\D/g, '');
  const allDigits = value.replace(/\D/g, '');
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + info.digits)
    : allDigits.slice(0, info.digits);

  if (!nationalDigits) return `${activeIndicatif} `;

  const formatted = formatGroups(nationalDigits, info.groups);
  return `${activeIndicatif} ${formatted}`;
}

/**
 * Applique un motif de groupes à une chaîne de chiffres.
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
  const info = getPhoneInfo(activeIndicatif);
  const prefixDigits = activeIndicatif.replace(/\D/g, '');

  const allDigits = value.replace(/\D/g, '');
  const expectedDigits = info?.digits ?? 9;
  const nationalDigits = allDigits.startsWith(prefixDigits)
    ? allDigits.slice(prefixDigits.length, prefixDigits.length + expectedDigits)
    : allDigits.slice(0, expectedDigits);

  if (nationalDigits.length !== expectedDigits) return null;
  return `${activeIndicatif}${nationalDigits}`;
}

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                               */
/* -------------------------------------------------------------------------- */

export const DEFAULT_INDICATIF = '+242';

/**
 * Hook React pour récupérer la liste des pays depuis le cache.
 * Déclenche l'initialisation au premier appel et met à jour le state
 * quand les données arrivent de l'API.
 */
export function usePaysList(): Pays[] {
  const [countries, setCountries] = useState<Pays[]>(() => getCachedCountries());

  useEffect(() => {
    if (getCachedCountries().length > 0) {
      setCountries(getCachedCountries());
      return;
    }
    initPhoneCountries()
      .then((list) => setCountries(list))
      .catch(() => {});
  }, []);

  return countries;
}

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
  return toE164(value);
}
