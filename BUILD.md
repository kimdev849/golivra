# Build GoLivra (APK / AAB / iOS)

## URL API en production

L’app appelle **`https://golivraback.onrender.com`** (sans `/api` à la fin). Cette URL est :

- codée en secours dans `lib/config.ts` ;
- injectée au build via `EXPO_PUBLIC_API_BASE_URL` dans `eas.json` (profils preview & production).

Pour un build local APK qui pointe vers votre PC :

```bash
# .env.local — appareil physique (même Wi‑Fi)
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
EXPO_PUBLIC_ALLOW_HTTP=1
```

Émulateur Android : `http://10.0.2.2:3000` + `EXPO_PUBLIC_ALLOW_HTTP=1`.

**Ne pas** utiliser `localhost` sur un téléphone réel.

## Commandes EAS

```bash
npm install -g eas-cli
eas login
eas build --profile production --platform android
eas build --profile production --platform ios
```

Scripts npm : `npm run build:android`, `npm run build:preview`.

## Variables à configurer (EAS Secrets ou `.env` au build)

| Variable | Obligatoire |
|----------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | Oui (défaut Render dans `eas.json`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Oui pour le temps réel |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Oui |

## Après changement de `.env`

```bash
npx expo start -c
```

Les variables `EXPO_PUBLIC_*` sont lues **au démarrage / au build**, pas à chaud.

## CORS backend

Sur Render, `CORS_ORIGINS` doit autoriser les origines Expo / store si besoin. L’app mobile native n’est en général pas bloquée par CORS ; le web oui.
