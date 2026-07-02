import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const DEFAULT_API = 'https://golivraback.onrender.com';

function normalizeApiOrigin(raw: string | undefined): string {
  let origin = (raw || DEFAULT_API).trim().replace(/\/+$/, '');
  if (origin.toLowerCase().endsWith('/api')) origin = origin.slice(0, -4);
  return origin;
}

const apiBaseUrl = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/** Autorise HTTP uniquement en dev local (émulateur / LAN). Jamais en build EAS production. */
const allowCleartext =
  process.env.EXPO_PUBLIC_ALLOW_HTTP === '1' ||
  (process.env.EAS_BUILD_PROFILE !== 'production' &&
    Boolean(apiBaseUrl.match(/^http:\/\//i)));

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = (appJson as { expo: ExpoConfig }).expo;

  return {
    ...base,
    name: 'GoLivra',
    slug: base.slug ?? 'golivra',
    android: {
      ...base.android,
      package: base.android?.package ?? 'kimjaver.golivra',
      ...(allowCleartext ? { usesCleartextTraffic: true } : {}),
    } as ExpoConfig['android'],
    ios: {
      ...base.ios,
      supportsTablet: true,
      bundleIdentifier: base.ios?.bundleIdentifier,
    },
    extra: {
      ...base.extra,
      ...config?.extra,
      apiBaseUrl,
      supabaseUrl,
      supabaseAnonKey,
      eas: {
        ...(typeof base.extra === 'object' && base.extra && 'eas' in base.extra
          ? (base.extra as { eas?: object }).eas
          : {}),
        projectId:
          (typeof base.extra === 'object' &&
            base.extra &&
            'eas' in base.extra &&
            (base.extra as { eas?: { projectId?: string } }).eas?.projectId) ||
          'e05e349a-fb96-4adb-ae4c-e8be602b1537',
      },
    },
  };
};
