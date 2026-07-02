import Constants from 'expo-constants';

const DEFAULT_API_ORIGIN = 'https://golivra-api.onrender.com';

function normalizeOrigin(raw: string | undefined | null): string {
  let origin = (raw || DEFAULT_API_ORIGIN).trim().replace(/\/+$/, '');
  if (origin.toLowerCase().endsWith('/api')) {
    origin = origin.slice(0, -4);
  }
  return origin;
}

/** Origine API injectée au build (EAS / .env) ou via app.config extra. */
export function getApiOrigin(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  const fromExtra = extra?.apiBaseUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  return normalizeOrigin(fromEnv || fromExtra);
}

export function getSupabaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined;
  return (process.env.EXPO_PUBLIC_SUPABASE_URL || extra?.supabaseUrl || '').trim();
}

export function getSupabaseAnonKey(): string {
  const extra = Constants.expoConfig?.extra as { supabaseAnonKey?: string } | undefined;
  return (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra?.supabaseAnonKey || '').trim();
}

export function isProductionBuild(): boolean {
  return !__DEV__;
}
