import { SafeAsyncStorage as AsyncStorage } from '@/lib/safe-async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import {
  paletteForScheme,
  type AppPalette,
  type ColorSchemeName,
} from '@/constants/app-palette';
import { getSessionToken } from '@/lib/auth';
import { fetchPreferences, updatePreferences } from '@/lib/preferences-api';

const STORAGE_KEY = 'golivra_theme_preference_v1';
/** Migration unique : purge une ancienne préférence 'dark' stockée sans choix explicite. */
const MIGRATION_KEY = 'golivra_theme_migration_v1';

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
  // Sur web, on ajoute un listener matchMedia pour détecter les changements
  // de thème système (dark↔light) car React Native Web ne réagit pas
  // toujours aux changements prefers-color-scheme en temps réel.
  const [webSystemScheme, setWebSystemScheme] = useState<ColorSchemeName | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setWebSystemScheme(e.matches ? 'dark' : 'light');
    };
    setWebSystemScheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const effectiveSystem = webSystemScheme ?? systemScheme;

  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);

        // Migration unique : une ancienne version a pu verrouiller le thème en
        // 'dark' (toggle ou synchro serveur) sans choix explicite. On ne touche
        // QUE les appareils réellement bloqués en 'dark' — les choix volontaires
        // clair/sombre restent intacts. On repart sur « système » pour que l'app
        // suive le téléphone, et on nettoie le serveur.
        let effectiveStored = stored;
        const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
        if (!migrated && stored === 'dark') {
          await AsyncStorage.setItem(STORAGE_KEY, 'system');
          await AsyncStorage.setItem(MIGRATION_KEY, '1');
          effectiveStored = 'system';
          const migrationToken = await getSessionToken();
          if (migrationToken) {
            try {
              await updatePreferences(migrationToken, { dark_mode: null });
            } catch {
              /* réseau indisponible : la prochaine synchro suffira */
            }
          }
        }

        const hasLocalPref =
          effectiveStored === 'light' || effectiveStored === 'dark' || effectiveStored === 'system';
        let pref: ThemePreference = hasLocalPref ? (effectiveStored as ThemePreference) : 'system';

        const token = await getSessionToken();
        if (!token) {
          // Sans session (connexion / inscription) : l'app suit fidèlement le
          // téléphone. On purge aussi une ancienne valeur sombre résiduelle.
          pref = 'system';
        } else if (!hasLocalPref) {
          // Premier lancement / nouvel appareil sans préférence locale : on peut
          // reprendre celle du compte. Sinon, le choix local fait foi : un
          // téléphone en mode clair garde l'app claire, même si le serveur
          // garde une ancienne valeur sombre.
          try {
            const remote = await fetchPreferences(token);
            if (remote.dark_mode === true) pref = 'dark';
            else if (remote.dark_mode === false) pref = 'light';
            else pref = 'system';
          } catch {
            /* garde le défaut system */
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

  const colorScheme = resolveScheme(preference, effectiveSystem ?? 'light');
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
