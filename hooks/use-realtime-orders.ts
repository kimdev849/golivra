import { useEffect } from 'react';
import { supabase, hasSupabaseKeys } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type UseRealtimeOrdersProps = {
  enterpriseId: string | null;
  refreshOrders: () => void;
  token: string | null;
};

/**
 * Hook pour écouter les nouvelles commandes en temps réel via Supabase Realtime.
 * Met à jour automatiquement la liste des commandes quand une insertion/modification a lieu.
 */
export function useRealtimeOrders({ enterpriseId, refreshOrders, token }: UseRealtimeOrdersProps) {
  useEffect(() => {
    // Ne pas lancer si pas d'entreprise, pas connecté ou clés manquantes
    if (!enterpriseId || !token || !hasSupabaseKeys) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      // S'abonner aux changements sur la table 'commandes'
      channel = supabase
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
            // Quand une commande change, on rafraîchit la liste
            refreshOrders();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      // Nettoyage : se désabonner quand on quitte l'écran
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enterpriseId, refreshOrders, token]);
}
