import Constants from 'expo-constants';

const DEFAULT_API_ORIGIN = 'https://golivra-api.onrender.com';

/**
 * URL du site officiel GoLivra.
 * Change cette seule valeur pour mettre à jour tous les liens de l'app.
 */
export const SITE_URL = 'https://golivra.onrender.com';

/** URLs dérivées du site — à utiliser dans toute l'app. */
export const SITE_URLS = {
  home: SITE_URL,
  privacy: `${SITE_URL}/politique-confidentialite`,
  terms: `${SITE_URL}/conditions-generales`,
  about: `${SITE_URL}/a-propos`,
  blog: `${SITE_URL}/blog`,
  supportEmail: 'support@golivra.onrender.com',
  supportPhone: '+243000000000',
  whatsapp: 'https://wa.me/243000000000',
  appStore: SITE_URL,
} as const;

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

export function isProductionBuild(): boolean {
  return !__DEV__;
}
