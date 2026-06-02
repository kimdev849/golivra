import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronRight, Truck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { VENDOR_TAB_BAR_PADDING_BOTTOM } from '@/constants/vendor-layout';
import { useVendor } from '@/contexts/vendor-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { formatFcfa } from '@/lib/format';
import type { VendorPalette } from '@/lib/vendor-theme';
import { VENDOR_HREF, hrefVendorOrder } from '@/lib/vendor-nav';
import type { VendorOrderStatus } from '@/lib/vendor-types';
import { vendorOrderStatusLabel as statusLabel } from '@/lib/ux-copy';

function statusStyle(s: VendorOrderStatus, colors: ReturnType<typeof useAppColors>) {
  switch (s) {
    case 'en_attente':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'acceptee':
    case 'a_preparer':
      return { bg: colors.successSoft, text: colors.success };
    case 'en_preparation':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'prete':
      return { bg: colors.successSoft, text: colors.primaryDeep };
    case 'en_livraison':
      return { bg: colors.primarySoft, text: colors.primary };
    case 'livree':
      return { bg: colors.successSoft, text: colors.primaryDeep };
    case 'annulee':
      return { bg: colors.errorSoft, text: colors.error };
    default:
      return { bg: colors.surfaceMuted, text: colors.textSecondary };
  }
}

export default function VendorDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const colorScheme = useColorScheme();
  const { shop, orders } = useVendor();
  const { palette, labels, commerceType } = useVendorTheme();
  const { unreadCount } = useUnreadNotifications();
  const recent = orders.slice(0, 4);
  const bottom = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  const todayRevenue = orders
    .filter((o) => {
      if (!o.created_at || o.statut === 'annulee') return false;
      const d = new Date(o.created_at);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, o) => acc + o.prixTotal, 0);

  const shopName = shop?.nom || 'Mon commerce';
  const isOnline = shop?.enLigne === true;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>
        <View style={styles.topRow}>
          <ThemedText type="title" style={[styles.greeting, { color: colors.text }]} numberOfLines={2}>
            Bonjour {shopName} 👋
          </ThemedText>
          <View style={styles.topActions}>
            <Pressable
              style={[styles.notifBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(VENDOR_HREF.notifications)}
              hitSlop={10}>
              <Bell size={20} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
              {unreadCount > 0 ? (
                <View style={[styles.notifBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                  <ThemedText style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
                </View>
              ) : null}
            </Pressable>
            <View
              style={[
                styles.onlinePill,
                {
                  backgroundColor: isOnline ? colors.successSoft : colors.surfaceMuted,
                  borderColor: isOnline ? colors.border : colors.borderStrong,
                },
              ]}>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
              <ThemedText style={[styles.onlineText, { color: isOnline ? colors.success : colors.textMuted }]}>
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </ThemedText>
            </View>
          </View>
        </View>

        <Pressable style={styles.revenuePress} onPress={() => router.push(VENDOR_HREF.statistics)}>
          <LinearGradient colors={[...palette.gradient]} style={[styles.revenueCard, { shadowColor: colors.primary }]}>
            <View style={styles.revenueTop}>
              <ThemedText style={styles.revenueLabel}>{labels.dashboardRevenueLabel}</ThemedText>
              <ChevronRight size={22} color="rgba(255,255,255,0.85)" />
            </View>
            <ThemedText style={styles.revenueAmount}>{formatFcfa(todayRevenue)}</ThemedText>
            <ThemedText style={styles.revenueTrend}>
              {orders.length === 0 ? 'Aucune commande pour le moment' : `${orders.length} commande(s) au total`}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        <View style={styles.statsRow}>
          {labels.dashboardStatCards.map((c) => (
            <View key={c.label} style={[styles.statCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{c.value}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{c.label}</ThemedText>
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.deliveryCard, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}
          onPress={() => router.push(VENDOR_HREF.deliveriesTab)}>
          <View style={[styles.deliveryIcon, { backgroundColor: palette.primary }]}>
            <Truck size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.deliveryTitle, { color: palette.primaryDeep }]}>
              Vos livraisons en cours
            </ThemedText>
            <ThemedText style={[styles.deliverySub, { color: colors.textMuted }]}>
              Internes (commandes client) et externes (créées par vous). Livreur GoLivra assigné automatiquement.
            </ThemedText>
          </View>
          <ChevronRight size={22} color={palette.primary} />
        </Pressable>

        {labels.dashboardExtra ? (
          <View style={[styles.extraCard, { borderColor: palette.trackStroke, backgroundColor: colors.primarySoft }]}>
            <ThemedText type="defaultSemiBold" style={[styles.extraTitle, { color: colors.text }]}>
              {labels.dashboardExtra.title}
            </ThemedText>
            <View style={styles.extraRow}>
              {labels.dashboardExtra.lines.map((line) => (
                <View key={line.label} style={styles.extraCell}>
                  <ThemedText style={[styles.extraVal, { color: colors.text }]}>{line.value}</ThemedText>
                  <ThemedText style={[styles.extraLab, { color: colors.textMuted }]}>{line.label}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
            Commandes récentes
          </ThemedText>
          <Pressable onPress={() => router.push(VENDOR_HREF.ordersTab)}>
            <ThemedText style={[styles.seeAll, { color: colors.primary }]}>Voir tout</ThemedText>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune commande pour le moment.</ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>
              {shop?.statut_moderation === 'en_attente'
                ? 'Votre commerce est en attente de validation.'
                : 'Ajoutez des produits pour commencer à recevoir des commandes.'}
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recent.map((o) => {
              const st = statusStyle(o.statut, colors);
              return (
                <Pressable
                  key={o.id}
                  style={[styles.orderRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(hrefVendorOrder(o.id))}
                  android_ripple={{ color: colors.primarySoft }}>
                  <View style={[styles.thumbPh, { backgroundColor: colors.primarySoft }]}>
                    <ThemedText style={[styles.thumbLetter, { color: palette.primary }]}>
                      {o.clientNom.charAt(0)}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={[styles.orderRef, { color: colors.text }]}>
                      #{o.ref}
                    </ThemedText>
                    <ThemedText style={[styles.orderPrice, { color: colors.textMuted }]}>{formatFcfa(o.prixTotal)}</ThemedText>
                  </View>
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <ThemedText style={[styles.pillText, { color: st.text }]}>{statusLabel(o.statut)}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greeting: { flex: 1, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: '800' },
  revenuePress: { marginBottom: 16, borderRadius: 18 },
  revenueCard: {
    borderRadius: 18,
    padding: 18,
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  revenueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revenueLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  revenueAmount: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  revenueTrend: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600', marginTop: 6 },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  deliveryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryTitle: { fontSize: 15 },
  deliverySub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  extraCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  extraTitle: { fontSize: 14, marginBottom: 10 },
  extraRow: { flexDirection: 'row', gap: 12 },
  extraCell: { flex: 1 },
  extraVal: { fontSize: 20, fontWeight: '800' },
  extraLab: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17 },
  seeAll: { fontSize: 14, fontWeight: '800' },
  emptyBox: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbPh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { fontSize: 16, fontWeight: '800' },
  orderRef: { fontSize: 14 },
  orderPrice: { fontSize: 13, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800' },
});

