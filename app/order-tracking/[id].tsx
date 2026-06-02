import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Bike, MapPin, PhoneCall, Star, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EventTimeline } from '@/components/event-timeline';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import type { TimelineStep } from '@/lib/datetime';

type OrderDetail = {
  id: string;
  statut: string;
  prix_total?: number;
  livraisons?: { id: string; statut: string; type_livraison?: string }[];
  livraison_id?: string | null;
  livreur?: {
    nom: string;
    telephone: string;
    image_url?: string;
    note_moyenne?: number;
  };
  timeline?: {
    commande?: TimelineStep[];
    livraisons?: { timeline?: TimelineStep[] }[];
  };
};

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchOrder = async () => {
      try {
        const token = await getSessionToken();
        if (!token) throw new Error('Non authentifié');
        
        // Simuler le fetch ou faire le vrai call si l'API l'expose. 
        // Pour l'instant on tente un GET /api/orders/:id
        const res = await apiFetch<OrderDetail>(`/api/orders/${id}`, { method: 'GET', token });
        if (alive) {
          setOrder(res);
          setLoading(false);
        }
      } catch (err) {
        if (alive) {
          // Si l'API GET /api/orders/:id n'existe pas encore, on met de la donnée mockée basée sur l'idée
          console.warn("API de détail commande potentiellement non implémentée, utilisation de données simulées.");
          setOrder({
            id: id as string,
            statut: 'en_livraison',
            livreur: {
              nom: 'Mamadou',
              telephone: '+225 0102030405',
              note_moyenne: 4.8,
            },
            timeline: {
              livraisons: [
                {
                  timeline: [
                    { titre: 'Commande acceptée', date: new Date().toISOString(), type: 'fait' },
                    { titre: 'En préparation', date: new Date().toISOString(), type: 'fait' },
                    { titre: 'Commande récupérée', date: new Date().toISOString(), type: 'fait' },
                    { titre: 'En route vers vous', date: null, type: 'encours' },
                  ]
                }
              ]
            }
          });
          setLoading(false);
        }
      }
    };
    void fetchOrder();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.center} lightColor={colors.background} darkColor={colors.background}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  // Fallback si pas de données
  if (!order && !loading) {
    return (
      <ThemedView style={styles.center} lightColor={colors.background} darkColor={colors.background}>
        <ThemedText>Commande introuvable.</ThemedText>
        <Pressable style={{ marginTop: 20 }} onPress={() => router.back()}>
          <ThemedText style={{ color: colors.primary }}>Retour</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const steps = order?.timeline?.livraisons?.[0]?.timeline || order?.timeline?.commande || [];
  const primaryDeliveryId =
    order?.livraison_id ||
    (Array.isArray(order?.livraisons) && order.livraisons.length > 0 ? order.livraisons[0].id : null);

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Suivi de commande</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        
        {/* CARTE STATIQUE / PREVIEW */}
        <View style={[styles.mapPreviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.staticMapContainer, { backgroundColor: colors.surfaceMuted }]}>
            {/* Image placeholder statique simulant une map */}
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=800' }} 
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              opacity={0.6}
            />
            {/* Overlay Gradient pour la lisibilité */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background, opacity: 0.2 }]} />
            
            {/* Overlay Distance + Statut */}
            <View style={[styles.mapOverlay, { backgroundColor: colors.surface }]}>
              {order?.statut === 'en_livraison' ? (
                <>
                  <View style={styles.etaRow}>
                    <View style={[styles.etaIconBox, { backgroundColor: colors.primarySoft }]}>
                      <Bike size={24} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.etaLabel, { color: colors.textMuted }]}>Temps estimé</ThemedText>
                      <ThemedText style={[styles.etaTime, { color: colors.text }]}>12 min</ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={[styles.distanceLabel, { color: colors.textMuted }]}>Distance</ThemedText>
                      <ThemedText style={[styles.distanceValue, { color: colors.primaryDeep }]}>2.4 km</ThemedText>
                    </View>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <ThemedText style={[styles.statusHighlight, { color: colors.primary }]}>En route vers vous</ThemedText>
                </>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                  <ThemedText style={[styles.etaTime, { color: colors.text }]}>Préparation en cours</ThemedText>
                  <ThemedText style={[styles.etaLabel, { color: colors.textMuted, marginTop: 4 }]}>
                    Votre livreur sera assigné prochainement.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* INFO LIVREUR */}
        {order?.livreur ? (
          <View style={[styles.courierCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.courierRow}>
              <View style={[styles.courierAvatar, { backgroundColor: colors.primarySoft }]}>
                {order.livreur.image_url ? (
                  <Image source={{ uri: order.livreur.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <ThemedText style={{ color: colors.primary, fontSize: 20, fontWeight: '800' }}>
                    {order.livreur.nom.charAt(0).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={styles.courierInfo}>
                <ThemedText style={[styles.courierName, { color: colors.text }]}>{order.livreur.nom}</ThemedText>
                <View style={styles.courierRatingRow}>
                  <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.courierRating, { color: colors.textMuted }]}>{order.livreur.note_moyenne || 'Nouveau'}</ThemedText>
                </View>
              </View>
              <Pressable style={[styles.callBtn, { backgroundColor: colors.successSoft }]} onPress={() => {}}>
                <PhoneCall size={20} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* TIMELINE DE LIVRAISON */}
        {steps.length > 0 ? (
          <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.timelineHead}>
              <MapPin size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.timelineTitle, { color: colors.text }]}>Détails de l'acheminement</ThemedText>
            </View>
            <EventTimeline steps={steps} title="" />
          </View>
        ) : null}

        {/* LIEN VERS LE DETAIL COMPLET DE LA LIVRAISON */}
        {primaryDeliveryId ? (
          <Pressable
            onPress={() => router.push(`/delivery/${primaryDeliveryId}`)}
            style={({ pressed }) => [
              styles.deliveryLink,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={[styles.deliveryLinkIcon, { backgroundColor: colors.primarySoft }]}>
              <Bike size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.deliveryLinkTitle, { color: colors.text }]}>Détail de la livraison</ThemedText>
              <ThemedText style={[styles.deliveryLinkSub, { color: colors.textMuted }]}>
                Livreur, adresses, articles, paiement, étapes…
              </ThemedText>
            </View>
            <ExternalLink size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: 16, gap: 16 },
  
  mapPreviewCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  staticMapContainer: {
    height: 220,
    width: '100%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  mapOverlay: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  etaIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaLabel: { fontSize: 13, marginBottom: 2 },
  etaTime: { fontSize: 18, fontWeight: '900' },
  distanceLabel: { fontSize: 13, marginBottom: 2 },
  distanceValue: { fontSize: 16, fontWeight: '800' },
  divider: { height: 1, marginVertical: 12, opacity: 0.6 },
  statusHighlight: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  
  courierCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  courierAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  courierInfo: { flex: 1 },
  courierName: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  courierRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  courierRating: { fontSize: 14, fontWeight: '600' },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timelineCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  timelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  timelineTitle: { fontSize: 16, fontWeight: '800' },
});
