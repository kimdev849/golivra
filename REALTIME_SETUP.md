# Configuration Temps Réel - GoLivra

## ✅ Ce qui a été fait

### 1. Installation des dépendances
- `@supabase/supabase-js` : Client Supabase pour le temps réel
- `react-native-url-polyfill` : Polyfill URL pour React Native

### 2. Fichiers créés

#### `lib/supabase.ts`
Client Supabase configuré pour le temps réel.
- Utilise les variables d'env `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Gère automatiquement les sessions et le refresh des tokens

#### `hooks/use-realtime-orders.ts`
Hook React pour écouter les commandes en temps réel.
- S'abonne aux changements sur la table `commandes`
- Déclenche un rafraîchissement automatique à chaque insertion/modification
- Se désabonne proprement quand on quitte l'écran

### 3. Fichiers modifiés

#### `app/_layout.tsx`
- Initialisation globale de l'application

#### `app/vendor/(tabs)/orders.tsx`
- Intégration du hook `useRealtimeOrders`
- Les commandes se mettent à jour automatiquement sans rafraîchissement manuel

#### `.env.local` et `.env.example`
- Ajout des variables `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 🔧 Configuration requise (À FAIRE)

### Étape 1 : Configurer Supabase

1. **Activer la réplication** :
   - Va sur ton dashboard Supabase
   - Menu **Database** → **Replication**
   - Coche la table `commandes` (et `livraisons` si besoin)

2. **Récupérer les clés** :
   - Menu **Project Settings** (roue dentée) → **API**
   - Copie :
     - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
     - `anon public` → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

3. **Mettre à jour `.env.local`** :
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://ton-vrai-projet.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
   ```

### Étape 2 : Redémarrer l'application

```bash
# Arrête le serveur Expo
# Puis redémarre-le en vidant le cache
npx expo start -c
```

---

## 🎯 Comment ça marche ?

### Temps Réel (Realtime)
1. Le vendeur ouvre l'écran des commandes (`app/vendor/(tabs)/orders.tsx`)
2. Le hook `useRealtimeOrders` s'abonne à la table `commandes` pour l'ID de son entreprise
3. Quand un client passe commande :
   - La base de données Supabase détecte l'INSERT
   - Envoie un événement temps réel
   - Le hook reçoit l'événement et appelle `refresh()`
   - L'écran se met à jour **automatiquement** (plus besoin de bouton "Rafraîchir")


## 🧪 Tester le temps réel

1. **Ouvre l'app vendeur** sur ton téléphone
2. Va dans l'écran **Commandes**
3. **Depuis un autre appareil** (ou via Supabase) :
   - Insère une nouvelle commande dans la table `commandes` avec le bon `entreprise_id`
   - Ou update une commande existante
4. **Observe** : La liste des commandes se met à jour **toute seule** !

---

## 📝 Notes

- Le temps réel ne fonctionne que si l'entreprise est connectée (`shop?.id`)
- Le hook se désabonne automatiquement quand on quitte l'écran (pas de fuite de mémoire)
- Les variables d'environnement doivent être définies dans `.env.local` (dev) ou EAS Secrets (build)

---

## 🚀 Prochaines étapes (Optionnel)

- [ ] Ajouter le temps réel sur le **Dashboard Vendeur** (`app/vendor/(tabs)/index.tsx`)
- [ ] Ajouter le temps réel pour les **livraisons** (`app/vendor/(tabs)/deliveries.tsx`)
- [ ] Ajouter des **tests** pour le hook `useRealtimeOrders`

---

## 🆘 Dépannage

### "⚠️ Supabase keys missing"
- Vérifie que `.env.local` existe avec les bonnes clés
- Redémarre Expo avec `npx expo start -c`

### Le temps réel ne marche pas
1. Vérifie que la table `commandes` est bien en **Replication** dans Supabase
2. Vérifie que `enterprise_id` est bien filtré
3. Regarde la console : tu devrais voir `🔔 Realtime: Changement détecté...`

