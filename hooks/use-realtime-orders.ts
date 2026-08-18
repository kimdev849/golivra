import { useEffect, useRef } from 'react';

type UseRealtimeOrdersProps = {
  enterpriseId: string | null;
  refreshOrders: () => void;
};

/**
 * Rafraîchit les commandes d'un vendeur.
 *
 * ⚠️ Historique : ce hook s'abonnait en temps réel aux changements de la table
 * `commandes` via Supabase Realtime avec la clé ANON embarquée dans le binaire
 * de l'app. Sans RLS activé sur la table (cf. golivraback/sql/rls-deny-by-default.sql),
 * N'IMPORTE QUI pouvait extraire cette clé publique de l'APK et recevoir toutes
 * les commandes de tous les marchands. Décision (ADR-0001) : on n'abonne plus
 * jamais le client à des tables sensibles avec une clé publique — le polling
 * via l'API authentifiée est le seul mécanisme fiable et sûr.
 *
 * Fréquence : 20 s. Suffisant pour la livraison, coût réseau minimal, et aucun
 * canal non authentifié vers la base.
 */
const POLL_INTERVAL_MS = 20_000;

export function useRealtimeOrders({ enterpriseId, refreshOrders }: UseRealtimeOrdersProps) {
  const refreshRef = useRef(refreshOrders);
  refreshRef.current = refreshOrders;

  useEffect(() => {
    if (!enterpriseId) return;

    const intervalId = setInterval(() => {
      refreshRef.current();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [enterpriseId]);
}
