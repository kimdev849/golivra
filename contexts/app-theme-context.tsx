import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  paletteForScheme,
  type AppPalette,
  type ColorSchemeName,
} from '@/constants/app-palette';
import { getSessionToken } from '@/lib/auth';
import { fetchPreferences, updatePreferences } from '@/lib/preferences-api';

const STORAGE_KEY = 'golivra_theme_preference_v1';

export type ThemePreference = 'system' | 'light' | 'dark';

type AppThemeContextValue = {
  colorScheme: ColorSchemeName;
  preference: ThemePreference;
  colors: AppPalette;
  isDark: boolean;
  ready: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function resolveScheme(preference: ThemePreference, system: ColorSchemeName | null | undefined): ColorSchemeName {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return system === 'dark' ? 'dark' : 'light';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let pref: ThemePreference =
          stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';

        const token = await getSessionToken();
        if (token) {
          try {
            const remote = await fetchPreferences(token);
            if (remote.dark_mode === true) pref = 'dark';
            else if (remote.dark_mode === false) pref = 'light';
            else if (remote.dark_mode === null) pref = 'system';
          } catch {
            /* garde le stockage local */
          }
        }

        if (alive) {
          setPreferenceState(pref);
          await AsyncStorage.setItem(STORAGE_KEY, pref);
        }
      } catch {
        /* défaut system */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const colorScheme = resolveScheme(preference, systemScheme ?? 'light');
  const colors = useMemo(() => paletteForScheme(colorScheme), [colorScheme]);

  const persistPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
    const token = await getSessionToken();
    if (token) {
      try {
        const dark_mode = pref === 'system' ? null : pref === 'dark';
        await updatePreferences(token, { dark_mode });
      } catch {
        /* local OK */
      }
    }
  }, []);

  const setPreference = useCallback(
    async (pref: ThemePreference) => {
      await persistPreference(pref);
    },
    [persistPreference],
  );

  const setDarkMode = useCallback(
    async (enabled: boolean) => {
      await persistPreference(enabled ? 'dark' : 'light');
    },
    [persistPreference],
  );

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colorScheme,
      preference,
      colors,
      isDark: colorScheme === 'dark',
      ready,
      setPreference,
      setDarkMode,
    }),
    [colorScheme, preference, colors, ready, setPreference, setDarkMode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}

export function useAppThemeOptional(): AppThemeContextValue | null {
  return useContext(AppThemeContext);
}
