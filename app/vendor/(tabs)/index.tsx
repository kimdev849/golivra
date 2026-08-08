import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  PackageOpen,
  Store,
  TrendingUp,
  Truck,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
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
import { useVendorHoraires } from '@/hooks/use-vendor-horaires';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { formatTimeFr } from '@/lib/datetime';
import { formatFcfa } from '@/lib/format';
import { VENDOR_HREF, hrefVendorOrder } from '@/lib/vendor-nav';
import type { VendorOrderStatus } from '@/lib/vendor-types';
import { countsFromOrders } from '@/lib/vendor-types';
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
  const { palette } = useVendorTheme();
  const { unreadCount } = useUnreadNotifications();
  const isDark = useColorScheme() === 'dark';
  const bottom = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  const horaires = useVendorHoraires(shop?.id);
  const openHorairesEditor = useCallback(
    () => router.push({ pathname: '/vendor/horaires', params: shop?.id ? { id: shop.id } : {} }),
    [router, shop?.id],
  );

  const shopName = shop?.nom || 'Mon commerce';
  const isOnline = shop?.enLigne === true;
  const dateLabel = useMemo(() => todayLabelFr(), []);

  const counts = useMemo(() => countsFromOrders(orders), [orders]);

  const todayOrders = useMemo(
    () => orders.filter((o) => isSameDay(o.created_at)),
    [orders],
  );
  const todayRevenue = useMemo(
    () =>
      todayOrders.filter((o) => o.statut !== 'annulee').reduce((acc, o) => acc + o.prixTotal, 0),
    [todayOrders],
  );

  const profileIncomplete = !!shop && (!shop.avatar || !shop.description?.trim());
  const recent = orders.slice(0, 4);

  // ── Bannière de réassurance : la boutique est-elle ouverte ? ──
  const reassurance = (() => {
    if (shop?.statut_moderation === 'en_attente') {
      return {
        tone: colors.warning,
        bg: colors.warningSoft,
        text: 'Votre commerce est en attente de validation par l’équipe GoLivra.',
      };
    }
    if (!isOnline) {
      return { tone: colors.textMuted, bg: colors.surfaceMuted, text: 'Votre boutique est hors ligne.' };
    }
    if (horaires.openNow) {
      return {
        tone: colors.success,
        bg: colors.successSoft,
        text: 'Votre boutique est ouverte et visible par les clients.',
      };
    }
    return {
      tone: colors.warning,
      bg: colors.warningSoft,
      text: `Votre boutique est fermée pour le moment${horaires.nextLabel ? ` · rouvre ${horaires.nextLabel}` : ''}.`,
    };
  })();

  // ── « Aujourd'hui » : les 4 chiffres que le commerçant regarde en premier ──
  const todayStats = useMemo(
    () => [
      {
        key: 'revenue',
        label: 'Revenus',
        value: formatFcfa(todayRevenue),
        Icon: TrendingUp,
        onPress: () => router.push(VENDOR_HREF.statistics),
      },
      {
        key: 'orders',
        label: 'Commandes',
        value: String(todayOrders.length),
        Icon: ClipboardList,
        onPress: () => router.push(VENDOR_HREF.ordersTab),
      },
      {
        key: 'prep',
        label: 'À préparer',
        value: String(counts.prep),
        Icon: UtensilsCrossed,
        onPress: () => router.push(VENDOR_HREF.ordersTab),
      },
      {
        key: 'ship',
        label: 'En livraison',
        value: String(counts.ship),
        Icon: Truck,
        onPress: () => router.push(VENDOR_HREF.deliveriesTab),
      },
    ],
    [todayRevenue, todayOrders.length, counts.prep, counts.ship, router],
  );

  // ── « À faire » : la réponse à « qu'est-ce que je dois faire maintenant ? » ──
  const actions = useMemo(() => {
    const list: {
      key: string;
      Icon: typeof Clock;
      tone: string;
      soft: string;
      title: string;
      subtitle: string;
      cta: string;
      onPress: () => void;
    }[] = [];
    if (horaires.loaded && !horaires.hasHours) {
      list.push({
        key: 'horaires',
        Icon: Clock,
        tone: colors.error,
        soft: colors.errorSoft,
        title: 'Définir vos horaires d’ouverture',
        subtitle: 'Vous ne recevez aucune commande sans horaires.',
        cta: 'Définir',
        onPress: openHorairesEditor,
      });
    }
    if (counts.prep > 0) {
      list.push({
        key: 'prep',
        Icon: UtensilsCrossed,
        tone: colors.warning,
        soft: colors.warningSoft,
        title: `${counts.prep} commande${counts.prep > 1 ? 's' : ''} à préparer`,
        subtitle: 'Vos clients attendent leur commande.',
        cta: 'Préparer',
        onPress: () => router.push(VENDOR_HREF.ordersTab),
      });
    }
    if (profileIncomplete) {
      list.push({
        key: 'profile',
        Icon: Store,
        tone: colors.primary,
        soft: colors.primarySoft,
        title: 'Compléter votre fiche',
        subtitle: 'Ajoutez un logo et une description pour attirer plus de clients.',
        cta: 'Compléter',
        onPress: () => router.push(VENDOR_HREF.shopInfo),
      });
    }
    return list;
  }, [horaires.loaded, horaires.hasHours, counts.prep, profileIncomplete, colors, router, openHorairesEditor]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── En-tête : bonjour + statut + date + notifications ── */}
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
              <View
                style={[
                  styles.onlineBadge,
                  {
                    backgroundColor: isOnline ? colors.successSoft : colors.surfaceMuted,
                    borderColor: isOnline ? colors.success : colors.border,
                  },
                ]}>
                <View
                  style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]}
                />
                <ThemedText
                  style={[
                    styles.onlineText,
                    { color: isOnline ? colors.success : colors.textMuted },
                  ]}>
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </ThemedText>
              </View>
              <ThemedText style={[styles.dateText, { color: colors.textMuted }]}>{dateLabel}</ThemedText>
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

        {/* ── Réassurance : « la boutique est ouverte » ── */}
        <View style={[styles.reassurance, { backgroundColor: reassurance.bg }]}>
          <View style={[styles.reassuranceDot, { backgroundColor: reassurance.tone }]} />
          <ThemedText style={[styles.reassuranceText, { color: reassurance.tone }]}>
            {reassurance.text}
          </ThemedText>
        </View>

        {/* ── Horaires du jour (compact) ── */}
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
              <ThemedText style={[styles.rowSub, { color: colors.textMuted }]}>
                Aujourd&apos;hui uniquement
              </ThemedText>
            </View>
            <ThemedText style={[styles.rowLink, { color: palette.primary }]}>Voir les horaires</ThemedText>
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

        {/* ── Aujourd'hui : 4 cartes (grille 2×2) ── */}
        <View style={styles.sectionHead}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Aujourd&apos;hui</ThemedText>
          <Pressable onPress={() => router.push(VENDOR_HREF.statistics)} hitSlop={8}>
            <ThemedText style={[styles.seeAll, { color: colors.primary }]}>Voir les statistiques →</ThemedText>
          </Pressable>
        </View>
        <View style={styles.statsGrid}>
          {todayStats.map((s) => (
            <Pressable
              key={s.key}
              style={({ pressed }) => [
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              onPress={s.onPress}
              android_ripple={{ color: colors.primaryMuted }}>
              <View style={[styles.statIconWrap, { backgroundColor: palette.primarySoft }]}>
                <s.Icon size={17} color={palette.primary} strokeWidth={2.2} />
              </View>
              <ThemedText style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                {s.value}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</ThemedText>
            </Pressable>
          ))}
        </View>

        {/* ── À faire : ce qu'il faut faire maintenant ── */}
        <View style={styles.sectionHead}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>À faire</ThemedText>
        </View>
        {actions.length === 0 ? (
          <View style={[styles.emptyAction, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <CheckCircle2 size={20} color={colors.success} strokeWidth={LUCIDE_STROKE} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.emptyActionTitle, { color: colors.success }]}>
                Aucune action en attente
              </ThemedText>
              <ThemedText style={[styles.emptyActionSub, { color: colors.textSecondary }]}>
                {isOnline && horaires.openNow
                  ? 'Votre boutique est prête à recevoir des commandes.'
                  : 'Tout est en ordre pour le moment.'}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
                onPress={a.onPress}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.actionIcon, { backgroundColor: a.soft }]}>
                  <a.Icon size={19} color={a.tone} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.actionTitle, { color: colors.text }]}>{a.title}</ThemedText>
                  <ThemedText style={[styles.actionSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {a.subtitle}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.actionCta, { color: a.tone }]}>{a.cta}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Livraisons en cours ── */}
        <Pressable
          style={({ pressed }) => [styles.rowCard, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}
          onPress={() => router.push(VENDOR_HREF.deliveriesTab)}>
          <View style={[styles.rowIcon, { backgroundColor: palette.primarySoft }]}>
            <Truck size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.rowTitle, { color: colors.text }]}>Livraisons</ThemedText>
            <ThemedText style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
              {counts.ship === 0
                ? 'Aucune livraison en cours.'
                : `${counts.ship} livraison${counts.ship > 1 ? 's' : ''} en cours.`}
            </ThemedText>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>

        {/* ── Commandes récentes (statut en premier) ── */}
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
                  <View style={{ flex: 1, gap: 3 }}>
                    {/* Le statut est ce qu'on voit en premier */}
                    <View style={styles.orderTop}>
                      <View style={[styles.pill, { backgroundColor: st.bg }]}>
                        <View style={[styles.pillDot, { backgroundColor: st.text }]} />
                        <ThemedText style={[styles.pillText, { color: st.text }]}>
                          {statusLabel(o.statut)}
                        </ThemedText>
                      </View>
                      {o.created_at ? (
                        <ThemedText style={[styles.orderTime, { color: colors.textMuted }]}>
                          {formatTimeFr(o.created_at)}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={[styles.orderRef, { color: colors.text }]} numberOfLines={1}>
                      #{o.ref} · {o.clientNom}
                    </ThemedText>
                    <ThemedText style={[styles.orderPrice, { color: colors.text }]}>
                      {formatFcfa(o.prixTotal)}
                    </ThemedText>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
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
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5 },
  onlineText: { fontSize: 11.5, fontWeight: '800' },
  dateText: { fontSize: 12, fontWeight: '600' },
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
  // Réassurance
  reassurance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
  },
  reassuranceDot: { width: 9, height: 9, borderRadius: 4.5 },
  reassuranceText: { flex: 1, fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  // Ligne compacte (horaires, livraisons)
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
  rowLink: { fontSize: 12, fontWeight: '800' },
  rowCta: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  rowCtaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  // Grille « Aujourd'hui »
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  seeAll: { fontSize: 12.5, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 3,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  statLabel: { fontSize: 11.5, fontWeight: '700', opacity: 0.85 },
  // À faire
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyActionTitle: { fontSize: 13.5, fontWeight: '800' },
  emptyActionSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 1 },
  actionSub: { fontSize: 12, fontWeight: '500', opacity: 0.85 },
  actionCta: { fontSize: 12.5, fontWeight: '800' },
  // Commandes récentes
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
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  orderTime: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  orderRef: { fontSize: 13.5, fontWeight: '800' },
  orderPrice: { fontSize: 14, fontWeight: '900' },
});
