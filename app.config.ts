import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuration Expo GoLivra — source unique (app.json supprimé).
 *
 * Push notifications Android : GoLivra utilise FCM via l'Expo Push Service.
 * L'app ne peut recevoir de push quand elle est fermée que si l'APK contient
 * les credentials Firebase (google-services.json).
 *
 * → Dépose le fichier `google-services.json` (téléchargé depuis Firebase
 *   Console → votre projet → Ajouter une app Android, package `kimjaver.golivra`)
 *   à la racine de golivra_mobile/. Le câblage s'active automatiquement ici et
 *   le prochain build EAS inclura FCM.
 *
 * Si le fichier est absent, le build reste inchangé : ce champ est
 * volontairement conditionnel pour ne jamais casser un build en attente.
 */
const GOOGLE_SERVICES_FILE = './google-services.json';
const hasGoogleServicesFile = existsSync(join(__dirname, GOOGLE_SERVICES_FILE));

const DEFAULT_API = 'https://golivra-api.onrender.com';
const EAS_PROJECT_ID = '616a433a-2cbc-4134-9166-9a684231567b';

function normalizeApiOrigin(raw: string | undefined): string {
  let origin = (raw || DEFAULT_API).trim().replace(/\/+$/, '');
  if (origin.toLowerCase().endsWith('/api')) origin = origin.slice(0, -4);
  return origin;
}

const apiBaseUrl = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_BASE_URL);

/** Autorise HTTP uniquement en dev local (émulateur / LAN). Jamais en build EAS production. */
const allowCleartext =
  process.env.EXPO_PUBLIC_ALLOW_HTTP === '1' ||
  (process.env.EAS_BUILD_PROFILE !== 'production' &&
    Boolean(apiBaseUrl.match(/^http:\/\//i)));

const base: ExpoConfig = {
  name: 'GoLivra',
  slug: 'golivra',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/app.icon.png',
  scheme: 'golivra',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#03160D',
      foregroundImage: './assets/images/app.icon.png',
      monochromeImage: './assets/images/app.icon.png',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
    package: 'kimjaver.golivra',
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/app.icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/app.icon.png',
        resizeMode: 'contain',
        backgroundColor: '#062A1B',
        dark: {
          image: './assets/images/app.icon.png',
          backgroundColor: '#062A1B',
        },
      },
    ],
    'expo-web-browser',
    [
      'expo-image-picker',
      {
        photosPermission: 'GoLivra accède à vos photos pour personnaliser votre profil et vos produits.',
        cameraPermission: 'GoLivra utilise la caméra pour prendre la photo de preuve lors de la livraison.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'GoLivra utilise votre position pour enregistrer votre adresse de livraison et aider le livreur à vous trouver plus facilement.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#0E86D4',
        defaultChannel: 'golivra-default',
        sounds: [],
        androidMode: 'default',
        androidCollapsedTitle: 'GoLivra',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: false,
  },
  extra: {
    router: {},
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  // Le projet EAS (extra.eas.projectId) appartient au compte `golivra-app`
  // (transféré depuis devkim242 pour disposer d'un quota EAS neuf).
  // Le champ `owner` doit correspondre au propriétaire réel du projet,
  // sinon le CLI EAS bloque les commandes.
  owner: 'golivra-app',
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...base,
    android: {
      ...base.android,
      package: base.android?.package ?? 'kimjaver.golivra',
      ...(allowCleartext ? { usesCleartextTraffic: true } : {}),
      // Push notifications : FCM (voir en-tête de fichier). Actif dès que
      // google-services.json est présent à la racine du projet.
      ...(hasGoogleServicesFile ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
    } as ExpoConfig['android'],
    ios: {
      ...base.ios,
      supportsTablet: true,
    },
    extra: {
      ...base.extra,
      ...config?.extra,
      apiBaseUrl,
      eas: {
        ...(base.extra?.eas ?? {}),
        projectId: EAS_PROJECT_ID,
      },
    },
  };
};
