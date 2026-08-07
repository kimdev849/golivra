import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Bike, CheckCircle2, Clock, ExternalLink, MapPin, Package, PhoneCall, Sparkles, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EventTimeline } from '@/components/event-timeline';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import type { TimelineStep as _TimelineStep } from '@/lib/datetime';
import { orderPollingIntervalMs } from '@/lib/order-status';
import { orderRefundMessage, orderStatusLabel } from '@/lib/ux-copy';

type LocalTimelineStep = {
  titre: string;
  date: string | null;
  type: 'fait' | 'encours' | 'afaire';
};

type OrderDetail = {
  id: string;
  numero: string;
  statut: string;
  total: number;
  adresse_livraison?: string;
  cree_le: string;
  sousCommandes?: {
    id: string;
    restaurant_id?: string;
    boutique_id?: string;
    statut: string;
    articles: { id: string; nom: string; quantite: number; prix_unitaire: number }[];
    livraison_id?: string;
  }[];
  livraison_id?: string | null;
  livraisons?: { id: string; statut: string; type_livraison?: string }[];
  livreur?: {
    nom: string;
    telephone: string;
    image_url?: string;
    note_moyenne?: number;
  };
  timeline?: {
    commande?: LocalTimelineStep[];
    livraisons?: { timeline?: LocalTimelineStep[] }[];
  };
};

function formatFcfa(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOrder = async () => {
      try {
        const token = await getSessionToken();
        if (!token) throw new Error('Non authentifié');

        const res = await apiFetch<OrderDetail>(`/api/orders/${id}`, { method: 'GET', token });
        if (!alive) return;
        setOrder(res);
        setLoading(false);
        // Suivi en temps réel : on replanifie un refresh silencieux selon
        // l'avancement (5 s pendant la livraison, 15 s en préparation, 30 s
        // en attente) et on s'arrête dès que la commande est livrée/annulée.
        if (timer) clearTimeout(timer);
        const interval = orderPollingIntervalMs(res.statut);
        if (interval !== false) {
          timer = setTimeout(() => void fetchOrder(), interval);
        }
      } catch {
        // Silencieux : on conserve l'état actuel, mais on replanifie quand même
        // un refresh (15 s) pour reprendre le suivi après une erreur réseau
        // transitoire au lieu de figer l'écran.
        if (alive) {
          setLoading(false);
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void fetchOrder(), 15_000);
        }
      }
    };

    void fetchOrder();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
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

  const isDelivered = order?.statut === 'livree';
  const refundMessage = orderRefundMessage(order?.statut);
  const isRefunded = refundMessage !== null;
  const rawSteps = order?.timeline?.livraisons?.[0]?.timeline || order?.timeline?.commande || [];
  const steps: _TimelineStep[] = rawSteps.map((s, i) => ({
    key: `step-${i}`,
    label: s.titre,
    at: s.date ?? '',
  }));
  const primaryDeliveryId =
    order?.livraison_id ||
    (Array.isArray(order?.livraisons) && order.livraisons.length > 0 ? order.livraisons[0].id : null);

  const allArticles = (order?.sousCommandes || []).flatMap((sc) => sc.articles || []);

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {isDelivered ? 'Détails de commande' : 'Suivi de commande'}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        
        {/* CARTE REMBOURSEMENT - commande expirée / annulée */}
        {isRefunded && (
          <View
            style={[
              styles.mapPreviewCard,
              { backgroundColor: colors.surface, borderColor: colors.warning },
            ]}>
            <View style={[styles.staticMapContainer, { backgroundColor: colors.warningSoft, justifyContent: 'center' }]}>
              <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
                <View style={[styles.etaIconBox, { backgroundColor: colors.warning }]}>
                  <Clock size={26} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
                </View>
                <ThemedText style={[styles.etaTime, { color: colors.text, textAlign: 'center' }]}>
                  {orderStatusLabel(order?.statut)}
                </ThemedText>
                <ThemedText style={[styles.etaLabel, { color: colors.textMuted, textAlign: 'center', lineHeight: 20 }]}>
                  {refundMessage}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* CARTE STATUT / PREVIEW - Uniquement si non livrée et non remboursée */}
        {!isDelivered && !isRefunded && (
          <View style={[styles.mapPreviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.staticMapContainer, { backgroundColor: colors.primarySoft }]}>
              {/* Illustration personnalisée GoLivra — plus d'image externe.
                  Halos + anneau d'icône + badges flottants, aux couleurs de la
                  palette (fonctionne en clair ET en sombre). */}
              <View style={[styles.artHalo, styles.artHaloA, { backgroundColor: colors.accentSoft }]} />
              <View style={[styles.artHalo, styles.artHaloB, { backgroundColor: colors.surface }]} />
              <View style={[styles.artRing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.artIconBox}>
                  {order?.statut === 'en_livraison' ? (
                    <Bike size={42} color="#FFFFFF" strokeWidth={2} />
                  ) : (
                    <Package size={42} color="#FFFFFF" strokeWidth={2} />
                  )}
                </View>
              </View>
              <View style={[styles.artBadge, styles.artBadgeA, { backgroundColor: colors.surface }]}>
                <Clock size={15} color={colors.primary} strokeWidth={2.4} />
              </View>
              <View style={[styles.artBadge, styles.artBadgeB, { backgroundColor: colors.surface }]}>
                <MapPin size={15} color={colors.primary} strokeWidth={2.4} />
              </View>
              <View style={[styles.artBadge, styles.artBadgeC, { backgroundColor: colors.surface }]}>
                <Sparkles size={14} color={colors.accent} strokeWidth={2.4} />
              </View>
              <View style={[styles.artDot, styles.artDotA, { backgroundColor: colors.accent }]} />
              <View style={[styles.artDot, styles.artDotB, { backgroundColor: colors.primary }]} />
              <View style={[styles.artDot, styles.artDotC, { backgroundColor: colors.borderStrong }]} />

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
                  <View style={styles.statusRow}>
                    <View style={[styles.etaIconBox, { backgroundColor: colors.primarySoft }]}>
                      <Package size={24} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.etaTime, { color: colors.text }]}>Préparation en cours</ThemedText>
                      <ThemedText style={[styles.etaLabel, { color: colors.textMuted, marginTop: 2 }]}>
                        Votre livreur sera assigné prochainement.
                      </ThemedText>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* INFO COMMANDE (Numéro, Date, Total) */}
        <View style={[styles.orderInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.orderInfoRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.orderLabel, { color: colors.textMuted }]}>Commande n°</ThemedText>
              <ThemedText style={[styles.orderValue, { color: colors.text }]}>{order?.numero || order?.id.slice(0, 8).toUpperCase()}</ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={[styles.orderLabel, { color: colors.textMuted }]}>Total</ThemedText>
              <ThemedText style={[styles.orderValue, { color: colors.primaryDeep, fontWeight: '700' }]}>{formatFcfa(order?.total)}</ThemedText>
            </View>
          </View>
          {isDelivered && (
            <View style={[styles.statusBanner, { backgroundColor: colors.successSoft }]}>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.statusBannerText, { color: colors.success }]}>Cette commande a été livrée avec succès.</ThemedText>
            </View>
          )}
        </View>

        {/* ARTICLES */}
        {allArticles.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Articles</ThemedText>
            </View>
            {allArticles.map((a, idx) => (
              <View key={`${a.id}-${idx}`} style={styles.articleRow}>
                <ThemedText style={[styles.articleQty, { color: colors.textSecondary }]}>{a.quantite}x</ThemedText>
                <ThemedText style={[styles.articleName, { color: colors.text }]}>{a.nom}</ThemedText>
                <ThemedText style={[styles.articlePrice, { color: colors.textMuted }]}>{formatFcfa(a.prix_unitaire * a.quantite)}</ThemedText>
              </View>
            ))}
          </View>
        )}

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
              <ThemedText style={[styles.timelineTitle, { color: colors.text }]}>{"Détails de l'acheminement"}</ThemedText>
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
  // 270px : assez haut pour que l'illustration (halos + anneau + badges) reste
  // visible au-dessus de l'overlay dans les DEUX états — « Préparation en cours »
  // (overlay court) et « En livraison » (overlay ETA plus haut).
  staticMapContainer: {
    height: 270,
    width: '100%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  // Illustration personnalisée (halos + anneau + badges flottants).
  artHalo: { position: 'absolute', borderRadius: 999 },
  artHaloA: { width: 200, height: 200, top: -70, left: -50 },
  artHaloB: { width: 150, height: 150, bottom: -60, right: -40 },
  artRing: {
    position: 'absolute',
    alignSelf: 'center',
    top: 26,
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  artIconBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C4F36',
  },
  artBadge: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  artBadgeA: { top: 22, right: 52 },
  artBadgeB: { top: 96, left: 40 },
  artBadgeC: { bottom: 142, left: 112 },
  artDot: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5 },
  artDotA: { top: 40, left: 60 },
  artDotB: { top: 56, right: 74 },
  artDotC: { bottom: 92, right: 116 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  deliveryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  deliveryLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryLinkTitle: { fontSize: 15, fontWeight: '800' },
  deliveryLinkSub: { fontSize: 12, marginTop: 2 },

  // Nouveaux styles pour le détail de commande
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  orderInfoCard: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  orderInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  orderValue: { fontSize: 16, fontWeight: '600' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 8 },
  statusBannerText: { fontSize: 13, fontWeight: '500' },
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  articleQty: { fontSize: 14, fontWeight: '600', width: 24 },
  articleName: { flex: 1, fontSize: 14 },
  articlePrice: { fontSize: 14, fontWeight: '500' },
});
