import {
  AlertTriangle,
  Eye,
  Info,
  MousePointerClick,
  Package,
  Percent,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useVendor } from '@/contexts/vendor-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { formatFcfa } from '@/lib/format';
import { fetchMyEnterpriseStats } from '@/lib/vendor-api';
import { computeVendorStats, type VendorEngagementInput } from '@/lib/vendor-types';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppPalette } from '@/constants/app-palette';
import type { VendorPalette } from '@/lib/vendor-theme';

/** Périodes de la fenêtre d'analyse — libellés humains et explicites. */
const PERIODS = [
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 90, label: '90 derniers jours' },
] as const;

const SEG_PAD = 4;

type DailyRevenue = { date: string; amount: number; label: string };

/** Regroupe les revenus journaliers en ≤ maxBars barres (sinon illisible en 30j/90j). */
function bucketRevenues(daily: DailyRevenue[], maxBars = 14): DailyRevenue[] {
  if (daily.length <= maxBars) return daily;
  const bucketSize = Math.ceil(daily.length / maxBars);
  const out: DailyRevenue[] = [];
  for (let i = 0; i < daily.length; i += bucketSize) {
    const slice = daily.slice(i, i + bucketSize);
    out.push({
      date: slice[0].date,
      amount: slice.reduce((s, d) => s + d.amount, 0),
      // Dernier segment : garde le libellé du jour le plus récent ("Auj.").
      label: slice[slice.length - 1].label,
    });
  }
  return out;
}

function SectionTitle({ title, colors }: { title: string; colors: AppPalette }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </ThemedText>
    </View>
  );
}

/**
 * Sélecteur de période : une pastille coulisse en douceur sur la période
 * active. Libellés explicites (« 30 derniers jours ») plutôt que « 30j ».
 */
function PeriodSelector({
  period,
  onChange,
  colors,
  palette,
}: {
  period: number;
  onChange: (days: number) => void;
  colors: AppPalette;
  palette: VendorPalette;
}) {
  const [width, setWidth] = useState(0);
  const pillX = useSharedValue(0);
  const activeIdx = Math.max(
    0,
    PERIODS.findIndex((p) => p.days === period),
  );

  useEffect(() => {
    if (width <= 0) return;
    const inner = (width - SEG_PAD * 2) / PERIODS.length;
    pillX.value = withSpring(SEG_PAD + activeIdx * inner, {
      damping: 20,
      stiffness: 280,
      mass: 0.6,
    });
  }, [activeIdx, width, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    width: width > 0 ? (width - SEG_PAD * 2) / PERIODS.length : 0,
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
      ]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.segmentPill, { backgroundColor: palette.primary }, pillStyle]} />
      {PERIODS.map((p) => {
        const active = p.days === period;
        return (
          <Pressable
            key={p.days}
            style={styles.segment}
            onPress={() => onChange(p.days)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            <ThemedText
              style={[
                styles.segmentTxt,
                { color: active ? '#FFFFFF' : colors.textSecondary },
                active && styles.segmentTxtActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}>
              {p.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function KpiCard({
  label,
  value,
  colors,
  palette,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  colors: AppPalette;
  palette: VendorPalette;
  icon: LucideIcon;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.kpiIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.kpiValue, { color: colors.text }]} numberOfLines={1}>
          {value}
        </ThemedText>
        <ThemedText style={[styles.kpiLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

function InventoryItem({
  label,
  count,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: LucideIcon;
}) {
  return (
    <View style={styles.invItem}>
      <View style={styles.invHeader}>
        <Icon size={14} color={color} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.invLabel, { color }]}>{label}</ThemedText>
      </View>
      <ThemedText style={[styles.invCount, { color }]}>{count}</ThemedText>
    </View>
  );
}

function EngagementCard({
  icon: Icon,
  label,
  value,
  suffix,
  colors,
  palette,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  colors: AppPalette;
  palette: VendorPalette;
}) {
  return (
    <View style={[styles.engCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.engIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.engValue, { color: colors.text }]} numberOfLines={1}>
          {value.toLocaleString('fr-FR')}
          {suffix ?? ''}
        </ThemedText>
        <ThemedText style={[styles.engLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

export default function VendorStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { palette } = useVendorTheme();
  const { orders, products, shop } = useVendor();
  const [periodDays, setPeriodDays] = useState(7);
  const [engagement, setEngagement] = useState<VendorEngagementInput | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!shop?.id) return;
    const fire = async () => {
      setEngagementLoading(true);
      try {
        const token = await getSessionToken();
        if (!token) return;
        const data = await fetchMyEnterpriseStats(token, shop.id);
        if (alive) setEngagement(data?.engagement ?? null);
      } catch {
        if (alive) setEngagement(null);
      } finally {
        if (alive) setEngagementLoading(false);
      }
    };
    void fire();
    return () => {
      alive = false;
    };
  }, [shop?.id, orders.length, periodDays]);

  const stats = useMemo(
    () => computeVendorStats(orders, products, periodDays, engagement),
    [orders, products, periodDays, engagement],
  );

  const bars = useMemo(() => bucketRevenues(stats.dailyRevenues), [stats.dailyRevenues]);
  const maxAmount = Math.max(...bars.map((b) => b.amount), 1);
  const hasSales = bars.some((b) => b.amount > 0);

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader
        title="Statistiques"
        subtitle="L’activité de votre commerce"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        {/* Sélecteur de période */}
        <PeriodSelector period={periodDays} onChange={setPeriodDays} colors={colors} palette={palette} />

        {/* Carte revenus */}
        <LinearGradient
          colors={[...palette.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { shadowColor: palette.primary }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <TrendingUp size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.heroLabel}>Chiffre d’affaires</ThemedText>
          </View>
          <ThemedText style={styles.heroValue}>{formatFcfa(stats.revenus7j)}</ThemedText>
          <View style={styles.heroFooter}>
            <ThemedText style={styles.heroTrend}>
              {stats.commandesPayees > 0
                ? `${stats.commandesPayees} commande${stats.commandesPayees > 1 ? 's' : ''} payée${stats.commandesPayees > 1 ? 's' : ''} · panier moyen ${formatFcfa(stats.averageOrderValue)}`
                : 'Aucune commande sur cette période'}
            </ThemedText>
          </View>
          <View style={styles.heroGlow} />
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Commandes payées"
            value={stats.commandesPayees}
            colors={colors}
            palette={palette}
            icon={ShoppingBag}
          />
          <KpiCard
            label="Articles vendus"
            value={stats.produitsVendus}
            colors={colors}
            palette={palette}
            icon={Package}
          />
        </View>

        {/* Graphique */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionTitle
            title={periodDays === 7 ? 'Ventes jour par jour' : 'Ventes sur la période'}
            colors={colors}
          />
          {hasSales ? (
            <View style={styles.barsRow}>
              {bars.map((day) => {
                const height = (day.amount / maxAmount) * 100;
                return (
                  <View key={day.date} style={styles.barColumn}>
                    <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                      <LinearGradient
                        colors={[palette.primary, palette.primaryDeep]}
                        style={[styles.bar, { height: `${Math.max(height, 6)}%` }]}
                      />
                    </View>
                    <ThemedText style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>
                      {day.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                Aucune vente sur cette période.
              </ThemedText>
            </View>
          )}
        </View>

        {/* Stock */}
        <View style={[styles.inventoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SectionTitle title="Votre stock" colors={colors} />
          <View style={styles.inventoryRow}>
            <InventoryItem
              label="En rupture"
              count={stats.inventorySummary.outOfStock}
              color={colors.error}
              icon={AlertTriangle}
            />
            <InventoryItem
              label="Stock faible"
              count={stats.inventorySummary.lowStock}
              color={colors.warning}
              icon={Info}
            />
            <InventoryItem
              label="Total produits"
              count={stats.inventorySummary.total}
              color={palette.primary}
              icon={Package}
            />
          </View>
        </View>

        {/* Top produits */}
        <View style={{ marginBottom: 24 }}>
          <SectionTitle title="Vos meilleures ventes" colors={colors} />
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {stats.topProduits.length === 0 ? (
              <View style={styles.emptyBox}>
                <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                  Aucune vente enregistrée.
                </ThemedText>
              </View>
            ) : (
              stats.topProduits.map((t, idx) => (
                <View
                  key={t.nom}
                  style={[
                    styles.topRow,
                    { borderBottomColor: idx === stats.topProduits.length - 1 ? 'transparent' : colors.border },
                  ]}>
                  <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? palette.primary : colors.surfaceMuted }]}>
                    <ThemedText style={[styles.rankText, { color: idx === 0 ? '#FFF' : colors.text }]}>
                      {idx + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.topName, { color: colors.text }]} numberOfLines={1}>
                    {t.nom}
                  </ThemedText>
                  <View style={styles.ventesWrap}>
                    <ThemedText style={[styles.ventes, { color: palette.primary }]}>{t.ventes}</ThemedText>
                    <ThemedText style={[styles.ventesUnit, { color: colors.textMuted }]}> unités</ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Engagement */}
        <SectionTitle title="Votre audience" colors={colors} />
        {engagementLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={80} borderRadius={16} />
            <Skeleton width="100%" height={80} borderRadius={16} />
          </View>
        ) : !stats.engagement ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
              {'Données d\'engagement non disponibles.'}
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.engGrid}>
              <EngagementCard
                icon={Eye}
                label="Visites de la page"
                value={stats.engagement?.totalVues ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={MousePointerClick}
                label="Clics produits"
                value={stats.engagement?.totalClics ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={ShoppingBag}
                label="Achats"
                value={stats.engagement?.totalVentes ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={Percent}
                label="Taux d'achat"
                value={stats.engagement?.tauxConversionPct ?? 0}
                suffix="%"
                colors={colors}
                palette={palette}
              />
            </View>

            {(stats.engagement?.topVus.length ?? 0) > 0 ? (
              <>
                <ThemedText style={[styles.subHeader, { color: colors.textSecondary }]}>
                  Plus consultés
                </ThemedText>
                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {stats.engagement?.topVus.slice(0, 5).map((t, idx) => (
                    <View
                      key={`v-${t.id || idx}`}
                      style={[
                        styles.topRow,
                        { borderBottomColor: idx === 4 ? 'transparent' : colors.border },
                      ]}>
                      <ThemedText style={[styles.rank, { color: colors.textMuted }]}>{idx + 1}</ThemedText>
                      <ThemedText style={[styles.topName, { color: colors.text }]} numberOfLines={1}>
                        {t.nom}
                      </ThemedText>
                      <ThemedText style={[styles.ventes, { color: colors.textMuted }]}>{t.vues} vues</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Sélecteur de période
  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: SEG_PAD,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: SEG_PAD,
    bottom: SEG_PAD,
    left: 0,
    borderRadius: 10,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  segmentTxt: { fontSize: 12, fontWeight: '600' },
  segmentTxtActive: { fontWeight: '800' },

  // Carte revenus
  heroCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  heroValue: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', marginBottom: 10 },
  heroFooter: { flexDirection: 'row' },
  heroTrend: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // KPIs
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kpiIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  kpiLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Graphique
  chartCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 130,
    marginTop: 12,
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    width: '70%',
    maxWidth: 16,
    height: '82%',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 9, marginTop: 5, fontWeight: '600', maxWidth: '100%' },

  // Stock
  inventoryCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  inventoryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  invItem: { flex: 1, alignItems: 'center' },
  invHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  invLabel: { fontSize: 11, fontWeight: '700' },
  invCount: { fontSize: 18, fontWeight: '900' },

  // Listes
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  listCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '900' },
  topName: { flex: 1, fontWeight: '700', fontSize: 15 },
  ventesWrap: { flexDirection: 'row', alignItems: 'baseline' },
  ventes: { fontSize: 16, fontWeight: '900' },
  ventesUnit: { fontSize: 12, fontWeight: '700' },
  rank: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '800' },

  // Engagement
  engGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  engCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  engIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  engValue: { fontSize: 20, fontWeight: '900', marginBottom: 1 },
  engLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  subHeader: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // États vides
  emptyBox: { paddingVertical: 24, alignItems: 'center' },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
