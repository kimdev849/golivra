import { ChevronDown, Eye, MousePointerClick, Percent, ShoppingBag } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const PERIODS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
] as const;

export default function VendorStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
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

  const periodLabel = PERIODS.find((p) => p.days === periodDays)?.label ?? `${periodDays} jours`;
  const stats = useMemo(
    () => computeVendorStats(orders, products, periodDays, engagement),
    [orders, products, periodDays, engagement],
  );

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader
        title="STATISTIQUES"
        right={
          <Pressable style={styles.dd} hitSlop={8} onPress={() => setPickerOpen(true)}>
            <ThemedText style={[styles.ddTxt, { color: colors.text }]}>{periodLabel}</ThemedText>
            <ChevronDown size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 20 }}>
        <View style={[styles.bigCard, { backgroundColor: colors.primarySoft }]}>
          <ThemedText style={[styles.revLab, { color: colors.textSecondary }]}>Revenus ({periodLabel})</ThemedText>
          <ThemedText style={[styles.revVal, { color: colors.text }]}>{formatFcfa(stats.revenus7j)}</ThemedText>
          <ThemedText style={[styles.trend, { color: colors.success }]}>{stats.revenusTrend}</ThemedText>
        </View>
        <View style={styles.row2}>
          <View style={[styles.smallCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.sLab, { color: colors.textSecondary }]}>Commandes</ThemedText>
            <ThemedText style={[styles.sVal, { color: colors.text }]}>{stats.commandes}</ThemedText>
            <ThemedText style={[styles.sTrend, { color: colors.success }]}>{stats.commandesTrend}</ThemedText>
          </View>
          <View style={[styles.smallCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.sLab, { color: colors.textSecondary }]}>Produits vendus</ThemedText>
            <ThemedText style={[styles.sVal, { color: colors.text }]}>{stats.produitsVendus}</ThemedText>
            <ThemedText style={[styles.sTrend, { color: colors.success }]}>{stats.produitsTrend}</ThemedText>
          </View>
        </View>
        <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text }]}>
          Top produits
        </ThemedText>
        {stats.topProduits.length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Pas encore de ventes enregistrées.</ThemedText>
        ) : (
          stats.topProduits.map((t) => (
            <View key={t.nom} style={[styles.topRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.miniThumb, { backgroundColor: colors.surfaceMuted }]} />
              <ThemedText style={{ flex: 1, fontWeight: '700', color: colors.text }}>{t.nom}</ThemedText>
              <ThemedText style={[styles.ventes, { color: colors.textMuted }]}>{t.ventes} ventes</ThemedText>
            </View>
          ))
        )}

        <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text, marginTop: 22 }]}>
          Engagement
        </ThemedText>
        {engagementLoading ? (
          <View style={styles.engagementLoading}>
            <ActivityIndicator color={colors.primary} />
            <ThemedText style={[styles.engagementHint, { color: colors.textMuted }]}>
              Calcul des vues et clics…
            </ThemedText>
          </View>
        ) : !stats.engagement ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
            Engagement non disponible pour le moment.
          </ThemedText>
        ) : (
          <>
            <View style={styles.engagementRow}>
              <EngagementCard
                icon={<Eye size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Vues du menu"
                value={stats.engagement.totalVues}
                colors={colors}
              />
              <EngagementCard
                icon={<MousePointerClick size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Ajouts au panier"
                value={stats.engagement.totalClics}
                colors={colors}
              />
            </View>
            <View style={styles.engagementRow}>
              <EngagementCard
                icon={<ShoppingBag size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Ventes"
                value={stats.engagement.totalVentes}
                colors={colors}
              />
              <EngagementCard
                icon={<Percent size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                label="Taux de conversion"
                value={stats.engagement.tauxConversionPct}
                suffix=" %"
                colors={colors}
              />
            </View>

            <ThemedText style={[styles.subH, { color: colors.textSecondary }]}>
              Produits les plus vus
            </ThemedText>
            {stats.engagement.topVus.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
                Aucune vue enregistrée.
              </ThemedText>
            ) : (
              stats.engagement.topVus.map((t, idx) => (
                <View key={`v-${t.id || idx}`} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.rank, { color: colors.textMuted }]}>{idx + 1}</ThemedText>
                  <ThemedText style={{ flex: 1, fontWeight: '700', color: colors.text }}>{t.nom}</ThemedText>
                  <ThemedText style={[styles.ventes, { color: colors.textMuted }]}>{t.vues} vues</ThemedText>
                </View>
              ))
            )}

            <ThemedText style={[styles.subH, { color: colors.textSecondary }]}>
              Produits les plus cliqués
            </ThemedText>
            {stats.engagement.topCliques.length === 0 ? (
              <ThemedText style={[styles.empty, { color: colors.textMuted }]}>
                Aucun clic enregistré.
              </ThemedText>
            ) : (
              stats.engagement.topCliques.map((t, idx) => (
                <View key={`c-${t.id || idx}`} style={[styles.topRow, { borderBottomColor: colors.border }]}>
                  <ThemedText style={[styles.rank, { color: colors.textMuted }]}>{idx + 1}</ThemedText>
                  <ThemedText style={{ flex: 1, fontWeight: '700', color: colors.text }}>{t.nom}</ThemedText>
                  <ThemedText style={[styles.ventes, { color: colors.textMuted }]}>{t.clics} ajouts</ThemedText>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPickerOpen(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.days}
                style={[styles.modalRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setPeriodDays(p.days);
                  setPickerOpen(false);
                }}>
                <ThemedText style={[styles.modalRowText, { color: colors.text }]}>{p.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function EngagementCard({
  icon,
  label,
  value,
  suffix,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <View style={[styles.engCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <View style={[styles.engIcon, { backgroundColor: colors.surface }]}>{icon}</View>
      <View style={styles.engBody}>
        <ThemedText style={[styles.engLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
        <ThemedText style={[styles.engVal, { color: colors.text }]}>
          {value.toLocaleString('fr-FR')}
          {suffix ?? ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  dd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ddTxt: { fontWeight: '800', fontSize: 13 },
  bigCard: { borderRadius: 16, padding: 18, marginBottom: 14 },
  revLab: { fontSize: 13, fontWeight: '700' },
  revVal: { fontSize: 28, fontWeight: '800', marginTop: 6 },
  trend: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  smallCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sLab: { fontSize: 12, fontWeight: '700' },
  sVal: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  sTrend: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  h: { fontSize: 16, marginBottom: 12 },
  subH: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { fontSize: 14, marginBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  miniThumb: { width: 40, height: 40, borderRadius: 8 },
  rank: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  ventes: { fontSize: 13, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 16, overflow: 'hidden' },
  modalRow: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  modalRowText: { fontSize: 16, fontWeight: '700' },
  engagementLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  engagementHint: { fontSize: 13, fontWeight: '600' },
  engagementRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  engCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  engIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  engBody: { flex: 1 },
  engLabel: { fontSize: 12, fontWeight: '700' },
  engVal: { fontSize: 18, fontWeight: '800', marginTop: 2 },
});
