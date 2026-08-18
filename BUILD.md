# Build GoLivra (APK / AAB / iOS)

## URL API en production

L’app appelle **`https://golivra-api.onrender.com`** (sans `/api` à la fin). Cette URL est :

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

> ⚠️ Plus de variables Supabase : le temps réel Supabase côté mobile a été retiré
> (fuite de données via la clé anon sur `commandes` — voir `docs/decisions/0001-*.md`).
> Le rafraîchissement des commandes vendeur passe par le polling API (20 s).

## Mises à jour OTA (`eas update`)

Publier une mise à jour JavaScript (sans rebuild) sur un canal :

```bash
npm run update:dev -- "message"      # canal development
npm run update:preview -- "message" # canal preview
npm run update:prod -- "message"    # canal production
```

**Important (runtimeVersion) :** `app.config.ts` utilise la politique
`runtimeVersion: { "policy": "appVersion" }` — la runtime version suit donc
la version de l’app (`version: "1.0.0"`, incrémentée par EAS via
`autoIncrement`). Une mise à jour n’est reçue que par les installations dont
la version du binaire correspond à celle de la mise à jour.

→ Après tout changement de `version`, `runtimeVersion` ou de configuration
natif, **il faut rebuilder** (`npm run build:android` / `npm run build:preview`) :
la runtime version est figée dans le binaire au build. Ensuite, chaque
`eas update` corrige le JavaScript/le contenu sans rebuild.

L’app vérifie les mises à jour au lancement + au retour au premier plan
(`lib/update-checker.ts`) et propose un bouton **« Redémarrer »** pour
appliquer immédiatement une mise à jour téléchargée.

## Après changement de `.env`

```bash
npx expo start -c
```

Les variables `EXPO_PUBLIC_*` sont lues **au démarrage / au build**, pas à chaud.

## CORS backend

Sur Render, `CORS_ORIGINS` doit autoriser les origines Expo / store si besoin. L’app mobile native n’est en général pas bloquée par CORS ; le web oui.
