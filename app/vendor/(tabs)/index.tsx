import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronRight, Truck, TrendingUp, Clock, Store, PackageOpen } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { VENDOR_TAB_BAR_PADDING_BOTTOM } from '@/constants/vendor-layout';
import { useVendor } from '@/contexts/vendor-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useVendorHoraires } from '@/hooks/use-vendor-horaires';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { formatTimeFr } from '@/lib/datetime';
import { formatFcfa } from '@/lib/format';
import { VENDOR_HREF, hrefVendorOrder } from '@/lib/vendor-nav';
import type { VendorOrderStatus } from '@/lib/vendor-types';
import { vendorOrderStatusLabel as statusLabel } from '@/lib/ux-copy';

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Date du jour en français, sans dépendre d'Intl (ex. « mercredi 6 août »). */
function todayLabelFr(d = new Date()): string {
  return `${WEEKDAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function isSameDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function statusStyle(s: VendorOrderStatus, colors: ReturnType<typeof useAppColors>): { bg: string; text: string } {
  switch (s) {
    case 'en_attente':
    case 'en_preparation':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'acceptee':
    case 'a_preparer':
    case 'prete':
    case 'livree':
      return { bg: colors.successSoft, text: colors.success };
    case 'en_livraison':
      return { bg: colors.primarySoft, text: colors.primary };
    case 'annulee':
      return { bg: colors.errorSoft, text: colors.error };
    default:
      return { bg: colors.surfaceMuted, text: colors.textMuted };
  }
}

export default function VendorDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { shop, orders } = useVendor();
  const { palette, labels } = useVendorTheme();
  const { unreadCount } = useUnreadNotifications();
  const isDark = useColorScheme() === 'dark';
  const bottom = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  const horaires = useVendorHoraires(shop?.id);
  const openHorairesEditor = () =>
    router.push({ pathname: '/vendor/horaires', params: shop?.id ? { id: shop.id } : {} });

  const shopName = shop?.nom || 'Mon commerce';
  const isOnline = shop?.enLigne === true;
  const dateLabel = useMemo(() => todayLabelFr(), []);

  const todayOrders = useMemo(
    () => orders.filter((o) => isSameDay(o.created_at)),
    [orders],
  );
  const todayRevenue = useMemo(
    () =>
      todayOrders.filter((o) => o.statut !== 'annulee').reduce((acc, o) => acc + o.prixTotal, 0),
    [todayOrders],
  );

  // Statistiques réelles — jamais de repli vers les valeurs factices du thème.
  const statValues = useMemo(() => {
    const count = (s: VendorOrderStatus) => orders.filter((o) => o.statut === s).length;
    const byLabel: Record<string, string> = {
      Commandes: String(orders.length),
      'En préparation': String(count('en_preparation')),
      'Prêtes': String(count('prete')),
      'En livraison': String(count('en_livraison')),
    };
    return labels.dashboardStatCards.map((c) => byLabel[c.label] ?? String(orders.length));
  }, [labels, orders]);

  const recent = orders.slice(0, 4);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── En-tête : identité + notification ── */}
        <View style={styles.topRow}>
          <LinearGradient
            colors={isDark ? [palette.primary, '#0A5C3C'] : [palette.primary, palette.primaryDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.avatar, { shadowColor: GOLIVRA_BRAND_SHADOW }]}>
            <ThemedText style={styles.avatarLetter}>{shopName.charAt(0).toUpperCase()}</ThemedText>
          </LinearGradient>
          <View style={styles.identity}>
            <ThemedText style={[styles.greetingSmall, { color: colors.textMuted }]}>Bonjour 👋</ThemedText>
            <ThemedText style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
              {shopName}
            </ThemedText>
            <View style={styles.statusLine}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
              <ThemedText style={[styles.statusText, { color: isOnline ? colors.success : colors.textMuted }]}>
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </ThemedText>
              <ThemedText style={[styles.statusDate, { color: colors.textMuted }]}>· {dateLabel}</ThemedText>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.notifBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            onPress={() => router.push(VENDOR_HREF.notifications)}
            hitSlop={10}>
            <Bell size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            {unreadCount > 0 ? (
              <View style={[styles.notifBadge, { backgroundColor: colors.error, borderColor: colors.surface }]}>
                <ThemedText style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ── Horaires d'ouverture : statut discret mais impossible à rater ── */}
        {horaires.loading ? (
          <View style={[styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Clock size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.rowTitle, { color: colors.text }]}>Horaires d&apos;ouverture</ThemedText>
              <ThemedText style={[styles.rowSub, { color: colors.textMuted }]}>Chargement…</ThemedText>
            </View>
          </View>
        ) : horaires.hasHours ? (
          <Pressable
            style={({ pressed }) => [styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
            onPress={openHorairesEditor}>
            <View style={[styles.rowIcon, { backgroundColor: horaires.openNow ? colors.successSoft : colors.warningSoft }]}>
              <Clock size={18} color={horaires.openNow ? colors.success : colors.warning} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.rowTitle, { color: horaires.openNow ? colors.success : colors.warning }]}>
                {horaires.openNow
                  ? `Ouvert aujourd'hui${horaires.todayHours ? ` · ${horaires.todayHours}` : ''}`
                  : horaires.nextLabel
                    ? horaires.nextLabel.startsWith('aujourd')
                      ? `Fermé pour le moment · ouvre ${horaires.nextLabel}`
                      : `Fermé aujourd'hui · réouverture ${horaires.nextLabel}`
                    : "Fermé aujourd'hui"}
              </ThemedText>
              <ThemedText style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                {horaires.summary}
              </ThemedText>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.rowCard, { borderColor: colors.error, backgroundColor: colors.errorSoft }, pressed && styles.pressed]}
            onPress={openHorairesEditor}>
            <View style={[styles.rowIcon, { backgroundColor: colors.error }]}>
              <Clock size={18} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.rowTitle, { color: colors.error }]}>Horaires à définir</ThemedText>
              <ThemedText style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                Vous ne recevez aucune commande sans horaires.
              </ThemedText>
            </View>
            <View style={[styles.rowCta, { backgroundColor: colors.error }]}>
              <ThemedText style={styles.rowCtaText}>Définir</ThemedText>
            </View>
          </Pressable>
        )}

        {/* ── Rappel : fiche commerce incomplète ── */}
        {shop && (!shop.avatar || !shop.description?.trim()) ? (
          <ProfileCompletionBanner
            title="Complétez votre fiche"
            subtitle="Ajoutez un logo et une description pour attirer plus de clients."
            actionLabel="Compléter ma fiche"
            onPress={() => router.push(VENDOR_HREF.shopInfo)}
            colors={colors}
            Icon={Store}
            marginBottom={0}
          />
        ) : null}

        {/* ── Héros : chiffre du jour ── */}
        <Pressable
          style={({ pressed }) => [pressed && styles.pressed]}
          onPress={() => router.push(VENDOR_HREF.statistics)}>
          <LinearGradient
            colors={[...palette.gradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.revenueCard, { shadowColor: palette.primary }]}>
            <View style={styles.revenueTop}>
              <View style={styles.revenueIconWrap}>
                <TrendingUp size={18} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <ThemedText style={styles.revenueLabel}>{labels.dashboardRevenueLabel}</ThemedText>
              <ChevronRight size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
            </View>
            <ThemedText style={styles.revenueAmount}>{formatFcfa(todayRevenue)}</ThemedText>
            <ThemedText style={styles.revenueSub}>
              {todayOrders.length === 0
                ? 'Aucune commande aujourd’hui'
                : `${todayOrders.length} commande${todayOrders.length > 1 ? 's' : ''} aujourd’hui`}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {/* ── Statistiques en direct (une seule carte, colonnes) ── */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {labels.dashboardStatCards.map((c, i) => (
            <View key={c.label} style={[styles.statCell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{statValues[i]}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{c.label}</ThemedText>
            </View>
          ))}
        </View>

        {/* ── Livraisons en cours : accès rapide ── */}
        <Pressable
          style={({ pressed }) => [styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
          onPress={() => router.push(VENDOR_HREF.deliveriesTab)}>
          <View style={[styles.rowIcon, { backgroundColor: palette.primarySoft }]}>
            <Truck size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.rowTitle, { color: colors.text }]}>Livraisons en cours</ThemedText>
            <ThemedText style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
              Suivez vos expéditions et vos livreurs en temps réel.
            </ThemedText>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── Commandes récentes ── */}
        <View style={styles.sectionHead}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Commandes récentes</ThemedText>
          <Pressable onPress={() => router.push(VENDOR_HREF.ordersTab)} hitSlop={8}>
            <ThemedText style={[styles.seeAll, { color: colors.primary }]}>Tout voir</ThemedText>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
              <PackageOpen size={24} color={palette.primary} strokeWidth={1.8} />
            </View>
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
                  style={({ pressed }) => [styles.orderRow, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
                  onPress={() => router.push(hrefVendorOrder(o.id))}
                  android_ripple={{ color: colors.primarySoft }}>
                  <View style={[styles.thumbPh, { backgroundColor: colors.primarySoft }]}>
                    <ThemedText style={[styles.thumbLetter, { color: palette.primary }]}>
                      {o.clientNom.charAt(0)}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.orderRefRow}>
                      <ThemedText style={[styles.orderRef, { color: colors.text }]}>#{o.ref}</ThemedText>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <ThemedText style={[styles.pillText, { color: st.text }]}>
                          {statusLabel(o.statut)}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.orderPrice, { color: colors.textMuted }]}>
                      {o.clientNom} • {formatFcfa(o.prixTotal)}
                    </ThemedText>
                  </View>
                  <View style={styles.orderRight}>
                    {o.created_at ? (
                      <ThemedText style={[styles.orderTime, { color: colors.textMuted }]}>{formatTimeFr(o.created_at)}</ThemedText>
                    ) : null}
                    <ChevronRight size={16} color={colors.textMuted} />
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
  scroll: { paddingHorizontal: 18, gap: 14 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  identity: { flex: 1, gap: 1 },
  greetingSmall: { fontSize: 12, fontWeight: '700' },
  greeting: { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '800' },
  statusDate: { fontSize: 12, fontWeight: '500' },
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
  notifBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  // Ligne compacte (horaires, livraisons, accès rapides)
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 1 },
  rowSub: { fontSize: 12, fontWeight: '500', opacity: 0.9 },
  rowCta: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  rowCtaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  // Héros revenus
  revenueCard: {
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  revenueTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  revenueIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  revenueAmount: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  revenueSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  // Statistiques
  statsCard: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  statValue: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Commandes récentes
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  seeAll: { fontSize: 13, fontWeight: '800' },
  emptyBox: {
    borderRadius: 18,
    padding: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyText: { fontSize: 14, fontWeight: '700' },
  emptyHint: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, opacity: 0.7 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  thumbPh: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { fontSize: 17, fontWeight: '900' },
  orderRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  orderRef: { fontSize: 14.5, fontWeight: '800' },
  orderPrice: { fontSize: 12.5, fontWeight: '500' },
  orderRight: { alignItems: 'flex-end', gap: 8 },
  orderTime: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
