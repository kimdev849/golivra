import { useCallback, useState } from 'react';

import { applyValidator } from '@/lib/form-validation';
import type { ValidationResult } from '@/lib/form-validation';

type ValidatorMap<T> = {
  [K in keyof T]?: (v: T[K]) => ValidationResult;
};

type Errors<T> = {
  [K in keyof T]?: string | null;
};

type Cleaned<T> = {
  [K in keyof T]?: string;
};

/**
 * Hook de validation par champ avec messages inline + auto-correction.
 *
 * @example
 *   const { values, setField, errors, validate, getCleaned } = useFieldValidator({
 *     initial: { nom: '', adresse: '' },
 *     validators: {
 *       nom: validateCommerceName,
 *       adresse: validateAddress,
 *     },
 *   });
 *
 *   if (!validate()) return; // bloqué si erreurs
 *   const cleaned = getCleaned(); // { nom: 'Resto Central', adresse: '...' }
 */
export function useFieldValidator<T extends Record<string, string>>({
  initial,
  validators,
}: {
  initial: T;
  validators: ValidatorMap<T>;
}) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  const markTouched = useCallback((field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  /**
   * Valide tous les champs et retourne true si tout est OK.
   * En cas d'erreur, met à jour `errors` pour affichage inline.
   */
  const validate = useCallback((): boolean => {
    const nextErrors: Errors<T> = {};
    let allOk = true;
    for (const key of Object.keys(validators) as Array<keyof T>) {
      const validator = validators[key]!;
      const v = values[key];
      const result = applyValidator(String(v ?? ''), (validator as (v: string) => ValidationResult));
      if (!result.error) {
        nextErrors[key] = null;
        if (result.value !== v) {
          setValues((prev) => ({ ...prev, [key]: result.value as T[keyof T] }));
        }
      } else {
        nextErrors[key] = result.error;
        allOk = false;
      }
    }
    setErrors(nextErrors);
    setTouched((prev) => {
      const next = { ...prev } as Record<keyof T, boolean>;
      for (const key of Object.keys(validators) as Array<keyof T>) next[key] = true;
      return next;
    });
    return allOk;
  }, [values, validators]);

  /**
   * Retourne un objet avec les valeurs nettoyées, prêtes à être envoyées au backend.
   * N'inclut que les champs qui ont un validateur.
   */
  const getCleaned = useCallback((): Cleaned<T> => {
    const out: Cleaned<T> = {};
    for (const key of Object.keys(validators) as Array<keyof T>) {
      const validator = validators[key]!;
      const v = String(values[key] ?? '');
      const r = applyValidator(v, (validator as (v: string) => ValidationResult));
      if (r.error) {
        throw new Error(`Champ ${String(key)} invalide : ${r.error}`);
      }
      out[key] = r.value;
    }
    return out;
  }, [values, validators]);

  const validateOne = useCallback((field: keyof T): boolean => {
    const validator = validators[field];
    if (!validator) return true;
    const v = values[field];
    const r = applyValidator(String(v ?? ''), (validator as (v: string) => ValidationResult));
    if (r.error) {
      setErrors((prev) => ({ ...prev, [field]: r.error }));
      return false;
    }
    if (r.value !== v) {
      setValues((prev) => ({ ...prev, [field]: r.value as T[keyof T] }));
    }
    setErrors((prev) => ({ ...prev, [field]: null }));
    return true;
  }, [values, validators]);

  return {
    values,
    setField,
    markTouched,
    errors,
    touched,
    validate,
    validateOne,
    getCleaned,
    reset: () => { setValues(initial); setErrors({}); setTouched({} as Record<keyof T, boolean>); },
  };
}
