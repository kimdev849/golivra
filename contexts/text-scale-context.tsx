import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { safeGetItem, safeSetItem } from '@/lib/safe-store';

/**
 * Taille de texte globale (réglage utilisateur).
 * Stockée localement (SecureStore si dispo, sinon AsyncStorage) — aucune colonne en base.
 *
 * La valeur est préchargée par `hydrateTextScale()` pendant le warm-up de l'app
 * (avant le premier rendu) : le réglage choisi s'applique dès l'ouverture, sans
 * « flash » vers la taille normale qui donnait l'impression que le choix
 * utilisateur était perdu.
 */

export type TextScaleKey = 'petit' | 'normal' | 'grand';

export const TEXT_SCALE_OPTIONS: { key: TextScaleKey; label: string; factor: number }[] = [
  { key: 'petit', label: 'Petit', factor: 0.9 },
  { key: 'normal', label: 'Normal', factor: 1 },
  { key: 'grand', label: 'Grand', factor: 1.15 },
];

const STORAGE_KEY = 'golivra_text_scale_v1';

/** Cache mémoire du réglage, alimenté AVANT le premier rendu (warmAppCaches). */
let cachedKey: TextScaleKey | null = null;

/** Charge le réglage depuis le stockage (appelé une fois au démarrage).
 *  Renvoie la clé résolue (ou null si rien n'était stocké) pour permettre au
 *  Provider de resynchroniser son état même si le montage a eu lieu avant la
 *  fin du warm-up. */
export async function hydrateTextScale(): Promise<TextScaleKey | null> {
  try {
    const v = await safeGetItem(STORAGE_KEY);
    if (v === 'petit' || v === 'grand' || v === 'normal') {
      cachedKey = v;
      return v;
    }
  } catch {
    /* défaut : normal */
  }
  return null;
}

/** Persiste le réglage (mémoire + stockage). */
function persistTextScale(k: TextScaleKey): void {
  cachedKey = k;
  void safeSetItem(STORAGE_KEY, k);
}

type TextScaleContextValue = {
  key: TextScaleKey;
  scale: number;
  setKey: (k: TextScaleKey) => void;
};

const TextScaleContext = createContext<TextScaleContextValue | null>(null);

export function TextScaleProvider({ children }: { children: ReactNode }) {
  // La valeur est idéalement hydratée avant le premier rendu (warmAppCaches).
  // Mais le Provider est monté AVANT la fin du bootstrap → on relit le stockage
  // ici aussi, sinon le réglage 'petit'/'grand' choisit l'app redevient
  // 'normal' à chaque redémarrage (le state React n'était jamais resynchronisé).
  const [key, setKeyState] = useState<TextScaleKey>(() => cachedKey ?? 'normal');

  useEffect(() => {
    let alive = true;
    void hydrateTextScale().then((stored) => {
      if (alive && stored) setKeyState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setKey = useCallback((k: TextScaleKey) => {
    setKeyState(k);
    persistTextScale(k);
  }, []);

  const value = useMemo(
    () => ({
      key,
      scale: TEXT_SCALE_OPTIONS.find((o) => o.key === key)?.factor ?? 1,
      setKey,
    }),
    [key, setKey],
  );

  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
}

export function useTextScale(): TextScaleContextValue {
  const ctx = useContext(TextScaleContext);
  if (!ctx) return { key: 'normal', scale: 1, setKey: () => {} };
  return ctx;
}
