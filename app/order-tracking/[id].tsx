import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Bike, CheckCircle2, Clock, ExternalLink, MapPin, Package, PhoneCall, Smartphone, Sparkles, Star } from 'lucide-react-native';
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
import { formatFcfa } from '@/lib/format';

type LocalTimelineStep = {
  titre: string;
  date: string | null;
  type: 'fait' | 'encours' | 'afaire';
};

type SousCommandeDetail = {
  id: string;
  restaurant_id?: string;
  boutique_id?: string;
  statut: string;
  commerce_nom?: string | null;
  total?: number | null;
  articles: { id: string; nom: string; quantite: number; prix_unitaire: number }[];
  livraison_id?: string;
};

type OrderDetail = {
  id: string;
  numero: string;
  statut: string;
  total: number;
  adresse_livraison?: string;
  cree_le: string;
  sousCommandes?: SousCommandeDetail[];
  /**
   * Estimation d'arrivée calculée par l'API (préparation + zone de livraison).
   */
  eta?: {
    prepMinutes: number;
    deliveryMinutes: number | null;
    tier: string | null;
    tierLabel: string | null;
    quartierLivraison: string | null;
    totalMinutes: number | null;
    arriveeEstimeeAt: string | null;
  };
  /**
   * Nouveau parcours « paiement après acceptation » : statut du paiement,
   * délai de paiement (5 min), montant réellement dû (segments acceptés),
   * délai d'acceptation et motif d'annulation éventuel.
   */
  paiement_statut?: string | null;
  paiement_limite_at?: string | null;
  acceptation_limite_at?: string | null;
  annulation_motif?: string | null;
  total_a_payer?: number;
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

function formatHeure(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `vers ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return null;
  }
}

/** Minutes restantes avant une échéance (borné ≥ 0), ou null si indéterminée. */
function remainingUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 60_000));
}

/** « ~3 min » / « moins d'une minute » / « expiré » depuis une échéance. */
function countdownLabel(iso: string | null | undefined): string | null {
  const mins = remainingUntil(iso);
  if (mins == null) return null;
  if (mins <= 0) return 'expiré';
  if (mins === 1) return '~1 min restante';
  return `~${mins} min restantes`;
}

const SC_STATUS_LABEL: Record<string, string> = {
  en_attente: '⏳ En attente',
  acceptee: '✅ Acceptée',
  en_preparation: '👨‍🍳 En préparation',
  prete: '📦 Prête',
  collectee: '🛵 Récupérée',
  livree: '✅ Livrée',
  refusee: '❌ Refusée',
  remboursee: '⏱️ Expirée',
  annulee: '❌ Annulée',
};

function scStatusLabel(statut: string): string {
  return SC_STATUS_LABEL[statut] ?? statut;
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'airtel' | 'mtn'>('airtel');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
        if (timer) clearTimeout(timer);
        // Polling rapide (5 s) tant qu'une échéance est active (attente de
        // confirmation ou délai de paiement), puis suivi temps réel standard.
        const waitingResponse =
          res.paiement_statut !== 'valide' &&
          (res.statut === 'en_attente' || res.statut === 'acceptee' || res.statut === 'partiellement_acceptee');
        const interval = waitingResponse ? 5_000 : orderPollingIntervalMs(res.statut);
        if (interval !== false) {
          timer = setTimeout(() => void fetchOrder(), interval);
        }
      } catch {
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

  const payNow = async () => {
    if (paying || !id) return;
    setPaying(true);
    setPayError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée');
      await apiFetch(`/api/orders/${id}/pay`, {
        method: 'POST',
        token,
        jsonBody: { provider: payMethod },
      });
      // Le webhook (ou le mode test) met à jour le paiement : le polling
      // ci-dessus basculera l'écran en « confirmation » automatiquement.
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Paiement impossible, réessayez.');
    } finally {
      setPaying(false);
    }
  };

  const cancelAll = () => {
    Alert.alert(
      'Annuler toute la commande',
      'Les commerces qui ont accepté seront informés. Cette action est définitive.',
      [
        { text: 'Garder ma commande', style: 'cancel' },
        {
          text: 'Annuler la commande',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const token = await getSessionToken();
                if (!token) return;
                await apiFetch(`/api/orders/${id}/cancel`, { method: 'POST', token });
              } catch {
                /* le polling resynchronisera l'état */
              }
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.center} lightColor={colors.background} darkColor={colors.background}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

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

  // ── Nouveau parcours : attente de confirmation → paiement après acceptation ──
  const paid = order?.paiement_statut === 'valide';
  const waitingConfirmation = !paid && order?.statut === 'en_attente';
  const readyToPay =
    !paid &&
    (order?.statut === 'acceptee' || order?.statut === 'partiellement_acceptee');
  const scs = order?.sousCommandes || [];
  const refusedScs = scs.filter((s) => s.statut === 'refusee' || s.statut === 'remboursee');
  const confirmationCountdown = countdownLabel(order?.acceptation_limite_at);
  const paymentCountdown = countdownLabel(order?.paiement_limite_at);
  const paymentDeadlineExpired =
    order?.paiement_limite_at != null && remainingUntil(order.paiement_limite_at) === 0;
  const totalAPayer = order?.total_a_payer ?? 0;

  // ETA réelle calculée par l'API : préparation (commerce) + livraison (zone GoLivra).
  const eta = order?.eta;
  const arriveeLabel = formatHeure(eta?.arriveeEstimeeAt);
  const restantMin = remainingUntil(eta?.arriveeEstimeeAt);
  const zoneTierLabel = eta?.tierLabel || null;
  const quartierLivraison = eta?.quartierLivraison || null;
  const zoneLabel = zoneTierLabel || quartierLivraison || null;

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
                  {order?.annulation_motif ? 'Commande annulée' : orderStatusLabel(order?.statut)}
                </ThemedText>
                <ThemedText style={[styles.etaLabel, { color: colors.textMuted, textAlign: 'center', lineHeight: 20 }]}>
                  {order?.annulation_motif || refundMessage}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* CARTE STATUT / PREVIEW - Uniquement si non livrée et non remboursée */}
        {!isDelivered && !isRefunded && (
          <View style={[styles.mapPreviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.staticMapContainer, { backgroundColor: colors.primarySoft }]}>
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

              {/* Overlay état : attente de confirmation / paiement / préparation / en livraison */}
              <View style={[styles.mapOverlay, { backgroundColor: colors.surface }]}>
                {order?.statut === 'en_livraison' ? (
                  <>
                    <View style={styles.etaRow}>
                      <View style={[styles.etaIconBox, { backgroundColor: colors.primarySoft }]}>
                        <Bike size={24} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.etaLabel, { color: colors.textMuted }]}>Arrivée estimée</ThemedText>
                        <ThemedText style={[styles.etaTime, { color: colors.text }]}>
                          {restantMin != null && restantMin > 0
                            ? `~${restantMin} min`
                            : arriveeLabel || 'Arrivée en cours'}
                        </ThemedText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <ThemedText style={[styles.distanceLabel, { color: colors.textMuted }]}>
                          {zoneTierLabel ? 'Zone' : quartierLivraison ? 'Quartier' : 'Arrivée'}
                        </ThemedText>
                        <ThemedText style={[styles.distanceValue, { color: colors.primaryDeep }]} numberOfLines={1}>
                          {zoneTierLabel || quartierLivraison || arriveeLabel || '—'}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <ThemedText style={[styles.statusHighlight, { color: colors.primary }]}>En route vers vous</ThemedText>
                  </>
                ) : waitingConfirmation ? (
                  <View style={styles.statusRow}>
                    <View style={[styles.etaIconBox, { backgroundColor: colors.warningSoft }]}>
                      <Clock size={24} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.etaTime, { color: colors.text }]}>En attente de confirmation</ThemedText>
                      <ThemedText style={[styles.etaLabel, { color: colors.textMuted, marginTop: 2, lineHeight: 18 }]}>
                        {scs.length > 1
                          ? `Les ${scs.length} commerces ont 5 minutes pour confirmer votre commande.`
                          : 'Le commerce a 5 minutes pour confirmer votre commande.'}
                      </ThemedText>
                      {confirmationCountdown ? (
                        <ThemedText style={[styles.deadlineText, { color: colors.warning }]}>
                          ⏱️ {confirmationCountdown} · réponse avant {formatHeure(order?.acceptation_limite_at)}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                ) : readyToPay ? (
                  <View style={{ gap: 10 }}>
                    <View style={styles.statusRow}>
                      <View style={[styles.etaIconBox, { backgroundColor: colors.successSoft }]}>
                        <CheckCircle2 size={24} color={colors.success} strokeWidth={LUCIDE_STROKE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.etaTime, { color: colors.text }]}>
                          Commande {scs.length > 1 && refusedScs.length > 0 ? 'partiellement ' : ''}acceptée
                        </ThemedText>
                        <ThemedText style={[styles.etaLabel, { color: colors.textMuted, marginTop: 2, lineHeight: 18 }]}>
                          💳 Paiement requis — vous avez 5 min pour confirmer.
                        </ThemedText>
                        {paymentCountdown ? (
                          <ThemedText style={[styles.deadlineText, { color: paymentDeadlineExpired ? colors.error : colors.warning }]}>
                            ⏱️ {paymentCountdown}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>

                    {/* Répartition par commerce : acceptés / refusés / expirés */}
                    {scs.length > 1 ? (
                      <View style={[styles.breakdownBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        {scs.map((sc) => (
                          <View key={sc.id} style={styles.scRow}>
                            <ThemedText style={[styles.scName, { color: colors.text }]} numberOfLines={1}>
                              {sc.commerce_nom || 'Commerce'}
                            </ThemedText>
                            <ThemedText
                              style={[
                                styles.scStatut,
                                {
                                  color: ['refusee', 'remboursee', 'annulee'].includes(sc.statut) ? colors.error : colors.primaryDeep,
                                },
                              ]}>
                              {scStatusLabel(sc.statut)}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {refusedScs.length > 0 ? (
                      <ThemedText style={[styles.refusedHint, { color: colors.textMuted, lineHeight: 18 }]}>
                        {refusedScs.length > 1
                          ? `${refusedScs.length} commerces n'ont pas pu confirmer votre commande — ils ne seront pas facturés.`
                          : "Un commerce n'a pas pu confirmer votre commande — il ne sera pas facturé."}
                      </ThemedText>
                    ) : null}

                    <View style={[styles.payBox, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
                      <ThemedText style={[styles.payTotal, { color: colors.primaryDeep }]}>
                        Total à payer : {formatFcfa(totalAPayer)}
                      </ThemedText>
                      <View style={styles.payMethodRow}>
                        {(
                          [
                            { id: 'airtel' as const, label: 'Airtel Money' },
                            { id: 'mtn' as const, label: 'MTN MoMo' },
                          ]
                        ).map((m) => {
                          const on = payMethod === m.id;
                          return (
                            <Pressable
                              key={m.id}
                              style={[
                                styles.payMethodBtn,
                                {
                                  backgroundColor: on ? colors.primary : colors.surface,
                                  borderColor: on ? colors.primary : colors.border,
                                },
                              ]}
                              onPress={() => setPayMethod(m.id)}
                              disabled={paying}>
                              <Smartphone size={16} color={on ? colors.onPrimary : colors.primary} strokeWidth={LUCIDE_STROKE} />
                              <ThemedText style={[styles.payMethodLabel, { color: on ? colors.onPrimary : colors.text }]}>
                                {m.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Pressable
                        style={[styles.payCta, { backgroundColor: colors.primary }]}
                        onPress={() => void payNow()}
                        disabled={paying || paymentDeadlineExpired}>
                        {paying ? (
                          <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                          <ThemedText style={[styles.payCtaText, { color: colors.onPrimary }]}>
                            {paymentDeadlineExpired ? 'Délai expiré' : `Payer ${formatFcfa(totalAPayer)}`}
                          </ThemedText>
                        )}
                      </Pressable>
                      {payError ? (
                        <ThemedText style={[styles.payErr, { color: colors.error }]}>{payError}</ThemedText>
                      ) : null}
                    </View>
                    <Pressable onPress={cancelAll} hitSlop={8} style={styles.cancelLink}>
                      <ThemedText style={[styles.cancelLinkText, { color: colors.error }]}>
                        Annuler toute la commande
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    <View style={[styles.etaIconBox, { backgroundColor: colors.primarySoft }]}>
                      <Package size={24} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.etaTime, { color: colors.text }]}>
                        {paid ? 'Commande confirmée' : 'Préparation en cours'}
                      </ThemedText>
                      <ThemedText style={[styles.etaLabel, { color: colors.textMuted, marginTop: 2 }]}>
                        {eta?.totalMinutes != null
                          ? `Arrivée estimée ${arriveeLabel || `dans ~${eta.totalMinutes} min`} · ${zoneLabel || 'livraison GoLivra'}`
                          : 'Votre livreur sera assigné prochainement.'}
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
              <ThemedText style={[styles.orderValue, { color: colors.primaryDeep, fontWeight: '700' }]}>{formatFcfa(order?.total ?? 0)}</ThemedText>
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
  staticMapContainer: {
    height: 270,
    width: '100%',
    justifyContent: 'flex-end',
    padding: 12,
  },
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
  deadlineText: { fontSize: 13, fontWeight: '800', marginTop: 4 },

  breakdownBox: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, gap: 2 },
  scRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  scName: { flex: 1, fontSize: 14, fontWeight: '700', paddingRight: 10 },
  scStatut: { fontSize: 13, fontWeight: '800' },
  refusedHint: { fontSize: 12, fontWeight: '600' },

  payBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  payTotal: { fontSize: 16, fontWeight: '900' },
  payMethodRow: { flexDirection: 'row', gap: 8 },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  payMethodLabel: { fontSize: 13, fontWeight: '800' },
  payCta: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  payCtaText: { fontWeight: '800', fontSize: 15 },
  payErr: { fontSize: 12, fontWeight: '700' },
  cancelLink: { alignSelf: 'center', paddingVertical: 4 },
  cancelLinkText: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },

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
