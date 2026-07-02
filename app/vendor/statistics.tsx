import { ChevronDown, Eye, MousePointerClick, Percent, ShoppingBag, TrendingUp, Info, Package, AlertTriangle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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

const PERIODS = [
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 90, label: '90 derniers jours' },
] as const;

export default function VendorStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { palette } = useVendorTheme();
  const { orders, products, shop } = useVendor();
  const [periodDays, setPeriodDays] = useState(7);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader
        title="TABLEAU DE BORD"
        right={
          <Pressable style={[styles.dd, { backgroundColor: colors.surfaceMuted }]} hitSlop={8} onPress={() => setPickerOpen(true)}>
            <ThemedText style={[styles.ddTxt, { color: colors.text }]}>{periodDays}j</ThemedText>
            <ChevronDown size={14} color={colors.text} strokeWidth={3} />
          </Pressable>
        }
      />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 40 }}>
        
        <LinearGradient
          colors={[...palette.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bigCard, { shadowColor: palette.primary }]}>
          <View style={styles.bigCardHeader}>
            <View style={styles.revIconWrap}>
              <TrendingUp size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.revLab}>Chiffre d'affaires ({periodDays}j)</ThemedText>
          </View>
          <ThemedText style={styles.revVal}>{formatFcfa(stats.revenus7j)}</ThemedText>
          <View style={styles.trendRow}>
            <View style={[styles.trendBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <ThemedText style={styles.trend}>Panier moyen: {formatFcfa(stats.averageOrderValue)}</ThemedText>
            </View>
          </View>
          <View style={styles.bigCardGlow} />
        </LinearGradient>

        <View style={styles.row2}>
          <StatMiniCard
            label="Commandes"
            value={stats.commandes}
            colors={colors}
            icon={<ShoppingBag size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
          />
          <StatMiniCard
            label="Articles vendus"
            value={stats.produitsVendus}
            colors={colors}
            icon={<Package size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
          />
        </View>

        {/* Chart Section */}
        <View style={[styles.chartContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>Performance quotidienne</ThemedText>
          </View>
          <View style={styles.barsContainer}>
            {stats.dailyRevenues.map((day) => {
              const max = Math.max(...stats.dailyRevenues.map(d => d.amount), 1);
              const height = (day.amount / max) * 100;
              return (
                <View key={day.date} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <LinearGradient
                      colors={[palette.primary, palette.primarySoft]}
                      style={[styles.bar, { height: `${Math.max(height, 5)}%` }]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: colors.textSecondary }]}>{day.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Inventory Section */}
        <View style={[styles.inventoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>Gestion de Stock</ThemedText>
            <Package size={16} color={colors.textMuted} />
          </View>
          <View style={styles.inventoryRow}>
            <InventoryItem 
              label="Rupture" 
              count={stats.inventorySummary.outOfStock} 
              color={colors.error} 
              icon={<AlertTriangle size={14} color={colors.error} />}
            />
            <InventoryItem 
              label="Stock faible" 
              count={stats.inventorySummary.lowStock} 
              color="#F59E0B" 
              icon={<Info size={14} color="#F59E0B" />}
            />
            <InventoryItem 
              label="Total articles" 
              count={stats.inventorySummary.total} 
              color={colors.primary} 
              icon={<Package size={14} color={colors.primary} />}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text }]}>
            Top Produits (Ventes)
          </ThemedText>
        </View>
        
        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {stats.topProduits.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Aucune vente enregistrée.</ThemedText>
            </View>
          ) : (
            stats.topProduits.map((t, idx) => (
              <View key={t.nom} style={[styles.topRow, { borderBottomColor: idx === stats.topProduits.length - 1 ? 'transparent' : colors.border }]}>
                <View style={[styles.rankBadge, { backgroundColor: idx === 0 ? colors.primary : colors.surfaceMuted }]}>
                  <ThemedText style={[styles.rankText, { color: idx === 0 ? '#FFF' : colors.text }]}>{idx + 1}</ThemedText>
                </View>
                <ThemedText style={{ flex: 1, fontWeight: '700', color: colors.text }} numberOfLines={1}>{t.nom}</ThemedText>
                <View style={styles.ventesWrap}>
                  <ThemedText style={[styles.ventes, { color: colors.primary }]}>{t.ventes}</ThemedText>
                  <ThemedText style={[styles.ventesUnit, { color: colors.textMuted }]}> unités</ThemedText>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text }]}>
            Engagement Client
          </ThemedText>
        </View>

        {engagementLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width="100%" height={80} borderRadius={16} />
            <Skeleton width="100%" height={80} borderRadius={16} />
          </View>
        ) : !stats.engagement ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 20, borderWidth: 1 }]}>
            <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
              Données d'engagement non disponibles.
            </ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.engagementColumn}>
              <EngagementCard
                icon={<Eye size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Vues Boutique"
                value={stats.engagement?.totalVues ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={<MousePointerClick size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Clics Produits"
                value={stats.engagement?.totalClics ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={<ShoppingBag size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Conversions"
                value={stats.engagement?.totalVentes ?? 0}
                colors={colors}
                palette={palette}
              />
              <EngagementCard
                icon={<Percent size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Taux d'Achat"
                value={stats.engagement?.tauxConversionPct ?? 0}
                suffix="%"
                colors={colors}
                palette={palette}
              />
            </View>

            <ThemedText style={[styles.subH, { color: colors.textSecondary }]}>
              Plus consultés
            </ThemedText>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {stats.engagement?.topVus.length === 0 ? (
                <ThemedText style={[styles.empty, { color: colors.textMuted, padding: 16 }]}>Aucune vue.</ThemedText>
              ) : (
                stats.engagement?.topVus.slice(0, 5).map((t, idx) => (
                  <View key={`v-${t.id || idx}`} style={[styles.topRow, { borderBottomColor: idx === 4 ? 'transparent' : colors.border }]}>
                    <ThemedText style={[styles.rank, { color: colors.textMuted }]}>{idx + 1}</ThemedText>
                    <ThemedText style={{ flex: 1, fontWeight: '700', color: colors.text }} numberOfLines={1}>{t.nom}</ThemedText>
                    <ThemedText style={[styles.ventes, { color: colors.textMuted }]}>{t.vues} vues</ThemedText>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Choisir une période</ThemedText>
            </View>
            {PERIODS.map((p) => (
              <Pressable
                key={p.days}
                style={[styles.modalRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setPeriodDays(p.days);
                  setPickerOpen(false);
                }}>
                <ThemedText style={[styles.modalRowText, { color: periodDays === p.days ? colors.primary : colors.text }]}>
                  {p.label}
                </ThemedText>
                {periodDays === p.days && <View style={[styles.checkDot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function StatMiniCard({ label, value, colors, icon }: any) {
  return (
    <View style={[styles.smallCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.miniIconWrap, { backgroundColor: colors.primarySoft }]}>
        {icon}
      </View>
      <View>
        <ThemedText style={[styles.sVal, { color: colors.text }]}>{value}</ThemedText>
        <ThemedText style={[styles.sLab, { color: colors.textMuted }]}>{label}</ThemedText>
      </View>
    </View>
  );
}

function InventoryItem({ label, count, color, icon }: any) {
  return (
    <View style={styles.invItem}>
      <View style={styles.invHeader}>
        {icon}
        <ThemedText style={[styles.invLabel, { color }]}>{label}</ThemedText>
      </View>
      <ThemedText style={[styles.invCount, { color }]}>{count}</ThemedText>
    </View>
  );
}

function EngagementCard({
  icon,
  label,
  value,
  suffix,
  colors,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  colors: ReturnType<typeof useAppColors>;
  palette: any;
}) {
  return (
    <View style={[styles.engCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.engIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.engVal, { color: colors.text }]}>
          {value.toLocaleString('fr-FR')}
          {suffix ?? ''}
        </ThemedText>
        <ThemedText style={[styles.engLabel, { color: colors.textMuted }]} numberOfLines={1}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dd: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10 
  },
  ddTxt: { fontWeight: '900', fontSize: 13 },
  bigCard: { 
    borderRadius: 24, 
    padding: 24, 
    marginBottom: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  bigCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  revIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revLab: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  revVal: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', marginBottom: 12 },
  trendRow: { flexDirection: 'row' },
  trendBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  trend: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  bigCardGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  smallCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
  },
  miniIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sLab: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sVal: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  chartContainer: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, marginTop: 16, paddingHorizontal: 8 },
  barColumn: { alignItems: 'center', flex: 1 },
  barTrack: { width: 12, height: '100%', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  inventoryCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  inventoryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  invItem: { flex: 1, alignItems: 'center' },
  invHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  invLabel: { fontSize: 11, fontWeight: '700' },
  invCount: { fontSize: 18, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h: { fontSize: 18, fontWeight: '900' },
  listCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  emptyState: { padding: 32, alignItems: 'center' },
  empty: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  topRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingHorizontal: 16,
    paddingVertical: 14, 
    borderBottomWidth: StyleSheet.hairlineWidth 
  },
  rankBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '900' },
  ventesWrap: { flexDirection: 'row', alignItems: 'baseline' },
  ventes: { fontSize: 16, fontWeight: '900' },
  ventesUnit: { fontSize: 12, fontWeight: '700' },
  engCard: {
    width: '100%',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  engLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', flex: 1 },
  engVal: { fontSize: 22, fontWeight: '900' },
  engagementColumn: { gap: 12, marginBottom: 20 },
  subH: { fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  modalHeader: { padding: 24, alignItems: 'center', borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 20, 
    paddingHorizontal: 24, 
    borderBottomWidth: StyleSheet.hairlineWidth 
  },
  modalRowText: { fontSize: 16, fontWeight: '800' },
  checkDot: { width: 8, height: 8, borderRadius: 4 },
  rank: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '800' },
});
