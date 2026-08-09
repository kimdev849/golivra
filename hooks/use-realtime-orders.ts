import { useEffect, useRef, useState } from 'react';
import { supabase, hasSupabaseKeys } from '@/lib/supabase';

type UseRealtimeOrdersProps = {
  enterpriseId: string | null;
  refreshOrders: () => void;
  token: string | null;
};

/**
 * Fréquence du fallback polling.
 * - 20 s quand le temps réel est indisponible (clés absentes, connexion coupée)
 * - 60 s quand le temps réel est actif (filet de sécurité, coût réseau minimal)
 */
const POLL_INTERVAL_MS = 20_000;
const POLL_INTERVAL_WHEN_REALTIME_MS = 60_000;

/**
 * Hook pour écouter les nouvelles commandes.
 *
 * Deux mécanismes complémentaires :
 *  1. Supabase Realtime (push) — mise à jour instantanée quand une commande
 *     change. Ne fonctionne que si les clés Supabase sont injectées au build
 *     (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
 *  2. Fallback polling — rafraîchit la liste en arrière-plan :
 *     - à 20 s si le temps réel n'est pas connecté (clés absentes, ou socket
 *       qui tombe en cours d'utilisation → le polling reprend automatiquement)
 *     - à 60 s si le temps réel est connecté (simple garantie de fraîcheur)
 */
export function useRealtimeOrders({ enterpriseId, refreshOrders, token }: UseRealtimeOrdersProps) {
  const refreshRef = useRef(refreshOrders);
  refreshRef.current = refreshOrders;

  // Vrai quand le channel Supabase est effectivement abonné (statut SUBSCRIBED).
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // ── 1. Abonnement Supabase Realtime ───────────────────────────────────
  useEffect(() => {
    if (!enterpriseId || !token) return;
    // Sans clés Supabase injectées au build, le realtime est indisponible :
    // on laisse le polling seul (hasSupabaseKeys est constant à l'exécution).
    if (!hasSupabaseKeys) return;

    const channel = supabase
      .channel(`orders:${enterpriseId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'commandes',
          filter: `entreprise_id=eq.${enterpriseId}`,
        },
        (payload) => {
          console.log('🔔 Realtime: Changement détecté sur commande', payload.eventType);
          refreshRef.current();
        }
      )
      .subscribe((status) => {
        // SUBSCRIBED → le push fonctionne, on ralentit le polling.
        // CHANNEL_ERROR / TIMED_OUT → le push est tombé, le polling reprend vite.
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [enterpriseId, token]);

  // ── 2. Fallback polling (filet de sécurité permanent) ─────────────────
  // La fréquence s'adapte à l'état de la connexion temps réel : recréer
  // l'intervalle quand realtimeConnected change est rare et sans coût.
  useEffect(() => {
    if (!enterpriseId || !token) return;

    const intervalMs = realtimeConnected ? POLL_INTERVAL_WHEN_REALTIME_MS : POLL_INTERVAL_MS;
    const intervalId = setInterval(() => {
      refreshRef.current();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [enterpriseId, token, realtimeConnected]);
}
