import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSafeNavigation } from '@/hooks/use-safe-navigation';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Bike, Clock, CheckCircle2, XCircle, Package, ScrollText } from 'lucide-react-native';

import { OrderRatingCard } from '@/components/order-rating-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { GuestLoginSheet } from '@/components/guest-login-sheet';
import { fetchAllEnterprises, peekAllEnterprises } from '@/lib/client-data';
import { fetchCached, invalidateCached, peekCached } from '@/lib/request-cache';
import { formatDateTimeFr } from '@/lib/datetime';
import { formatFcfa } from '@/lib/format';
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
    commande?: { titre: string; date: string | null; type: string }[];
    livraisons?: { timeline?: { titre: string; date: string | null; type: string }[] }[];
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

/** Status color config */
function statusConfig(statut: string | null): { label: string; color: string; bg: string; icon: typeof Clock } {
  const k = normStatut(statut);
  if (k === 'livree') return { label: 'Livrée', color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 };
  if (k === 'en_livraison') return { label: 'En livraison', color: '#2563EB', bg: '#DBEAFE', icon: Bike };
  if (k === 'en_preparation' || k === 'a_preparer') return { label: 'En préparation', color: '#EA580C', bg: '#FFF7ED', icon: Package };
  if (k === 'prete' || k === 'collectee') return { label: 'Prête', color: '#7C3AED', bg: '#F5F3FF', icon: Package };
  if (k === 'acceptee' || k === 'partiellement_acceptee') return { label: 'Acceptée', color: '#0891B2', bg: '#ECFEFF', icon: CheckCircle2 };
  if (k === 'annulee' || k === 'remboursee') return { label: 'Annulée', color: '#DC2626', bg: '#FEF2F2', icon: XCircle };
  return { label: statutLabel(statut), color: '#6B7280', bg: '#F3F4F6', icon: Clock };
}

const PREVIEW_LIMIT = 4;

/** Small stepper dots */
function StepperDots({ filled, colors }: { filled: number; colors: ReturnType<typeof useAppColors> }) {
  const total = 4;
  const safe = Math.min(Math.max(filled, 1), total);
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < safe;
        return (
          <View key={i} style={stepStyles.stepSlot}>
            <View style={[stepStyles.dot, isFilled ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]} />
            {i < total - 1 ? (
              <View style={[stepStyles.line, i < safe - 1 ? { backgroundColor: colors.primary } : { backgroundColor: colors.border }]} />
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

    const status = statusConfig(o.statut);
    const StatusIcon = status.icon;

    if (filter === 'livrees') {
      const dateStr = formatLivreeLe(o.livree_le ?? o.cree_le);
      const canRate = Boolean(o.peut_noter && o.sous_commande_id);
      return (
        <Pressable
          key={o.id}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => safePush(`/order-tracking/${o.id}`)}
          android_ripple={{ color: colors.primarySoft }}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <ThemedText style={[styles.refText, { color: colors.text }]}>{refStr}</ThemedText>
            </View>
            {priceOk ? (
              <ThemedText style={[styles.priceText, { color: colors.primaryDeep }]}>{formatFcfa(prixNum)}</ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.merchantText, { color: colors.text }]} numberOfLines={1}>{merchant}</ThemedText>
          <View style={styles.cardFooter}>
            <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
              <StatusIcon size={12} color={status.color} strokeWidth={2.5} />
              <ThemedText style={[styles.statusChipText, { color: status.color }]}>{status.label}</ThemedText>
            </View>
            <ThemedText style={[styles.dateText, { color: colors.textMuted }]}>
              {dateStr ? `Le ${dateStr}` : orderCreatedLabel(o)}
            </ThemedText>
          </View>
          {canRate ? (
            <OrderRatingCard
              sousCommandeId={o.sous_commande_id!}
              merchantName={merchant}
              onRated={() => onOrderRated(o.id, o.sous_commande_id)}
            />
          ) : null}
        </Pressable>
      );
    }

    if (filter === 'annulees') {
      const chip = orderCancelledChip(o.statut, o.annulation_motif, o.commerce_type, o.sous_statuts);
      const chipColor = chip.tone === 'warn' ? '#D97706' : chip.tone === 'error' ? '#DC2626' : '#6B7280';
      const chipBg = chip.tone === 'warn' ? '#FEF3C7' : chip.tone === 'error' ? '#FEE2E2' : '#F3F4F6';
      return (
        <Pressable
          key={o.id}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => safePush(`/order-tracking/${o.id}`)}
          android_ripple={{ color: colors.primarySoft }}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.statusDot, { backgroundColor: chipColor }]} />
              <ThemedText style={[styles.refText, { color: colors.text }]}>{refStr}</ThemedText>
            </View>
            {priceOk ? (
              <ThemedText style={[styles.priceText, { color: colors.primaryDeep }]}>{formatFcfa(prixNum)}</ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.merchantText, { color: colors.text }]} numberOfLines={1}>{merchant}</ThemedText>
          <View style={[styles.cancelChip, { backgroundColor: chipBg }]}>
            <XCircle size={12} color={chipColor} strokeWidth={2.5} />
            <ThemedText style={[styles.cancelChipText, { color: chipColor }]}>{chip.label}</ThemedText>
          </View>
          {chip.detail ? (
            <ThemedText style={[styles.cancelDetail, { color: colors.textMuted }]} numberOfLines={2}>{chip.detail}</ThemedText>
          ) : null}
          {orderCreatedLabel(o) ? (
            <ThemedText style={[styles.dateText, { color: colors.textMuted, marginTop: 6 }]}>{orderCreatedLabel(o)}</ThemedText>
          ) : null}
        </Pressable>
      );
    }

    // En cours
    const steps = stepperFilledCount(o.statut);
    const isInDelivery = k === 'en livraison';

    return (
      <Pressable
        key={o.id}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/order-tracking/${o.id}`)}
        android_ripple={{ color: colors.primarySoft }}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <ThemedText style={[styles.refText, { color: colors.text }]}>{refStr}</ThemedText>
          </View>
          {priceOk ? (
            <ThemedText style={[styles.priceText, { color: colors.primaryDeep }]}>{formatFcfa(prixNum)}</ThemedText>
          ) : null}
        </View>
        <ThemedText style={[styles.merchantText, { color: colors.text }]} numberOfLines={1}>{merchant}</ThemedText>
        <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
          <StatusIcon size={12} color={status.color} strokeWidth={2.5} />
          <ThemedText style={[styles.statusChipText, { color: status.color }]}>{status.label}</ThemedText>
        </View>
        {orderCreatedLabel(o) ? (
          <ThemedText style={[styles.dateText, { color: colors.textMuted, marginTop: 8 }]}>{orderCreatedLabel(o)}</ThemedText>
        ) : null}
        <StepperDots filled={steps} colors={colors} />
        {isInDelivery ? (
          <View style={[styles.deliveryBanner, { backgroundColor: colors.primarySoft }]}>
            <Bike size={16} color={colors.primary} strokeWidth={2.4} />
            <ThemedText style={[styles.deliveryBannerText, { color: colors.primary }]}>Livreur en route</ThemedText>
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
          style={({ pressed }) => [styles.seeAllBtn, pressed && styles.seeAllBtnPressed]}
          onPress={() => setExpanded(true)}>
          <ThemedText style={[styles.seeAllText, { color: colors.primary }]}>
            Voir les {ordersForTab.length} commandes
          </ThemedText>
        </Pressable>
      ) : null}
    </>
  );
}

const ORDERS_CACHE_KEY = 'orders:client';

export default function OrdersScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { safePush, safeBack } = useSafeNavigation();
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
  const [pendingReviews, setPendingReviews] = useState<{ id: string; sous_commande_id: string; enterprise_nom: string | null }[]>([]);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [showGuestSheet, setShowGuestSheet] = useState(false);
  const isDesktop = useIsWebDesktop();

  const bottomPad = isDesktop ? 24 : Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  const load = useCallback(async (force = false) => {
    setError(null);
    const cachedEnt = peekAllEnterprises();
    const hasCachedOrders = Boolean(peekCached<OrderRow[]>(ORDERS_CACHE_KEY, Number.POSITIVE_INFINITY)?.length);
    if (cachedEnt?.length) {
      setEnterprises(cachedEnt as Enterprise[]);
      setLoading(false);
    } else if (!hasCachedOrders) {
      setLoading(true);
    }
    try {
      const token = await getSessionToken();
      if (!token) { setHasToken(false); setOrders([]); setEnterprises([]); return; }
      setHasToken(true);
      const [orderList, entList] = await Promise.all([
        fetchCached(ORDERS_CACHE_KEY, () => apiFetch<OrderRow[]>('/api/orders', { method: 'GET', token }), 60_000, force),
        fetchAllEnterprises(force),
      ]);
      setOrders(Array.isArray(orderList) ? orderList : []);
      setEnterprises(entList as Enterprise[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOrderRated = useCallback((orderId: string, sousCommandeId?: string | null) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, peut_noter: false, sous_commande_id: null } : o)));
    if (sousCommandeId) {
      setPendingReviews((prev) => prev.filter((p) => p.sous_commande_id !== sousCommandeId));
    }
    invalidateCached('orders:client');
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const enterpriseById = useMemo(() => new Map(enterprises.map((e) => [e.id, e])), [enterprises]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => {
      const da = a.cree_le ? new Date(a.cree_le).getTime() : 0;
      const db = b.cree_le ? new Date(b.cree_le).getTime() : 0;
      return db - da;
    }),
    [orders],
  );

  const ordersForTab = useMemo(
    () => sortedOrders.filter((o) => orderBucket(o.statut) === filter),
    [sortedOrders, filter],
  );

  const setExpanded = useCallback((v: boolean) => {
    setExpandedByTab((prev) => ({ ...prev, [filter]: v }));
  }, [filter]);

  const expanded = expandedByTab[filter];

  const emptyCopy: Record<FilterTab, { icon: typeof ScrollText; title: string; body: string }> = {
    encours: { icon: Package, title: 'Aucune commande en cours', body: 'Vos commandes actives apparaîtront ici.' },
    livrees: { icon: CheckCircle2, title: 'Aucune livraison terminée', body: 'Les commandes livrées seront listées ici.' },
    annulees: { icon: XCircle, title: 'Aucune commande annulée', body: 'Les annulations s\'afficheront ici.' },
  };

  const filterLabels: { key: FilterTab; label: string; icon: typeof Clock }[] = [
    { key: 'encours', label: 'En cours', icon: Clock },
    { key: 'livrees', label: 'Livrées', icon: CheckCircle2 },
    { key: 'annulees', label: 'Annulées', icon: XCircle },
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
        {/* Header */}
        <View style={styles.pageHeader}>
          <ThemedText style={[styles.pageTitle, { color: colors.text }]}>Commandes</ThemedText>
          {sortedOrders.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.surfaceMuted }]}>
              <ThemedText style={[styles.countText, { color: colors.textSecondary }]}>{sortedOrders.length}</ThemedText>
            </View>
          ) : null}
        </View>

        {/* Pending reviews */}
        {pendingReviews.length > 0 ? (
          <View style={[styles.reviewBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <View style={styles.reviewBannerContent}>
              <ThemedText style={[styles.reviewTitle, { color: '#92400E' }]}>
                ⭐ {pendingReviews.length} avis en attente
              </ThemedText>
              <ThemedText style={[styles.reviewBody, { color: '#A16207' }]}>
                Notez {pendingReviews[0]?.enterprise_nom ?? 'votre dernier commerce'}
              </ThemedText>
            </View>
            <Pressable style={[styles.reviewBtn, { backgroundColor: '#F59E0B' }]} onPress={() => setFilter('livrees')}>
              <ThemedText style={styles.reviewBtnText}>Noter</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Filter tabs */}
        <View style={[styles.filterRow, { backgroundColor: colors.surfaceMuted }]}>
          {filterLabels.map(({ key, label, icon: Icon }) => {
            const active = filter === key;
            const count = sortedOrders.filter((o) => orderBucket(o.statut) === key).length;
            return (
              <Pressable
                key={key}
                style={[styles.filterTab, active && { backgroundColor: colors.surface }]}
                onPress={() => setFilter(key)}>
                <Icon size={14} color={active ? colors.primary : colors.textMuted} strokeWidth={active ? 2.5 : LUCIDE_STROKE} />
                <ThemedText style={[styles.filterLabel, { color: active ? colors.primary : colors.textMuted }]}>
                  {label}
                </ThemedText>
                {count > 0 ? (
                  <View style={[styles.filterCount, { backgroundColor: active ? colors.primarySoft : colors.border }]}>
                    <ThemedText style={[styles.filterCountText, { color: active ? colors.primary : colors.textMuted }]}>{count}</ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Guest state */}
        {hasToken === false ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
              <ScrollText size={32} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>Connectez-vous</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>
              Connectez-vous pour suivre vos commandes et consulter votre historique.
            </ThemedText>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowGuestSheet(true)}>
              <ThemedText style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Se connecter</ThemedText>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : sortedOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
              <ScrollText size={32} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>Aucune commande</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>
              Passez une commande depuis le marketplace pour la voir apparaître ici.
            </ThemedText>
            <Pressable style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.navigate('/(tabs)')}>
              <ThemedText style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Ouvrir le marketplace</ThemedText>
            </Pressable>
          </View>
        ) : ordersForTab.length === 0 ? (
          <View style={styles.emptyState}>
            {(() => { const E = emptyCopy[filter].icon; return <E size={28} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />; })()}
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>{emptyCopy[filter].title}</ThemedText>
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
      <GuestLoginSheet visible={showGuestSheet} onClose={() => setShowGuestSheet(false)} />
    </ThemedView>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  stepSlot: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, height: 2, marginHorizontal: 2, borderRadius: 1 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  pageTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: '700' },

  // Review banner
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  reviewBannerContent: { flex: 1, gap: 2 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewBody: { fontSize: 12, fontWeight: '600' },
  reviewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  reviewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  filterLabel: { fontSize: 13, fontWeight: '700' },
  filterCount: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  filterCountText: { fontSize: 11, fontWeight: '800' },

  // Cards
  listGap: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: { opacity: 0.97, transform: [{ scale: 0.99 }] },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  refText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  priceText: { fontSize: 14, fontWeight: '800' },
  merchantText: { fontSize: 15, fontWeight: '700', marginBottom: 8 },

  // Status chip
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  // Cancel
  cancelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
  },
  cancelChipText: { fontSize: 12, fontWeight: '700' },
  cancelDetail: { fontSize: 13, lineHeight: 18 },

  // Delivery banner
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  deliveryBannerText: { fontSize: 13, fontWeight: '700' },

  // Date
  dateText: { fontSize: 12, fontWeight: '500' },

  // See all
  seeAllBtn: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  seeAllBtnPressed: { opacity: 0.92 },
  seeAllText: { fontSize: 14, fontWeight: '700' },

  // Empty
  loader: { marginTop: 48, alignItems: 'center' },
  emptyState: { marginTop: 40, alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '800' },
});
