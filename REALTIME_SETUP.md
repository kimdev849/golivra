# Temps réel des commandes — DÉCISION : retiré (polling uniquement)

> **Statut : remplacé par le polling.** Ce document explique pourquoi le temps
> réel Supabase (Realtime) a été retiré du mobile et comment le réintroduire
> correctement si un jour il devient indispensable.

## Pourquoi c'est retiré

L'app s'abonnait aux changements de la table `commandes` (les commandes clients)
via Supabase Realtime avec la **clé anon** embarquée dans le binaire de l'app.

Problème : la clé `anon` est **publique** (extraite de n'importe quel APK). Sans
RLS activé sur la table `commandes`, n'importe qui pouvait s'abonner et recevoir
**toutes les commandes de tous les marchands** (INSERT/UPDATE/DELETE + données).

C'était exactement le cas : la base n'avait **aucune politique RLS** (vérifiable
via `golivraback/sql/rls-deny-by-default.sql`, qui colmate la fuite).

## Ce qui a été fait

1. `hooks/use-realtime-orders.ts` → **polling uniquement** (20 s) via l'API
   authentifiée. Aucun canal non authentifié vers la base.
2. Supprimés : `lib/supabase.ts`, `lib/check-supabase.ts`, les variables
   `EXPO_PUBLIC_SUPABASE_*` (`.env.example`, `app.config.ts`, `BUILD.md`).
3. Migration `golivraback/sql/rls-deny-by-default.sql` : RLS deny-by-default sur
   les tables sensibles + retrait des tables de la publication `supabase_realtime`.
4. ADR : `docs/decisions/0001-realtime-polling.md`.

## Comment réintroduire le temps réel correctement (si un jour nécessaire)

Le modèle d'auth actuel (sessions opaques maison, pas de Supabase Auth) rend le
Realtime anon inutilisable **et** dangereux. Pour le faire proprement il faudrait :

1. Passer l'authentification mobile sur **Supabase Auth** (JWT avec `auth.uid()`).
2. Activer RLS sur `commandes` avec une policy par entreprise :
   ```sql
   CREATE POLICY "commercant voit ses commandes"
     ON commandes FOR SELECT
     USING (entreprise_id = auth.jwt() ->> 'entreprise_id');
   ```
3. Remettre `commandes` dans la publication `supabase_realtime` (Dashboard →
   Database → Replication) **après** l'étape 2.
4. Réintroduire le client Supabase côté mobile avec la **session utilisateur**
   (jamais la clé anon seule).

Tant que ces 4 conditions ne sont pas réunies : **polling uniquement**.
