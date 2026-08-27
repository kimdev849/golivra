import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  PhoneCall,
  ShoppingBag,
  Smartphone,
  Star,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EventTimeline } from '@/components/event-timeline';
import { LivePulseDot } from '@/components/live-pulse-dot';
import { OrderProgressStepper, type OrderStep } from '@/components/order-progress-stepper';
import { GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useFeatureEnabled } from '@/hooks/use-feature-enabled';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import type { TimelineStep as _TimelineStep } from '@/lib/datetime';
import { orderPollingIntervalMs } from '@/lib/order-status';
import { orderCancelledInfo, commerceKindWords, type CommerceKind } from '@/lib/ux-copy';
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
  raison_refus?: string | null;
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
  eta?: {
    prepMinutes: number;
    deliveryMinutes: number | null;
    tier: string | null;
    tierLabel: string | null;
    quartierLivraison: string | null;
    totalMinutes: number | null;
    arriveeEstimeeAt: string | null;
  };
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
    position_actuelle?: { latitude: number; longitude: number; at: string | null } | null;
  };
  /** Distance du livreur jusqu'à l'adresse (calculée côté API, si coordonnées connues). */
  distance_km?: number | null;
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
    return `${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return null;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Secondes restantes avant une échéance (borné ≥ 0), ou null si indéterminée. */
function remainingSeconds(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.ceil((at - nowMs) / 1000));
}

/** Minutes entières restantes avant une échéance (borné ≥ 0), ou null. */
function remainingUntil(iso: string | null | undefined, nowMs: number): number | null {
  const s = remainingSeconds(iso, nowMs);
  return s == null ? null : Math.ceil(s / 60);
}

/** « 04:32 » depuis un nombre de secondes (compte à rebours vivant). */
function mmss(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Ton visuel d'un statut de sous-commande (pastille colorée, sans émoji). */
const SC_STATUS_TONE: Record<string, 'success' | 'progress' | 'warn' | 'danger' | 'neutral'> = {
  en_attente: 'warn',
  acceptee: 'success',
  en_preparation: 'progress',
  prete: 'progress',
  collectee: 'progress',
  livree: 'success',
  refusee: 'danger',
  remboursee: 'danger',
  annulee: 'neutral',
};

const SC_STATUS_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  acceptee: 'Acceptée',
  en_preparation: 'En préparation',
  prete: 'Prête',
  collectee: 'Récupérée',
  livree: 'Livrée',
  refusee: 'Refusée',
  remboursee: 'Expirée',
  annulee: 'Annulée',
};

function scStatusLabel(statut: string): string {
  return SC_STATUS_LABEL[statut] ?? statut;
}

/** Étapes du suivi (style Glovo/Uber) : position courante. */
function stepperPosition(statut: string): { done: number; active: number } {
  switch (statut) {
    case 'livree':
      return { done: 4, active: -1 };
    case 'en_livraison':
      return { done: 2, active: 2 };
    case 'prete':
    case 'collectee':
      return { done: 2, active: 2 };
    case 'en_preparation':
    case 'a_preparer':
      return { done: 1, active: 1 };
    case 'acceptee':
    case 'partiellement_acceptee':
      return { done: 1, active: 1 };
    case 'en_attente':
      return { done: 0, active: 0 };
    default:
      return { done: 0, active: 0 };
  }
}

/** Carte avec animation d'entrée en cascade. */
function FadeCard({
  children,
  index,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: object;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(320)}
      style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const paymentsEnabled = useFeatureEnabled('payments');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'airtel' | 'mtn'>('airtel');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Horloge locale : fait tourner les comptes à rebours (MM:SS) chaque seconde,
  // uniquement tant qu'une échéance est active (attente de confirmation ou
  // délai de paiement) — pas de re-render inutile sur les commandes terminées.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const active =
      order?.statut === 'en_attente' ||
      order?.statut === 'acceptee' ||
      order?.statut === 'partiellement_acceptee';
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order?.statut]);

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

  const goHome = () => {
    router.replace('/(tabs)/explore');
  };

  const callCourier = () => {
    const raw = order?.livreur?.telephone;
    if (!raw) return;
    const digits = String(raw).replace(/[^\d+]/g, '');
    if (digits) void Linking.openURL(`tel:${digits}`);
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

  const scs = order?.sousCommandes || [];
  const refusedScs = scs.filter((s) => s.statut === 'refusee' || s.statut === 'remboursee');
  const acceptedScs = scs.filter((s) => !['refusee', 'remboursee', 'annulee'].includes(s.statut));
  const acceptedNames = acceptedScs.map((s) => s.commerce_nom).filter((n): n is string => !!n);
  const allCommerceNames = scs.map((s) => s.commerce_nom).filter((n): n is string => !!n);
  // Type de commerce : on parle de « la boutique » ou « le restaurant ».
  const commerceKind: CommerceKind = (() => {
    const hasResto = scs.some((s) => !!s.restaurant_id);
    const hasBoutique = scs.some((s) => !!s.boutique_id);
    if (hasResto && !hasBoutique) return 'restaurant';
    if (hasBoutique && !hasResto) return 'boutique';
    return 'commerce';
  })();
  const { Who: commerceWho, de: commerceDe, word: commerceWord } = commerceKindWords(commerceKind);
  const commerceLabel = allCommerceNames.length > 0 ? allCommerceNames.join(', ') : commerceWord;
  const acceptedLabel =
    acceptedNames.length > 1
      ? `${acceptedNames.slice(0, -1).join(', ')} et ${acceptedNames[acceptedNames.length - 1]} ont accepté votre commande.`
      : `${acceptedNames[0] || 'La boutique'} a accepté votre commande.`;

  // Histoire de la commande annulée, racontée en mots simples.
  const annulationMotif = order?.annulation_motif ? String(order.annulation_motif) : null;
  const refusedSc = scs.find((s) => s.statut === 'refusee');
  const cancelInfo = orderCancelledInfo({
    statut: order?.statut,
    annulationMotif,
    kind: commerceKind,
    sousStatuts: scs.map((s) => s.statut),
    refusalReason: refusedSc?.raison_refus ?? null,
  });
  const isRefunded = cancelInfo !== null;

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

  // Comptes à rebours vivants (MM:SS) + messages évolutifs pendant l'attente.
  const acceptRemaining = remainingSeconds(order?.acceptation_limite_at, now);
  const payRemaining = remainingSeconds(order?.paiement_limite_at, now);
  const acceptCountdown = acceptRemaining == null ? null : mmss(acceptRemaining);
  const payCountdown = payRemaining == null ? null : mmss(payRemaining);
  const paymentDeadlineExpired = payRemaining === 0;
  const acceptanceMsg =
    acceptRemaining == null
      ? null
      : acceptRemaining > 180
        ? `Nous attendons la confirmation ${commerceDe}.`
        : acceptRemaining > 60
          ? `${commerceWho} vérifie encore votre commande. Merci de patienter`
          : acceptRemaining > 0
            ? `Plus qu'une minute ! Nous attendons encore la réponse ${commerceDe}.`
            : null;
  const totalAPayer = order?.total_a_payer ?? 0;

  // ETA réelle calculée par l'API : préparation (commerce) + livraison (zone GoLivra).
  const eta = order?.eta;
  const arriveeLabel = formatHeure(eta?.arriveeEstimeeAt);
  const restantMin = remainingUntil(eta?.arriveeEstimeeAt, now);
  const zoneTierLabel = eta?.tierLabel || null;
  const quartierLivraison = eta?.quartierLivraison || null;
  const zoneLabel = zoneTierLabel || quartierLivraison || null;

  // Position du stepper (Commande → Préparation → En route → Livrée).
  const { done: doneSteps, active: activeStep } = stepperPosition(order?.statut ?? '');

  // Pastille de statut dans le header.
  const headerPill = (() => {
    if (waitingConfirmation) return { label: 'En attente', bg: colors.warningSoft, txt: colors.warning };
    if (readyToPay) return { label: 'À payer', bg: colors.successSoft, txt: colors.success };
    if (order?.statut === 'en_livraison') return { label: 'En route', bg: colors.primarySoft, txt: colors.primary };
    if (order?.statut === 'prete') return { label: 'Prête', bg: colors.primarySoft, txt: colors.primary };
    if (isDelivered) return { label: 'Livrée', bg: colors.successSoft, txt: colors.success };
    return { label: 'En cours', bg: colors.surfaceMuted, txt: colors.textSecondary };
  })();

  // Suivi en direct : distance du livreur jusqu'à l'adresse (pendant la livraison).
  const courierDistanceKm = order?.distance_km ?? null;
  const courierProche =
    order?.statut === 'en_livraison' && courierDistanceKm != null && courierDistanceKm > 0 && courierDistanceKm < 0.5;
  const courierDistanceLabel =
    courierDistanceKm == null
      ? null
      : courierDistanceKm < 1
        ? `${Math.round(courierDistanceKm * 1000)} m`
        : `${Number(courierDistanceKm).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

  // Titre + sous-titre du hero selon l'état.
  const heroTitle = (() => {
    if (order?.statut === 'en_livraison') return courierProche ? 'Votre livreur est proche' : 'En route vers vous';
    if (waitingConfirmation) return 'Commande envoyée';
    if (readyToPay) return 'Commande confirmée';
    if (order?.statut === 'a_preparer' || order?.statut === 'en_preparation') return 'En préparation';
    if (order?.statut === 'prete') return 'Prête pour la livraison';
    return 'Commande confirmée';
  })();

  const heroSub = (() => {
    if (order?.statut === 'en_livraison') {
      return zoneLabel ? `Livraison · ${zoneLabel}` : 'Votre livreur est en chemin';
    }
    if (waitingConfirmation) return `Envoyée à ${commerceLabel}`;
    if (readyToPay) return acceptedLabel;
    if (order?.statut === 'a_preparer' || order?.statut === 'en_preparation') {
      if (eta?.totalMinutes != null) return `Arrivée estimée ${arriveeLabel ? `vers ${arriveeLabel}` : `dans ~${eta.totalMinutes} min`}`;
      return 'Le commerce prépare votre commande…';
    }
    if (order?.statut === 'prete' || order?.statut === 'collectee') {
      return 'Recherche d’un livreur pour votre commande…';
    }
    if (eta?.totalMinutes != null) return `Arrivée estimée ${arriveeLabel ? `vers ${arriveeLabel}` : `dans ~${eta.totalMinutes} min`}`;
    return 'Commande confirmée';
  })();

  const isLive = !isDelivered && !isRefunded && order?.statut !== 'annulee';

  const stepperSteps: OrderStep[] = [
    { key: 'commande', label: 'Commande', icon: ShoppingBag },
    { key: 'preparation', label: 'Préparation', icon: ChefHat },
    { key: 'route', label: 'En route', icon: Bike },
    { key: 'livree', label: 'Livrée', icon: CheckCircle2 },
  ];

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceMuted }]} hitSlop={12}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            {isDelivered ? 'Détails' : 'Suivi'}
          </ThemedText>
          <ThemedText style={[styles.headerRef, { color: colors.textMuted }]}>
            #{order?.numero || id?.slice(0, 8).toUpperCase()}
          </ThemedText>
        </View>
        <View style={[styles.headerPill, { backgroundColor: headerPill.bg }]}>
          <View style={[styles.headerPillDot, { backgroundColor: headerPill.txt }]} />
          <ThemedText style={[styles.headerPillText, { color: headerPill.txt }]}>{headerPill.label}</ThemedText>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>

        {/* ── HERO STATUT + STEPPER (non livrée, non remboursée) ── */}
        {!isDelivered && !isRefunded ? (
          <Animated.View entering={FadeInDown.duration(350)}>
            <LinearGradient
              colors={[colors.primaryDeep, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}>
              {/* Badge live + ETA */}
              <View style={styles.heroTopRow}>
                <View style={styles.liveBadge}>
                  <LivePulseDot color="#FFFFFF" size={8} active={isLive} />
                  <ThemedText style={styles.liveBadgeText}>
                    {order?.statut === 'en_livraison' ? 'En direct' : 'Suivi en direct'}
                  </ThemedText>
                </View>
                {order?.statut === 'en_livraison' ? (
                  <View style={styles.heroEtaBlock}>
                    <ThemedText style={styles.heroEta}>
                      {restantMin != null && restantMin > 0 ? `~${restantMin}` : '—'}
                    </ThemedText>
                    <ThemedText style={styles.heroEtaUnit}>min</ThemedText>
                    <ThemedText style={styles.heroEtaLabel}>Arrivée estimée</ThemedText>
                    {courierDistanceLabel ? (
                      <View style={styles.heroDistancePill}>
                        <ThemedText style={styles.heroDistancePillText}>
                          {courierProche ? 'Proche' : `à ~${courierDistanceLabel}`}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Titre / sous-titre */}
              <View style={styles.heroBody}>
                <ThemedText style={styles.heroTitle}>{heroTitle}</ThemedText>
                <ThemedText style={styles.heroSub}>{heroSub}</ThemedText>
              </View>

              {/* Compte à rebours confirmation */}
              {waitingConfirmation ? (
                <View style={styles.heroCountdown}>
                  <View style={styles.heroCountdownRow}>
                    <Clock size={16} color="#FFE9B8" strokeWidth={2.4} />
                    <ThemedText style={styles.heroCountdownLabel}>
                      En attente de confirmation {commerceDe}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.heroCountdownTime}>
                    {acceptCountdown ?? '05:00'}
                  </ThemedText>
                  {acceptanceMsg ? (
                    <ThemedText style={styles.heroCountdownMsg}>{acceptanceMsg}</ThemedText>
                  ) : null}
                  <ThemedText style={styles.heroCountdownReassure}>
                    Pas d’inquiétude, vous ne serez débité qu’après l’acceptation de votre commande.
                  </ThemedText>
                </View>
              ) : null}
            </LinearGradient>

            {/* Stepper de progression */}
            <View style={[styles.stepperCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: GOLIVRA_BRAND_SHADOW }]}>
              <OrderProgressStepper
                steps={stepperSteps}
                done={doneSteps}
                active={activeStep}
                colors={{
                  primary: colors.primary,
                  primarySoft: colors.primarySoft,
                  success: colors.success,
                  surfaceMuted: colors.surfaceMuted,
                  border: colors.border,
                  text: colors.text,
                  textMuted: colors.textMuted,
                }}
              />
            </View>
          </Animated.View>
        ) : null}

        {/* ── CARTE REMBOURSEMENT / ANNULATION ── */}
        {isRefunded && cancelInfo ? (
          <Animated.View entering={FadeInDown.duration(350)} style={[styles.card, styles.refundCard, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
            <View style={styles.refundBody}>
              <View style={[styles.refundIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Clock size={26} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.refundTitle, { color: colors.text }]}>
                {cancelInfo.title}
              </ThemedText>
              {cancelInfo.intro ? (
                <ThemedText style={[styles.refundText, { color: colors.text }]}>
                  {cancelInfo.intro}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.refundText, { color: colors.textMuted }]}>
                {cancelInfo.body}
              </ThemedText>

              {/* Toute l'histoire, dans l'ordre */}
              <View style={[styles.storyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                {cancelInfo.steps.map((s, i) => (
                  <View key={i} style={styles.storyRow}>
                    <View style={styles.storyRail}>
                      <View style={[styles.storyDot, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
                        <ThemedText style={styles.storyEmoji}>{s.emoji}</ThemedText>
                      </View>
                      {i < cancelInfo.steps.length - 1 ? (
                        <View style={[styles.storyLine, { backgroundColor: colors.border }]} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: i < cancelInfo.steps.length - 1 ? 14 : 0 }}>
                      <ThemedText style={[styles.storyTitle, { color: colors.text }]}>{s.title}</ThemedText>
                      <ThemedText style={[styles.storyDetail, { color: colors.textMuted }]}>{s.detail}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>

              {cancelInfo.note ? (
                <ThemedText style={[styles.refundHint, { color: colors.textMuted }]}>
                  {cancelInfo.note}
                </ThemedText>
              ) : null}

              <Pressable
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={goHome}
                android_ripple={{ color: colors.primaryMuted }}>
                <ThemedText style={[styles.primaryCtaText, { color: colors.onPrimary }]}>
                  Retourner à l’accueil
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* ── CARTE PAIEMENT ── */}
        {readyToPay ? (
          <FadeCard index={1} style={{ backgroundColor: colors.surface, borderColor: colors.success }}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.successSoft }]}>
                <Smartphone size={22} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Confirmer le paiement</ThemedText>
                <ThemedText style={[styles.cardSub, { color: colors.textMuted }]}>
                  {formatFcfa(totalAPayer)} — demande envoyée sur votre téléphone
                </ThemedText>
              </View>
            </View>

            <View style={[styles.payDeadlineBanner, { backgroundColor: colors.warningSoft }]}>
              <Clock size={16} color={colors.warning} strokeWidth={2.4} />
              <ThemedText
                style={[
                  styles.payDeadlineText,
                  { color: paymentDeadlineExpired ? colors.error : colors.warning },
                ]}>
                {paymentDeadlineExpired
                  ? 'Délai expiré — la commande va être annulée.'
                  : payCountdown != null
                    ? `Il vous reste ${payCountdown} pour valider la transaction`
                    : 'Il vous reste 5 minutes pour valider la transaction'}
              </ThemedText>
            </View>

            <ThemedText style={[styles.cardSub, { color: colors.textMuted, lineHeight: 19 }]}>
              Ouvrez votre compte Mobile Money et validez la demande{' '}
              {payMethod === 'airtel' ? 'Airtel Money' : 'MTN MoMo'} avec votre code PIN. L’argent
              partira automatiquement.
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
                    disabled={paying || !paymentsEnabled}>
                    <Smartphone size={16} color={on ? colors.onPrimary : colors.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.payMethodLabel, { color: on ? colors.onPrimary : colors.text }]}>
                      {m.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {!paymentsEnabled ? (
              <View style={[styles.payBlocked, { backgroundColor: colors.error + '18', borderColor: colors.error }]}>
                <ThemedText style={[styles.payBlockedText, { color: colors.error }]}>
                  Les paiements en ligne sont temporairement désactivés par l&apos;administrateur. Votre
                  commande reste en attente — elle sera annulée si le délai de paiement expire.
                </ThemedText>
              </View>
            ) : (
              <Pressable
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={() => void payNow()}
                disabled={paying || paymentDeadlineExpired}
                android_ripple={{ color: colors.primaryMuted }}>
                {paying ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <ThemedText style={[styles.primaryCtaText, { color: colors.onPrimary }]}>
                    {paymentDeadlineExpired ? 'Délai expiré' : 'Payer ma commande'}
                  </ThemedText>
                )}
              </Pressable>
            )}
            {payError ? (
              <ThemedText style={[styles.payErr, { color: colors.error }]}>{payError}</ThemedText>
            ) : null}
            <Pressable onPress={cancelAll} hitSlop={8} style={styles.cancelLink}>
              <ThemedText style={[styles.cancelLinkText, { color: colors.error }]}>
                Annuler toute la commande
              </ThemedText>
            </Pressable>
          </FadeCard>
        ) : null}

        {/* ── LIVREUR ── */}
        {order?.livreur ? (
          <FadeCard index={2} style={{ backgroundColor: colors.surface, borderColor: colors.border, shadowColor: GOLIVRA_BRAND_SHADOW }}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
                <Bike size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Votre livreur</ThemedText>
              {order.statut === 'en_livraison' ? (
                <View style={styles.liveInline}>
                  <LivePulseDot color={colors.success} size={7} />
                  <ThemedText style={[styles.liveInlineText, { color: colors.success }]}>En route</ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.courierRow}>
              <View style={[styles.courierAvatar, { backgroundColor: colors.primarySoft }]}>
                {order.livreur.image_url ? (
                  <Image source={{ uri: order.livreur.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <ThemedText style={{ color: colors.primary, fontSize: 22, fontWeight: '900' }}>
                    {order.livreur.nom.charAt(0).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.courierName, { color: colors.text }]}>{order.livreur.nom}</ThemedText>
                <View style={styles.courierRatingRow}>
                  <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.courierRating, { color: colors.textMuted }]}>{order.livreur.note_moyenne || 'Nouveau'}</ThemedText>
                </View>
              </View>
              {order.livreur.telephone ? (
                <Pressable
                  style={[styles.callBtn, { backgroundColor: colors.successSoft }]}
                  onPress={callCourier}
                  android_ripple={{ color: colors.primaryMuted }}>
                  <PhoneCall size={20} color={colors.success} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              ) : null}
            </View>
          </FadeCard>
        ) : null}

        {/* ── ARTICLES ── */}
        {allArticles.length > 0 ? (
          <FadeCard index={3} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
                <Package size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Articles</ThemedText>
            </View>
            {allArticles.map((a, idx) => (
              <View key={`${a.id}-${idx}`} style={styles.articleRow}>
                <View style={[styles.articleQtyBadge, { backgroundColor: colors.primarySoft }]}>
                  <ThemedText style={[styles.articleQty, { color: colors.primaryDeep }]}>{a.quantite}×</ThemedText>
                </View>
                <ThemedText style={[styles.articleName, { color: colors.text }]} numberOfLines={2}>{a.nom}</ThemedText>
                <ThemedText style={[styles.articlePrice, { color: colors.textMuted }]}>{formatFcfa(a.prix_unitaire * a.quantite)}</ThemedText>
              </View>
            ))}
          </FadeCard>
        ) : null}

        {/* ── INFO COMMANDE (n°, date, total, adresse) ── */}
        <FadeCard index={4} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
              <CheckCircle2 size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Commande</ThemedText>
            {isDelivered ? (
              <View style={[styles.deliveredPill, { backgroundColor: colors.successSoft }]}>
                <ThemedText style={[styles.deliveredPillText, { color: colors.success }]}>Livrée</ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <ThemedText style={[styles.infoLabel, { color: colors.textMuted }]}>Commande n°</ThemedText>
              <ThemedText style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                {order?.numero || order?.id.slice(0, 8).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.infoCol}>
              <ThemedText style={[styles.infoLabel, { color: colors.textMuted }]}>Date</ThemedText>
              <ThemedText style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                {formatDate(order?.cree_le)}
              </ThemedText>
            </View>
            <View style={[styles.infoCol, { alignItems: 'flex-end' }]}>
              <ThemedText style={[styles.infoLabel, { color: colors.textMuted }]}>Total</ThemedText>
              <ThemedText style={[styles.infoValue, { color: colors.primaryDeep, fontWeight: '800' }]}>
                {formatFcfa(order?.total ?? 0)}
              </ThemedText>
            </View>
          </View>
          {order?.adresse_livraison ? (
            <View style={[styles.addrRow, { borderTopColor: colors.border }]}>
              <View style={[styles.addrIcon, { backgroundColor: colors.primarySoft }]}>
                <MapPin size={14} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.addrText, { color: colors.text }]} numberOfLines={2}>
                {order.adresse_livraison}
              </ThemedText>
            </View>
          ) : null}
          {/* ── Ventilation du total (C1) ── */}
          {(() => {
            const articlesSubtotal = (order?.sousCommandes ?? []).reduce(
              (sum, sc) => sum + (sc.articles ?? []).reduce(
                (a, art) => a + (art.prix_unitaire ?? 0) * (art.quantite ?? 0), 0),
              0,
            );
            const orderTotal = order?.total ?? 0;
            const deliveryFee = Math.max(0, orderTotal - articlesSubtotal);
            if (articlesSubtotal <= 0) return null;
            return (
              <View style={[styles.breakdown, { borderTopColor: colors.border }]}>
                <View style={styles.breakdownRow}>
                  <ThemedText style={{ fontSize: 13, color: colors.textMuted }}>Articles</ThemedText>
                  <ThemedText style={{ fontSize: 13, color: colors.text }}>{formatFcfa(articlesSubtotal)}</ThemedText>
                </View>
                <View style={styles.breakdownRow}>
                  <ThemedText style={{ fontSize: 13, color: colors.textMuted }}>Livraison</ThemedText>
                  <ThemedText style={{ fontSize: 13, color: colors.text }}>{formatFcfa(deliveryFee)}</ThemedText>
                </View>
                <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 4 }]}>
                  <ThemedText style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>Total</ThemedText>
                  <ThemedText style={{ fontSize: 14, fontWeight: '800', color: colors.primaryDeep }}>{formatFcfa(orderTotal)}</ThemedText>
                </View>
              </View>
            );
          })()}
          {isDelivered ? (
            <View style={[styles.deliveredBanner, { backgroundColor: colors.successSoft }]}>
              <CheckCircle2 size={16} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.deliveredBannerText, { color: colors.success }]}>
                Cette commande a été livrée avec succès.
              </ThemedText>
            </View>
          ) : null}
        </FadeCard>

        {/* ── RÉPARTITION PAR COMMERCE (multi-commandes) ── */}
        {scs.length > 1 ? (
          <FadeCard index={5} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
                <Package size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Vos commerces</ThemedText>
            </View>
            {scs.map((sc) => {
              const tone = SC_STATUS_TONE[sc.statut] ?? 'neutral';
              const toneColor =
                tone === 'success'
                  ? colors.success
                  : tone === 'danger'
                    ? colors.error
                    : tone === 'warn'
                      ? colors.warning
                      : tone === 'progress'
                        ? colors.primaryDeep
                        : colors.textMuted;
              const toneBg =
                tone === 'success'
                  ? colors.successSoft
                  : tone === 'danger'
                    ? colors.errorSoft
                    : tone === 'warn'
                      ? colors.warningSoft
                      : tone === 'progress'
                        ? colors.primarySoft
                        : colors.surfaceMuted;
              return (
                <View key={sc.id} style={styles.scRow}>
                  <ThemedText style={[styles.scName, { color: colors.text }]} numberOfLines={1}>
                    {sc.commerce_nom || 'Commerce'}
                  </ThemedText>
                  <View style={[styles.scPill, { backgroundColor: toneBg }]}>
                    <View style={[styles.scDot, { backgroundColor: toneColor }]} />
                    <ThemedText style={[styles.scStatut, { color: toneColor }]}>
                      {scStatusLabel(sc.statut)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
            {refusedScs.length > 0 ? (
              <ThemedText style={[styles.refusedHint, { color: colors.textMuted, lineHeight: 18, marginTop: 8 }]}>
                {refusedScs.length > 1
                  ? `${refusedScs.length} commerces n'ont pas pu confirmer votre commande — ils ne seront pas facturés.`
                  : "Un commerce n'a pas pu confirmer votre commande — il ne sera pas facturé."}
              </ThemedText>
            ) : null}
          </FadeCard>
        ) : null}

        {/* ── TIMELINE DE LIVRAISON ── */}
        {steps.length > 0 ? (
          <FadeCard index={6} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
                <MapPin size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{"Détails de l'acheminement"}</ThemedText>
            </View>
            <EventTimeline steps={steps} title="" />
          </FadeCard>
        ) : null}

        {/* ── LIEN VERS LE DÉTAIL COMPLET DE LA LIVRAISON ── */}
        {primaryDeliveryId ? (
          <Pressable
            onPress={() => router.push(`/delivery/${primaryDeliveryId}`)}
            style={({ pressed }) => [
              styles.card,
              styles.linkCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: GOLIVRA_BRAND_SHADOW,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
              <Bike size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Détail de la livraison</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textMuted }]}>
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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerRef: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  headerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  headerPillDot: { width: 6, height: 6, borderRadius: 3 },
  headerPillText: { fontSize: 12, fontWeight: '800' },
  scroll: { padding: 16, gap: 14 },

  // ── Cartes unifiées ──
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 2, fontWeight: '500', lineHeight: 18 },

  // ── Hero statut (dégradé) ──
  heroCard: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    gap: 16,
    overflow: 'hidden',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  heroEtaBlock: { alignItems: 'flex-end' },
  heroEta: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 24 },
  heroEtaUnit: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800', marginTop: -2 },
  heroEtaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  heroDistancePill: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroDistancePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  heroBody: { gap: 4 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // ── Compte à rebours (hero) ──
  heroCountdown: {
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  heroCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCountdownLabel: { color: '#FFE9B8', fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  heroCountdownTime: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  heroCountdownMsg: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  heroCountdownReassure: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },

  // ── Stepper ──
  stepperCard: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginTop: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  // ── Remboursement ──
  refundCard: { borderWidth: 1.5 },
  refundBody: { alignItems: 'center', gap: 10 },
  refundIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  refundText: { fontSize: 14, lineHeight: 21, fontWeight: '500', textAlign: 'center' },
  refundHint: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  storyBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  storyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  storyRail: { width: 34, alignItems: 'center' },
  storyDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyEmoji: { fontSize: 15 },
  storyLine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1, minHeight: 20 },
  storyTitle: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  storyDetail: { fontSize: 13, marginTop: 1, lineHeight: 18 },

  // ── Boutons ──
  primaryCta: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  primaryCtaText: { fontWeight: '800', fontSize: 15, letterSpacing: -0.2 },

  // ── Paiement ──
  payDeadlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  payDeadlineText: { fontSize: 13, fontWeight: '800', flex: 1 },
  payMethodRow: { flexDirection: 'row', gap: 8 },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  payMethodLabel: { fontSize: 13, fontWeight: '800' },
  payErr: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  payBlocked: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  payBlockedText: { fontSize: 13, fontWeight: '600', lineHeight: 19, textAlign: 'center' },
  cancelLink: { alignSelf: 'center', paddingVertical: 4 },
  cancelLinkText: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },

  // ── Livreur ──
  liveInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  liveInlineText: { fontSize: 12, fontWeight: '800' },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  courierAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  courierName: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  courierRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  courierRating: { fontSize: 14, fontWeight: '600' },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Multi-commerces ──
  scRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  scName: { flex: 1, fontSize: 14, fontWeight: '700', paddingRight: 10 },
  scPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  scDot: { width: 7, height: 7, borderRadius: 3.5 },
  scStatut: { fontSize: 12.5, fontWeight: '800' },
  refusedHint: { fontSize: 12, fontWeight: '600' },

  // ── Info commande ──
  infoGrid: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3, fontWeight: '600' },
  infoValue: { fontSize: 15, fontWeight: '700' },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addrIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrText: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 19, paddingTop: 4 },
  breakdown: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  deliveredPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginLeft: 'auto' },
  deliveredPillText: { fontSize: 12, fontWeight: '800' },
  deliveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
  },
  deliveredBannerText: { fontSize: 13, fontWeight: '700', flex: 1 },

  // ── Articles ──
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  articleQtyBadge: {
    minWidth: 32,
    height: 28,
    borderRadius: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleQty: { fontSize: 13, fontWeight: '800' },
  articleName: { flex: 1, fontSize: 14, fontWeight: '500' },
  articlePrice: { fontSize: 14, fontWeight: '600' },

  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
