# Build GoLivra (APK / AAB / iOS)

## URL API en production

L'app appelle **`https://golivra-api.onrender.com`** (sans `/api` à la fin). Cette URL est :

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
la version de l'app (`version: "1.0.0"`, incrémentée par EAS via
`autoIncrement`). Une mise à jour n'est reçue que par les installations dont
la version du binaire correspond à celle de la mise à jour.

→ Après tout changement de `version`, `runtimeVersion` ou de configuration
natif, **il faut rebuilder** (`npm run build:android` / `npm run build:preview`) :
la runtime version est figée dans le binaire au build. Ensuite, chaque
`eas update` corrige le JavaScript/le contenu sans rebuild.

L'app vérifie les mises à jour au lancement + au retour au premier plan
(`lib/update-checker.ts`) et propose un bouton **« Redémarrer »** pour
appliquer immédiatement une mise à jour téléchargée.

## Après changement de `.env`

```bash
npx expo start -c
```

Les variables `EXPO_PUBLIC_*` sont lues **au démarrage / au build**, pas à chaud.

## CORS backend

Sur Render, `CORS_ORIGINS` doit autoriser les origines Expo / store si besoin. L'app mobile native n'est en général pas bloquée par CORS ; le web oui.

---

## 🔧 Fix : Erreur "L'application n'a pas été installée" (Build 23)

**Date :** 19 août 2026

### Problème

L'erreur **"L'application n'a pas été installée"** sur certains téléphones Android 12-13 était causée par l'**architecture CPU**. L'APK EAS par défaut compile uniquement pour `arm64-v8a` (64-bit ARM). Si le téléphone a un processeur `armeabi-v7a` (32-bit) ou autre architecture, l'installation échoue silencieusement après l'étape "Analyse des packages".

### Cause

Le build par défaut d'EAS Build (Expo SDK 52+) ne produit un APK compatible que pour `arm64-v8a` en mode production. Les téléphones avec processeur 32-bit ou architecture différente rejettent l'APK.

### Solution appliquée

Ajout de `android.abi` dans `app.config.ts` pour forcer un APK **universel** (toutes architectures) :

```typescript
android: {
  // ... autres configs
  abi: ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
},
```

Cela inclut :
- `arm64-v8a` — ARM 64-bit (la plupart des téléphones récents)
- `armeabi-v7a` — ARM 32-bit (téléphones plus anciens / entrée de gamme)
- `x86_64` — x86 64-bit (émulateurs, Chromebooks)

### Historique des builds

| Build | VersionCode | Statut       | Architecture        | Lien de téléchargement |
|-------|-------------|--------------|---------------------|------------------------|
| 19    | 20          | ✅ Terminé   | arm64-v8a seul      | [APK EAS](https://expo.dev/artifacts/eas/b_ep3vJR5ftgDdgiA-vcgFyWs_nKUqQr8zWJ1cc1oK8.apk) |
| 21    | -           | ❌ Annulé    | -                   | -                      |
| 22    | -           | ❌ Annulé    | -                   | -                      |
| **23**| **23**      | ✅ Terminé   | **Universel (toutes)** | **[GoFile](https://gofile.io/d/3i0QyMKS)** |

### Lien de téléchargement public (Build 23 — universel)

** https://gofile.io/d/3i0QyMKS **

### Comment reproduire un upload GoFile

```bash
# 1. Télécharger l'APK depuis EAS (remplacer l'URL par celle du build)
curl -L -o GoLivra-Production.apk "https://expo.dev/artifacts/eas/XXXXX.apk"

# 2. Trouver un serveur GoFile disponible
SERVER=$(curl -s https://api.gofile.io/servers | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

# 3. Uploader l'APK
curl -F "file=@GoLivra-Production.apk" "https://${SERVER}.gofile.io/contents/uploadfile"

# 4. La réponse contient le lien de téléchargement :
# "downloadPage": "https://gofile.io/d/XXXXX"
```

### Étapes d'installation sur le téléphone

1. **Redémarrer** le téléphone complètement
2. Ouvrir le lien GoFile dans le **navigateur** du téléphone
3. **Télécharger** l'APK
4. **Autoriser l'installation** depuis sources inconnues (si demandé)
5. **Installer**

### Dépannage si ça ne marche toujours pas

1. **Paramètres → Apps** → chercher "GoLivra" (même si désinstallée)
2. Si elle apparaît → **Supprimer les données** puis réessayer
3. **Désactiver Google Play Protect** temporairement :
   - Play Store → profil → Play Protect → ⚙️ → désactiver l'analyse
4. **Redémarrer** le téléphone et réessayer
5. Si rien ne marche : **Paramètres → Système → Réinitialiser les préférences d'applications** (ne supprime aucune donnée personnelle)

> ⚠️ Le problème de clé de signature est rare mais possible. Si l'ancienne version de GoLivra était signée avec une clé différente, Android refuse l'installation. La seule solution dans ce cas est de réinitialiser complètement le téléphone ou d'attendre une version avec la même clé de signature.
