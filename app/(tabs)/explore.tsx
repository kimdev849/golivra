import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Bike, ScrollText } from 'lucide-react-native';

import { OrderRatingCard } from '@/components/order-rating-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { fetchAllEnterprises, peekAllEnterprises } from '@/lib/client-data';
import { fetchCached, invalidateCached, peekCached } from '@/lib/request-cache';
import { EventTimeline } from '@/components/event-timeline';
import { formatDateTimeFr } from '@/lib/datetime';
import { formatFcfa } from '@/lib/format';
import type { TimelineStep } from '@/lib/datetime';
import { fetchPendingReviews, type PendingReview } from '@/lib/reviews';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { orderCancelledChip, orderStatusLabel as statutLabel } from '@/lib/ux-copy';

type OrderRow = {
  id: string;
  entreprise_id: string | null;
  statut: string | null;
  annulation_motif?: string | null;
  sous_statuts?: string[] | null;
  commerce_type?: 'restaurant' | 'boutique' | null;
  prix_total?: number | string | null;
  adresse_livraison?: string | null;
  cree_le?: string | null;
  livree_le?: string | null;
  created_at_label?: string | null;
  livree_at_label?: string | null;
  livraison_livree_at_label?: string | null;
  timeline?: {
    commande?: TimelineStep[];
    livraisons?: { timeline?: TimelineStep[] }[];
  };
  peut_noter?: boolean;
  sous_commande_id?: string | null;
};

type Enterprise = {
  id: string;
  nom: string | null;
  type?: 'restaurant' | 'boutique';
};

type FilterTab = 'encours' | 'livrees' | 'annulees';

const TERMINAL_DONE = new Set(['livree']);
const TERMINAL_CANCEL = new Set(['annulee', 'remboursee']);

function normStatut(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

/** Référence type maquette #GLV-7845 */
function glvOrderRef(id: string): string {
  const clean = id.replace(/-/g, '');
  let n = 0;
  for (let i = 0; i < clean.length; i++) {
    n = (n * 31 + clean.charCodeAt(i)) % 9000;
  }
  const num = 1000 + n;
  return `GLV-${String(num).slice(-4)}`;
}

function orderBucket(statut: string | null): FilterTab {
  const k = normStatut(statut);
  if (TERMINAL_DONE.has(k)) return 'livrees';
  if (TERMINAL_CANCEL.has(k)) return 'annulees';
  return 'encours';
}

/** Nombre de pastilles « complètes » sur le stepper (1–4) pour les commandes actives hors livraison */
function stepperFilledCount(statut: string | null): number {
  const k = normStatut(statut);
  if (k === 'en_preparation' || k === 'prete') return 3;
  if (k === 'acceptee' || k === 'partiellement_acceptee') return 2;
  if (k === 'probleme') return 2;
  if (k === 'en_attente' || k === 'en_attente_vendeur') return 1;
  if (k === 'commande_creee') return 1;
  return 2;
}

function formatLivreeLe(iso: string | null | undefined): string {
  if (!iso) return '';
  return formatDateTimeFr(iso);
}

function orderCreatedLabel(o: OrderRow): string {
  return o.created_at_label || formatDateTimeFr(o.cree_le);
}

const PREVIEW_LIMIT = 4;

function StepperRow({ filled, colors }: { filled: number; colors: ReturnType<typeof useAppColors> }) {
  const total = 4;
  const safe = Math.min(Math.max(filled, 1), total);
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < safe;
        const lineGreen = i < safe - 1;
        return (
          <View key={i} style={stepStyles.stepSlot}>
            <View style={[stepStyles.dotOuter, isFilled ? { backgroundColor: colors.primaryMuted } : { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }]}>
              <View style={[stepStyles.dotInner, isFilled ? { backgroundColor: colors.primary } : { backgroundColor: 'transparent' }]} />
            </View>
            {i < total - 1 ? (
              <View style={[stepStyles.line, lineGreen ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function OrdersScreenInner({
  filter,
  ordersForTab,
  expanded,
  setExpanded,
  enterpriseById,
  router,
  onOrderRated,
  colors,
}: {
  filter: FilterTab;
  ordersForTab: OrderRow[];
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  enterpriseById: Map<string, Enterprise>;
  router: ReturnType<typeof useRouter>;
  onOrderRated: (orderId: string, sousCommandeId?: string | null) => void;
  colors: ReturnType<typeof useAppColors>;
}) {
  const visible = expanded ? ordersForTab : ordersForTab.slice(0, PREVIEW_LIMIT);
  const hasMore = ordersForTab.length > PREVIEW_LIMIT;

  const renderCard = (o: OrderRow) => {
    const ent = o.entreprise_id ? enterpriseById.get(o.entreprise_id) : undefined;
    const merchant = ent?.nom ?? 'Commerce';
    const refStr = glvOrderRef(o.id);
    const k = normStatut(o.statut);
    const prixNum =
      (o.prix_total !== undefined && o.prix_total !== null ? Number(o.prix_total) : null)
      ?? (o as any).total != null ? Number((o as any).total) : null;
    const priceOk = prixNum !== null && Number.isFinite(prixNum);

    if (filter === 'livrees') {
      const dateStr = formatLivreeLe(o.livree_le ?? o.cree_le);
      const canRate = Boolean(o.peut_noter && o.sous_commande_id);
      return (
        <View key={o.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [pressed && styles.cardPressed]}
            onPress={() => router.push(`/order-tracking/${o.id}`)}
            android_ripple={{ color: colors.primarySoft }}>
            <View style={styles.cardTop}>
              <ThemedText type="defaultSemiBold" style={[styles.orderId, { color: colors.text }]}>
                #{refStr}
              </ThemedText>
            </View>
            <ThemedText type="defaultSemiBold" style={[styles.merchantTitle, { color: colors.text }]}>
              {merchant}
            </ThemedText>
            <ThemedText style={[styles.statusDark, { color: colors.text }]}>Livrée</ThemedText>
            <View style={styles.cardFooterRow}>
              <ThemedText style={[styles.dateMuted, { color: colors.textMuted }]}>
                {dateStr ? `Livrée le ${dateStr}` : orderCreatedLabel(o) ? `Commandée le ${orderCreatedLabel(o)}` : ' '}
              </ThemedText>
              {priceOk ? (
                <ThemedText type="defaultSemiBold" style={[styles.priceStrong, { color: colors.text }]}>
                  {formatFcfa(prixNum)}
                </ThemedText>
              ) : (
                <View />
              )}
            </View>
          </Pressable>
          {canRate ? (
            <OrderRatingCard
              sousCommandeId={o.sous_commande_id!}
              merchantName={merchant}
              onRated={() => onOrderRated(o.id, o.sous_commande_id)}
            />
          ) : null}
        </View>
      );
    }

    if (filter === 'annulees') {
      // Chaque commande annulée explique SA raison, en mots simples.
      const chip = orderCancelledChip(o.statut, o.annulation_motif, o.commerce_type, o.sous_statuts);
      const chipColor =
        chip.tone === 'warn' ? colors.warning : chip.tone === 'error' ? colors.error : colors.textMuted;
      const chipBg =
        chip.tone === 'warn' ? colors.warningSoft : chip.tone === 'error' ? colors.errorSoft : colors.surfaceMuted;
      return (
        <Pressable
          key={o.id}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push(`/order-tracking/${o.id}`)}
          android_ripple={{ color: colors.primarySoft }}>
          <View style={styles.cardTop}>
            <ThemedText type="defaultSemiBold" style={[styles.orderId, { color: colors.text }]}>
              #{refStr}
            </ThemedText>
            {priceOk ? (
              <ThemedText type="defaultSemiBold" style={[styles.priceStrong, { color: colors.text }]}>
                {formatFcfa(prixNum)}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="defaultSemiBold" style={[styles.merchantTitle, { color: colors.text }]}>
            {merchant}
          </ThemedText>
          <View style={[styles.cancelChip, { backgroundColor: chipBg }]}>
            <ThemedText style={[styles.cancelChipText, { color: chipColor }]}>{chip.label}</ThemedText>
          </View>
          <ThemedText style={[styles.cancelDetail, { color: colors.textMuted }]}>{chip.detail}</ThemedText>
          {orderCreatedLabel(o) ? (
            <ThemedText style={[styles.dateMuted, { color: colors.textMuted }]}>
              Commandée le {orderCreatedLabel(o)}
            </ThemedText>
          ) : null}
        </Pressable>
      );
    }

    // En cours
    if (k === 'en livraison') {
      return (
        <Pressable
          key={o.id}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.cardPressed]}
          onPress={() => router.push(`/order-tracking/${o.id}`)}
          android_ripple={{ color: colors.primarySoft }}>
          <View style={styles.cardTop}>
            <ThemedText type="defaultSemiBold" style={[styles.orderId, { color: colors.text }]}>
              #{refStr}
            </ThemedText>
            {priceOk ? (
              <ThemedText type="defaultSemiBold" style={[styles.priceStrong, { color: colors.text }]}>
                {formatFcfa(prixNum)}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="defaultSemiBold" style={[styles.merchantTitle, { color: colors.text }]}>
            {merchant}
          </ThemedText>
          <ThemedText style={[styles.statusDark, { color: colors.text }]}>En livraison</ThemedText>
          {orderCreatedLabel(o) ? (
            <ThemedText style={[styles.dateMuted, { color: colors.textMuted }]}>
              Commandée le {orderCreatedLabel(o)}
            </ThemedText>
          ) : null}
          <View style={styles.deliveryRow}>
            <View style={[styles.deliveryIconWrap, { backgroundColor: colors.primary }]}>
              <Bike size={18} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.deliveryText, { color: colors.text }]}>Livreur en route</ThemedText>
            <View style={[styles.dottedLine, { borderColor: colors.border }]} />
          </View>
        </Pressable>
      );
    }

    const prepOrange = k === 'en preparation';
    const steps = stepperFilledCount(o.statut);

    return (
      <Pressable
        key={o.id}
        style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.cardPressed]}
        onPress={() => router.push(`/order-tracking/${o.id}`)}
        android_ripple={{ color: colors.primarySoft }}>
        <View style={styles.cardTop}>
          <ThemedText type="defaultSemiBold" style={[styles.orderId, { color: colors.text }]}>
            #{refStr}
          </ThemedText>
          {priceOk ? (
            <ThemedText type="defaultSemiBold" style={[styles.priceStrong, { color: colors.text }]}>
              {formatFcfa(prixNum)}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="defaultSemiBold" style={[styles.merchantTitle, { color: colors.text }]}>
          {merchant}
        </ThemedText>
        <ThemedText style={prepOrange ? [styles.statusOrange, { color: colors.warning }] : [styles.statusDark, { color: colors.text }]}>
          {statutLabel(o.statut)}
        </ThemedText>
        {orderCreatedLabel(o) ? (
          <ThemedText style={[styles.dateMuted, { color: colors.textMuted, marginBottom: 8 }]}>
            Commandée le {orderCreatedLabel(o)}
          </ThemedText>
        ) : null}
        <StepperRow filled={steps} colors={colors} />
        {o.timeline?.livraisons?.[0]?.timeline?.length ? (
          <View style={{ marginTop: 12 }}>
            <EventTimeline steps={o.timeline.livraisons[0].timeline!} title="Suivi livraison" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <>
      <View style={styles.listGap}>{visible.map(renderCard)}</View>
      {hasMore && !expanded ? (
        <Pressable
          style={({ pressed }) => [styles.seeAllBtn, { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed && styles.seeAllBtnPressed]}
          onPress={() => setExpanded(true)}>
          <ThemedText style={[styles.seeAllText, { color: colors.primary }]}>Voir toutes les commandes</ThemedText>
        </Pressable>
      ) : null}
    </>
  );
}

const ORDERS_CACHE_KEY = 'orders:client';

export default function OrdersScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderRow[]>(() => peekCached<OrderRow[]>(ORDERS_CACHE_KEY, Number.POSITIVE_INFINITY) ?? []);
  const [enterprises, setEnterprises] = useState<Enterprise[]>(() => peekAllEnterprises() ?? []);
  const [loading, setLoading] = useState(() => !peekCached<OrderRow[]>(ORDERS_CACHE_KEY, Number.POSITIVE_INFINITY)?.length);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('encours');
  const [expandedByTab, setExpandedByTab] = useState<Record<FilterTab, boolean>>({
    encours: false,
    livrees: false,
    annulees: false,
  });
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const isDesktop = useIsWebDesktop();

  const bottomPad = isDesktop ? 24 : Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  const load = useCallback(async (force = false) => {
    setError(null);
    const cachedEnt = peekAllEnterprises();
    const hasCachedOrders = Boolean(
      peekCached<OrderRow[]>(ORDERS_CACHE_KEY, Number.POSITIVE_INFINITY)?.length,
    );
    if (cachedEnt?.length) {
      setEnterprises(cachedEnt as Enterprise[]);
      setLoading(false);
    } else if (!hasCachedOrders) {
      setLoading(true);
    }

    try {
      const token = await getSessionToken();
      if (!token) {
        setOrders([]);
        setEnterprises([]);
        return;
      }
      const [orderList, entList, pending] = await Promise.all([
        fetchCached(
          ORDERS_CACHE_KEY,
          () => apiFetch<OrderRow[]>('/api/orders', { method: 'GET', token }),
          60_000,
          force,
        ),
        fetchAllEnterprises(force),
        fetchPendingReviews(token).catch(() => [] as PendingReview[]),
      ]);
      setOrders(Array.isArray(orderList) ? orderList : []);
      setEnterprises(entList as Enterprise[]);
      setPendingReviews(Array.isArray(pending) ? pending : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOrderRated = useCallback((orderId: string, sousCommandeId?: string | null) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, peut_noter: false, sous_commande_id: null } : o))
    );
    if (sousCommandeId) {
      setPendingReviews((prev) => prev.filter((p) => p.sous_commande_id !== sousCommandeId));
    }
    // Sans ça, le cache 60 s des commandes renvoyait l'ancienne liste
    // (peut_noter: true) au focus suivant : la carte de notation réapparaissait
    // alors que la note était déjà envoyée. On invalide pour que le backend
    // recalcule peut_noter / pending à la prochaine visite.
    invalidateCached('orders:client');
  }, []);

  const onRefresh = useCallback(() => {
    void load();
  }, [load]);

  useFocusEffect(onRefresh);

  const enterpriseById = useMemo(() => new Map(enterprises.map((e) => [e.id, e])), [enterprises]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const da = a.cree_le ? new Date(a.cree_le).getTime() : 0;
        const db = b.cree_le ? new Date(b.cree_le).getTime() : 0;
        return db - da;
      }),
    [orders]
  );

  const ordersForTab = useMemo(() => {
    return sortedOrders.filter((o) => orderBucket(o.statut) === filter);
  }, [sortedOrders, filter]);

  const setExpanded = useCallback((v: boolean) => {
    setExpandedByTab((prev) => ({ ...prev, [filter]: v }));
  }, [filter]);

  const expanded = expandedByTab[filter];

  const emptyCopy: Record<FilterTab, { title: string; body: string }> = {
    encours: {
      title: 'Aucune commande en cours',
      body: 'Vos commandes actives apparaîtront ici avec suivi en temps réel.',
    },
    livrees: {
      title: 'Aucune livraison terminée',
      body: 'Les commandes livrées seront listées dans cet onglet.',
    },
    annulees: {
      title: 'Aucune commande annulée',
      body: "Les annulations éventuelles s'afficheront ici.",
    },
  };

  const filterLabels: { key: FilterTab; label: string }[] = [
    { key: 'encours', label: 'En cours' },
    { key: 'livrees', label: 'Livrées' },
    { key: 'annulees', label: 'Annulées' },
  ];

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: bottomPad + 8,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
            width: isDesktop ? '100%' : undefined,
          },
        ]}>
        <ThemedText type="title" style={[styles.pageTitle, { color: colors.primaryDeep }]}>
          Commandes
        </ThemedText>

        {pendingReviews.length > 0 ? (
          <View style={[styles.pendingReviewsBanner, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
            <ThemedText type="defaultSemiBold" style={[styles.pendingReviewsTitle, { color: colors.primaryDeep }]}>
              {pendingReviews.length} avis en attente
            </ThemedText>
            <ThemedText style={[styles.pendingReviewsBody, { color: colors.textSecondary }]}>
              Notez {pendingReviews[0]?.enterprise_nom ?? 'votre dernier commerce'} pour aider la communauté.
            </ThemedText>
            <Pressable
              style={[styles.pendingReviewsBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFilter('livrees')}>
              <ThemedText style={[styles.pendingReviewsBtnText, { color: colors.onPrimary }]}>Noter maintenant</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {filterLabels.map(({ key, label }) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                style={[styles.filterPill, active ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]}
                onPress={() => setFilter(key)}>
                <ThemedText style={[styles.filterPillText, active ? { color: colors.onPrimary } : { color: colors.textSecondary }]}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement…</ThemedText>
          </View>
        ) : error && sortedOrders.length === 0 ? (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', gap: 12, padding: 20 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement des commandes…</ThemedText>
            <Pressable style={[styles.retrySolid, { backgroundColor: colors.primary }]} onPress={() => void load()}>
              <ThemedText style={[styles.retrySolidText, { color: colors.onPrimary }]}>Actualiser</ThemedText>
            </Pressable>
          </View>
        ) : sortedOrders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
              <ScrollText size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.primaryDeep }]}>Aucune commande</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>
              Passez une commande depuis le panier pour la voir apparaître ici.
            </ThemedText>
            <Pressable style={[styles.retrySolid, { backgroundColor: colors.primary }]} onPress={() => router.navigate('/(tabs)')}>
              <ThemedText style={[styles.retrySolidText, { color: colors.onPrimary }]}>Ouvrir le marketplace</ThemedText>
            </Pressable>
          </View>
        ) : ordersForTab.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyTitle, { color: colors.primaryDeep }]}>{emptyCopy[filter].title}</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>{emptyCopy[filter].body}</ThemedText>
          </View>
        ) : (
          <OrdersScreenInner
            filter={filter}
            ordersForTab={ordersForTab}
            expanded={expanded}
            setExpanded={setExpanded}
            enterpriseById={enterpriseById}
            router={router}
            onOrderRated={handleOrderRated}
            colors={colors}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingRight: 4,
  },
  stepSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    flex: 1,
    height: 3,
    marginHorizontal: 2,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  pendingReviewsBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  pendingReviewsTitle: { fontSize: 13 },
  pendingReviewsBody: { fontSize: 13, lineHeight: 19 },
  pendingReviewsBtn: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  pendingReviewsBtnText: { fontWeight: '800', fontSize: 14 },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 18,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  loader: { marginTop: 48, alignItems: 'center', gap: 12 },
  muted: { fontSize: 14 },
  listGap: { gap: 14 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPressed: { opacity: 0.97 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderId: { fontSize: 13, letterSpacing: -0.2 },
  eta: { fontSize: 13, fontWeight: '600' },
  merchantTitle: { fontSize: 15, marginBottom: 6 },
  statusOrange: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusDark: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  cancelChip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
  },
  cancelChipText: { fontSize: 13, fontWeight: '800' },
  cancelDetail: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  deliveryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryText: { fontSize: 13, fontWeight: '700' },
  dottedLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dotted',
    borderWidth: 1,
    opacity: 0.85,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  dateMuted: { fontSize: 12 },
  priceStrong: { fontSize: 14 },
  seeAllBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  seeAllBtnPressed: { opacity: 0.92 },
  seeAllText: { fontSize: 13, fontWeight: '800' },
  emptyCard: {
    marginTop: 24,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  cardError: { alignItems: 'center', gap: 12 },
  errText: { fontWeight: '700', textAlign: 'center' },
  retrySolid: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retrySolidText: { fontWeight: '800' },
});
