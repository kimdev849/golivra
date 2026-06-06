import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronRight, Truck, TrendingUp, Package, CheckCircle2, Clock } from 'lucide-react-native';
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
  const { shop, orders } = useVendor();
  const { palette, labels } = useVendorTheme();
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
          <LinearGradient 
            colors={[...palette.gradient]} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={[styles.revenueCard, { shadowColor: palette.primary }]}>
            <View style={styles.revenueTop}>
              <View style={styles.revenueIconWrap}>
                <TrendingUp size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={styles.revenueLabel}>{labels.dashboardRevenueLabel}</ThemedText>
              <ChevronRight size={22} color="rgba(255,255,255,0.8)" style={{ marginLeft: 'auto' }} />
            </View>
            <ThemedText style={styles.revenueAmount}>{formatFcfa(todayRevenue)}</ThemedText>
            <View style={styles.revenueBottom}>
              <ThemedText style={styles.revenueTrend}>
                {orders.length === 0 ? 'Aucune commande' : `${orders.length} commande(s) au total`}
              </ThemedText>
              <View style={styles.revenueGlow} />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.statsRow}>
          {labels.dashboardStatCards.map((c, i) => {
            const Icon = i === 0 ? Package : i === 1 ? Clock : CheckCircle2;
            return (
              <View key={c.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.statIconWrap, { backgroundColor: colors.primarySoft }]}>
                  <Icon size={16} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <ThemedText style={[styles.statValue, { color: colors.text }]}>{c.value}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{c.label}</ThemedText>
              </View>
            );
          })}
        </View>

        <Pressable
          style={[styles.deliveryCard, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}
          onPress={() => router.push(VENDOR_HREF.deliveriesTab)}>
          <View style={[styles.deliveryIcon, { backgroundColor: palette.primary }]}>
            <Truck size={22} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.deliveryTitle, { color: palette.primaryDeep }]}>
              Livraisons en cours
            </ThemedText>
            <ThemedText style={[styles.deliverySub, { color: colors.textMuted }]} numberOfLines={2}>
              Suivez vos expéditions et vos livreurs en temps réel.
            </ThemedText>
          </View>
          <ChevronRight size={20} color={palette.primary} />
        </Pressable>

        {labels.dashboardExtra ? (
          <View style={[styles.extraCard, { borderColor: palette.trackStroke, backgroundColor: colors.surfaceMuted }]}>
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
          <Pressable onPress={() => router.push(VENDOR_HREF.ordersTab)} hitSlop={8}>
            <ThemedText style={[styles.seeAll, { color: colors.primary }]}>Tout voir</ThemedText>
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
                    <View style={styles.orderRefRow}>
                      <ThemedText type="defaultSemiBold" style={[styles.orderRef, { color: colors.text }]}>
                        #{o.ref}
                      </ThemedText>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <ThemedText style={[styles.pillText, { color: st.text }]}>{statusLabel(o.statut)}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.orderPrice, { color: colors.textMuted }]}>
                      {o.clientNom} • {formatFcfa(o.prixTotal)}
                    </ThemedText>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
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
  scroll: { paddingHorizontal: 18, gap: 16 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greeting: { flex: 1, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    borderWidth: 2,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 12, fontWeight: '800' },
  revenuePress: { marginBottom: 4 },
  revenueCard: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  revenueTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  revenueIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },
  revenueAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginBottom: 6 },
  revenueBottom: { position: 'relative' },
  revenueTrend: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  revenueGlow: {
    position: 'absolute',
    right: -60,
    bottom: -60,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deliveryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  deliverySub: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  extraCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  extraTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  extraRow: { flexDirection: 'row', gap: 12 },
  extraCell: { flex: 1 },
  extraVal: { fontSize: 16, fontWeight: '900' },
  extraLab: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', opacity: 0.7 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  seeAll: { fontSize: 14, fontWeight: '800' },
  emptyBox: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 18, opacity: 0.7 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  thumbPh: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { fontSize: 18, fontWeight: '900' },
  orderRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  orderRef: { fontSize: 15, fontWeight: '800' },
  orderPrice: { fontSize: 13, fontWeight: '500' },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});

