import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  PackageOpen,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  UtensilsCrossed,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

/** Salutation selon l'heure : « Bonjour » le jour, « Bonsoir » le soir. */
function greetingFr(d = new Date()): string {
  const h = d.getHours();
  return h >= 5 && h < 18 ? 'Bonjour' : 'Bonsoir';
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

/** Point « En ligne » qui pulse doucement (attention visuelle, écran vivant). */
function PulseDot({ color, active }: { color: string; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, active]);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity, transform: [{ scale }] }}
    />
  );
}

/** Apparition en fondu + glissement, décalée par section (stagger). */
function FadeInUp({ index = 0, children }: { index?: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      delay: 70 * index,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

/** Illustration de devanture de commerce (boutique/restaurant) en Vues — halos + auvent + porte. */
function StorefrontArt() {
  return (
    <View style={styles.heroArt} pointerEvents="none">
      <View style={styles.heroArtHalo} />
      <View style={styles.heroArtSun} />
      {/* Auvent rayé vert/blanc */}
      <View style={styles.artAwningRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.artAwningStripe,
              { backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.96)' : '#63B98C' },
            ]}
          />
        ))}
      </View>
      {/* Corps du commerce */}
      <View style={styles.artBody}>
        {/* Fenêtre */}
        <View style={styles.artWindow}>
          <View style={styles.artWindowCrossH} />
          <View style={styles.artWindowCrossV} />
        </View>
        {/* Porte + enseigne OPEN */}
        <View style={styles.artDoor}>
          <View style={styles.artOpenSign}>
            <ThemedText style={styles.artOpenSignText}>OPEN</ThemedText>
          </View>
          <View style={styles.artDoorHandle} />
        </View>
      </View>
      {/* Pot de plante (gauche) */}
      <View style={styles.artLeaves}>
        <View style={[styles.artLeaf, { left: 2 }]} />
        <View style={[styles.artLeaf, { right: 2 }]} />
      </View>
      <View style={styles.artPot} />
    </View>
  );
}

export default function VendorDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { shop, orders } = useVendor();
  const { commerceType, palette } = useVendorTheme();
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
  const isRestaurant = commerceType === 'restaurant';
  const dateLabel = useMemo(() => todayLabelFr(), []);
  const greeting = useMemo(() => greetingFr(), []);

  const counts = useMemo(() => countsFromOrders(orders), [orders]);

  const todayOrders = useMemo(
    () => orders.filter((o) => isSameDay(o.created_at)),
    [orders],
  );
  // Revenus du jour : UNIQUEMENT les commandes payées (paiement_statut ===
  // 'valide') et la part PRODUITS du vendeur (jamais les frais de livraison,
  // qui reviennent au livreur / GoLivra logistique).
  const todayRevenue = useMemo(
    () =>
      todayOrders
        .filter((o) => o.statut !== 'annulee' && o.paiement_statut === 'valide')
        .reduce((acc, o) => acc + (o.sousTotal ?? o.prixTotal), 0),
    [todayOrders],
  );

  const profileIncomplete = !!shop && (!shop.avatar || !shop.description?.trim());
  const recent = orders.slice(0, 4);

  // ── Bannière hero : l'état du commerce en un coup d'œil, avec action ──
  type HeroConfig = {
    Icon: typeof Clock;
    title: string;
    sub: string;
    cta: { label: string; onPress: () => void } | null;
  };
  const hero = useMemo<HeroConfig>(() => {
    const typeRef = isRestaurant ? 'Votre restaurant' : 'Votre boutique';
    if (shop?.statut_moderation === 'en_attente') {
      return {
        Icon: Clock,
        title: 'En attente de validation',
        sub: "L'équipe GoLivra vérifie votre fiche. Vous ne recevez pas encore de commandes.",
        cta: null,
      };
    }
    if (!isOnline) {
      return {
        Icon: Store,
        title: `${typeRef} est hors ligne`,
        sub: 'Votre fiche n’est pas visible par les clients pour le moment.',
        cta: { label: 'Voir ma fiche', onPress: () => router.push(VENDOR_HREF.shopInfo) },
      };
    }
    if (isOnline && !horaires.loaded) {
      return {
        Icon: Clock,
        title: 'Un instant…',
        sub: "Vérification de vos horaires d'ouverture.",
        cta: null,
      };
    }
    if (horaires.loaded && !horaires.hasHours) {
      return {
        Icon: Clock,
        title: `${typeRef} est fermé`,
        sub: 'Définissez vos horaires pour ouvrir vos commandes.',
        cta: { label: 'Voir les horaires', onPress: openHorairesEditor },
      };
    }
    if (horaires.openNow) {
      return {
        Icon: ShoppingBag,
        title: `${typeRef} est ouvert`,
        sub: 'Commandes ouvertes — votre fiche est visible par les clients.',
        cta: { label: 'Voir mes produits', onPress: () => router.push(VENDOR_HREF.productsTab) },
      };
    }
    const nextOpenLine = horaires.nextLabel
      ? horaires.nextLabel.startsWith('aujourd')
        ? `Ouvre ${horaires.nextLabel}`
        : `Réouverture ${horaires.nextLabel}`
      : null;
    return {
      Icon: Store,
      title: `${typeRef} est fermé`,
      sub: nextOpenLine ?? 'Consultez vos horaires pour ajuster votre disponibilité.',
      cta: { label: 'Voir les horaires', onPress: openHorairesEditor },
    };
  }, [shop, isOnline, horaires.loaded, horaires.hasHours, horaires.openNow, horaires.nextLabel, isRestaurant, router, openHorairesEditor]);

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
  // Priorité absolue : les commandes à ACCEPTER (elles expirent en 5 min) —
  // elles sont listées en premier, en rouge, avec leur délai restant.
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
    if (counts.pending > 0) {
      list.push({
        key: 'accept',
        Icon: Clock,
        tone: colors.error,
        soft: colors.errorSoft,
        title: `${counts.pending} commande${counts.pending > 1 ? 's' : ''} à accepter`,
        subtitle: "L'horloge tourne — répondez avant l'expiration (5 min).",
        cta: 'Accepter',
        onPress: () => router.push(VENDOR_HREF.ordersTab),
      });
    }
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
    const prepToDo = counts.prep - counts.pending;
    if (prepToDo > 0) {
      list.push({
        key: 'prep',
        Icon: UtensilsCrossed,
        tone: colors.warning,
        soft: colors.warningSoft,
        title: `${prepToDo} commande${prepToDo > 1 ? 's' : ''} à préparer`,
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
  }, [horaires.loaded, horaires.hasHours, counts.pending, counts.prep, profileIncomplete, colors, router, openHorairesEditor]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── En-tête : salutation + statut + date + notifications ── */}
        <View style={styles.topRow}>
          <View style={[styles.avatar, { shadowColor: GOLIVRA_BRAND_SHADOW }]}>
            {shop?.avatar ? (
              <Image source={{ uri: shop.avatar }} style={styles.avatarImg} contentFit="cover" transition={150} />
            ) : (
              <LinearGradient
                colors={isDark ? [palette.primary, '#0A5C3C'] : [palette.primary, palette.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarFallback}>
                <ThemedText style={styles.avatarLetter}>{shopName.charAt(0).toUpperCase()}</ThemedText>
              </LinearGradient>
            )}
          </View>
          <View style={styles.identity}>
            <ThemedText style={[styles.greetingSmall, { color: colors.textMuted }]}>{greeting}</ThemedText>
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
                <PulseDot color={isOnline ? colors.success : colors.textMuted} active={isOnline} />
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

        {/* ── Bannière hero : état du commerce + action + illustration ── */}
        <FadeInUp index={0}>
          <View style={[styles.hero, { shadowColor: GOLIVRA_BRAND_SHADOW }]}>
            <LinearGradient
              colors={isDark ? ['#0E5C3C', '#0A4630'] : [palette.primary, palette.primaryDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}>
              <StorefrontArt />
              <View style={styles.heroContent}>
              <View style={styles.heroIconWrap}>
                <hero.Icon size={17} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <ThemedText style={styles.heroTitle}>
                {hero.title}
              </ThemedText>
              <ThemedText style={styles.heroSub} numberOfLines={2}>
                {hero.sub}
              </ThemedText>
              {hero.cta ? (
                <Pressable
                  style={({ pressed }) => [styles.heroCta, pressed && styles.pressed]}
                  onPress={hero.cta.onPress}
                  android_ripple={{ color: 'rgba(0,0,0,0.10)' }}>
                  <ThemedText style={styles.heroCtaText}>{hero.cta.label}</ThemedText>
                  <ArrowRight size={15} color="#1A1A1A" strokeWidth={2.6} />
                </Pressable>
              ) : null}
              </View>
            </LinearGradient>
          </View>
        </FadeInUp>

        {/* ── Horaires du jour (carte compacte) ── */}
        <FadeInUp index={1}>
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
              <View style={styles.rowLinkWrap}>
                <ThemedText style={[styles.rowLink, { color: palette.primary }]}>Voir les horaires</ThemedText>
                <ChevronRight size={15} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
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
        </FadeInUp>

        {/* ── Aujourd'hui : 4 cartes (grille 2×2) ── */}
        <FadeInUp index={2}>
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
        </FadeInUp>

        {/* ── À faire : ce qu'il faut faire maintenant ── */}
        <FadeInUp index={3}>
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
                    ? 'Votre commerce est prêt à recevoir des commandes.'
                    : 'Tout est en ordre pour le moment.'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.actionList}>
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
        </FadeInUp>

        {/* ── Livraisons en cours ── */}
        <FadeInUp index={4}>
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
        </FadeInUp>

        {/* ── Commandes récentes (statut en premier) ── */}
        <FadeInUp index={5}>
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
            <View style={styles.recentList}>
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
        </FadeInUp>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 18, gap: 14 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  // En-tête
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
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Bannière hero
  hero: {
    borderRadius: 20,
    minHeight: 132,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  heroGradient: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  heroContent: { flex: 1, padding: 16, paddingRight: 104, gap: 4 },
  heroIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 4,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5A524',
  },
  heroCtaText: { color: '#1A1A1A', fontSize: 12.5, fontWeight: '900' },
  // Illustration devanture (positionnée à droite de la bannière)
  heroArt: {
    position: 'absolute',
    right: 2,
    bottom: -6,
    width: 118,
    height: 102,
  },
  heroArtHalo: {
    position: 'absolute',
    right: -22,
    top: -14,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  heroArtSun: {
    position: 'absolute',
    top: 2,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(245,165,36,0.85)',
  },
  artAwningRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    height: 13,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  artAwningStripe: { flex: 1 },
  artBody: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 60,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  artWindow: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 30,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#BFE8D0',
    borderWidth: 1.5,
    borderColor: '#0B6B45',
    overflow: 'hidden',
  },
  artWindowCrossH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    height: 1.5,
    backgroundColor: '#0B6B45',
  },
  artWindowCrossV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 14,
    width: 1.5,
    backgroundColor: '#0B6B45',
  },
  artDoor: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 30,
    height: 46,
    backgroundColor: '#0C4F36',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    alignItems: 'center',
  },
  artOpenSign: {
    position: 'absolute',
    top: 5,
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: '#F5A524',
  },
  artOpenSignText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', lineHeight: 9 },
  artDoorHandle: {
    position: 'absolute',
    right: 5,
    top: 24,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5A524',
  },
  artLeaves: {
    position: 'absolute',
    left: 2,
    bottom: 18,
    width: 24,
    height: 14,
  },
  artLeaf: {
    position: 'absolute',
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7BC9A0',
  },
  artPot: {
    position: 'absolute',
    left: 4,
    bottom: 8,
    width: 20,
    height: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#F5A524',
  },
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
  rowLinkWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
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
    marginTop: 10,
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
  actionList: { gap: 10, marginTop: 10 },
  recentList: { gap: 10, marginTop: 10 },
  // Commandes récentes
  emptyBox: {
    borderRadius: 18,
    padding: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
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
