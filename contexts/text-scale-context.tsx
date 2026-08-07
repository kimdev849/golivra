import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Taille de texte globale (réglage utilisateur).
 * Stockée localement (AsyncStorage) — aucune colonne en base, aucun changement backend.
 */

export type TextScaleKey = 'petit' | 'normal' | 'grand';

export const TEXT_SCALE_OPTIONS: { key: TextScaleKey; label: string; factor: number }[] = [
  { key: 'petit', label: 'Petit', factor: 0.9 },
  { key: 'normal', label: 'Normal', factor: 1 },
  { key: 'grand', label: 'Grand', factor: 1.15 },
];

const STORAGE_KEY = 'golivra_text_scale_v1';

type TextScaleContextValue = {
  key: TextScaleKey;
  scale: number;
  setKey: (k: TextScaleKey) => void;
};

const TextScaleContext = createContext<TextScaleContextValue | null>(null);

export function TextScaleProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<TextScaleKey>('normal');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!alive) return;
        if (v === 'petit' || v === 'grand') setKeyState(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setKey = useCallback((k: TextScaleKey) => {
    setKeyState(k);
    AsyncStorage.setItem(STORAGE_KEY, k).catch(() => {});
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
