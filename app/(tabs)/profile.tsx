import AsyncStorage from '@react-native-async-storage/async-storage';
import { SITE_URL } from '@/lib/config';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Heart,
  HelpCircle,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  Settings,
  Share2,
  ShoppingBag,
  Star,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useLogout } from '@/hooks/use-logout';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { fetchUserAddresses } from '@/lib/addresses';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { fetchAuthMe, peekAuthMe, type AuthMe } from '@/lib/client-data';
import { fetchFavoriteProducts, fetchFavorites, type FavoriteEnterprise } from '@/lib/favorites-api';
import { resolveRemoteImageUrl } from '@/lib/images';
import { isActiveOrderStatus } from '@/lib/order-status';

// ─── Types ────────────────────────────────────────────────────────

type Me = AuthMe;

type OrderSummary = {
  id: string;
  statut: string;
};

type ProfileStats = {
  totalOrders: number;
  activeOrders: number;
  totalFavorites: number;
  totalAddresses: number;
};

// ─── Stat cell (carte 3 colonnes) ────────────────────────────────

function StatCell({
  Icon,
  value,
  label,
  colors,
}: {
  Icon: LucideIcon;
  value: number | string;
  label: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <View style={styles.statCell}>
      <Icon size={19} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Ligne du menu « Mon activité » ───────────────────────────────

function MenuRow({
  Icon,
  title,
  onPress,
  colors,
  pill,
  count,
  danger,
}: {
  Icon: LucideIcon;
  title: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  pill?: string;
  count?: number | string;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        { backgroundColor: colors.surfaceMuted },
        pressed && styles.menuRowPressed,
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}>
      <View
        style={[
          styles.menuIconBox,
          { backgroundColor: danger ? colors.errorSoft : colors.primarySoft },
        ]}>
        <Icon
          size={18}
          color={danger ? colors.error : colors.primaryDeep}
          strokeWidth={LUCIDE_STROKE}
        />
      </View>

      <Text
        style={[
          styles.menuTitle,
          { color: danger ? colors.error : colors.text },
        ]}
        numberOfLines={1}>
        {title}
      </Text>

      {pill ? (
        <View style={[styles.pill, { backgroundColor: colors.primary }]}>
          <Text style={styles.pillText}>{pill}</Text>
        </View>
      ) : count !== undefined ? (
        <Text style={[styles.menuCount, { color: colors.textMuted }]}>{count}</Text>
      ) : null}

      <ChevronRight
        size={17}
        color={colors.textMuted}
        strokeWidth={LUCIDE_STROKE}
      />
    </Pressable>
  );
}

// ─── Main screen ───────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { performLogout } = useLogout({ clearCart: true });
  const { showConfirm, FeedbackOverlay } = useActionFeedback();

  // User profile
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real stats from APIs
  const [stats, setStats] = useState<ProfileStats>({
    totalOrders: 0,
    activeOrders: 0,
    totalFavorites: 0,
    totalAddresses: 0,
  });

  // Bannière « Ajoutez une photo de profil » : une seule fois par utilisateur.
  const [showPhotoBanner, setShowPhotoBanner] = useState(false);

  // ── Load everything in parallel ──────────────────────────────────

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');

      // Show cached profile immediately
      const cached = peekAuthMe(token);
      if (cached) {
        setMe(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      // Fetch profile + orders + favorites (commerces ET produits) + addresses in parallel
      const [profileData, ordersData, favData, favProductsData, addressesData] =
        await Promise.allSettled([
          fetchAuthMe(token, force),
          apiFetch<OrderSummary[]>('/api/orders', { method: 'GET', token }),
          fetchFavorites(token),
          fetchFavoriteProducts(token),
          fetchUserAddresses(token),
        ]);

      // Profile
      if (profileData.status === 'fulfilled') {
        setMe(profileData.value);
      }

      // Orders stats
      let totalOrders = 0;
      let activeOrders = 0;
      if (ordersData.status === 'fulfilled') {
        const orders = Array.isArray(ordersData.value) ? ordersData.value : [];
        totalOrders = orders.length;
        activeOrders = orders.filter((o) => isActiveOrderStatus(o.statut)).length;
      }

      // Favorites stats : commerces + produits (un favori produit doit
      // compter dans le total affiché sur le profil).
      let totalFavorites = 0;
      if (favData.status === 'fulfilled') {
        const items: FavoriteEnterprise[] = favData.value.items ?? [];
        totalFavorites += items.length;
      }
      if (favProductsData.status === 'fulfilled') {
        const items = Array.isArray(favProductsData.value.items)
          ? favProductsData.value.items
          : [];
        totalFavorites += items.length;
      }

      // Addresses stats
      let totalAddresses = 0;
      if (addressesData.status === 'fulfilled') {
        totalAddresses = Array.isArray(addressesData.value)
          ? addressesData.value.length
          : 0;
      }

      setStats({ totalOrders, activeOrders, totalFavorites, totalAddresses });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger le profil.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const avatarUri = resolveRemoteImageUrl(me?.imageUrl ?? me?.image_url);

  // La bannière photo ne s'affiche qu'une seule fois par utilisateur.
  useEffect(() => {
    if (!me?.id) return;
    let alive = true;
    void (async () => {
      try {
        const key = `golivra_profile_banner_seen_v1_${me.id}`;
        const seen = await AsyncStorage.getItem(key);
        if (!alive || seen) return;
        if (!avatarUri) {
          setShowPhotoBanner(true);
          await AsyncStorage.setItem(key, '1');
        }
      } catch {
        /* sans stockage, la bannière s'affichera à nouveau */
      }
    })();
    return () => {
      alive = false;
    };
  }, [me?.id, avatarUri]);

  const memberSince =
    me?.created_at != null || me?.cree_le != null
      ? new Date(
          me.created_at ?? me.cree_le!,
        ).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

  const isDesktop = useIsWebDesktop();
  const bottomPad = isDesktop ? 24 : Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  const ordersPill =
    stats.totalOrders > 0
      ? `${stats.totalOrders} commande${stats.totalOrders > 1 ? 's' : ''}`
      : undefined;

  const openOrders = () => router.navigate('/(tabs)/explore');
  const openFavorites = () => router.navigate('/(tabs)/favorites');
  const openAddresses = () => router.push('/my-addresses');

  const confirmLogout = () => {
    showConfirm({
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      primaryLabel: 'Se déconnecter',
      secondaryLabel: 'Annuler',
      danger: true,
      icon: LogOut,
      onPrimary: () => void performLogout(),
    });
  };

  const APP_STORE_URL = Platform.select({
    ios: 'https://apps.apple.com/app/golivra/id000000000',
    android: 'https://play.google.com/store/apps/details?id=com.golivra.app',
    default: SITE_URL,
  })!;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvrez GoLivra 🚀\nLa meilleure application de livraison et marketplace.\n\nTéléchargez-la ici : ${APP_STORE_URL}`,
        title: 'Partager GoLivra',
      });
    } catch { /* cancelled */ }
  };

  const handleRate = async () => {
    try {
      await Linking.openURL(APP_STORE_URL);
    } catch { /* ignore */ }
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: bottomPad,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
            width: isDesktop ? '100%' : undefined,
          },
        ]}>

        {/* ── Error ──────────────────────────────────────────── */}
        {error ? (
          <View
            style={[
              styles.errorCard,
              { borderColor: colors.errorSoft, backgroundColor: colors.surface },
            ]}>
            <ThemedText style={[styles.errTitle, { color: colors.error }]}>
              {error}
            </ThemedText>
            <Pressable
              style={[styles.retry, { backgroundColor: colors.primary }]}
              onPress={() => void load()}>
              <ThemedText style={[styles.retryText, { color: colors.onPrimary }]}>
                Réessayer
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* ── Loading ─────────────────────────────────────────── */}
        {isLoading && !me ? (
          <View style={[styles.loadingCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.textMuted }]}>
              Chargement du profil…
            </ThemedText>
          </View>
        ) : me ? (
          <>
            {/* ══════════════════════════════════════════════════
                EN-TÊTE : Bonjour, + cloche + réglages
            ══════════════════════════════════════════════════ */}
            <View style={styles.header}>
              <View style={styles.headerTextBlock}>
                <Text style={[styles.greeting, { color: colors.textMuted }]}>
                  Bonjour,
                </Text>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.displayName, { color: colors.text }]}
                    numberOfLines={1}>
                    {me.nom?.trim() || 'Client GoLivra'}
                  </Text>
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  style={[
                    styles.headerBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => router.push('/notifications')}
                  hitSlop={8}>
                  <Bell size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
                  {unreadCount > 0 ? (
                    <View
                      style={[
                        styles.notifDot,
                        { backgroundColor: colors.primary, borderColor: colors.surface },
                      ]}>
                      <Text style={styles.notifDotTxt}>
                        {unreadCount > 9 ? '9+' : String(unreadCount)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  style={[
                    styles.headerBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => router.push('/settings')}
                  hitSlop={8}>
                  <Settings size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              </View>
            </View>

            {/* ══════════════════════════════════════════════════
                BLOC PROFIL : avatar + contact
            ══════════════════════════════════════════════════ */}
            <View style={styles.profileRow}>
              {/* Avatar */}
              <Pressable
                style={styles.avatarContainer}
                onPress={() => router.push('/profile-edit')}>
                <View
                  style={[
                    styles.avatarWrap,
                    { backgroundColor: colors.primarySoft },
                  ]}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImg}
                      contentFit="cover"
                    />
                  ) : (
                    <User
                      size={42}
                      color={colors.primaryDeep}
                      strokeWidth={LUCIDE_STROKE}
                    />
                  )}
                </View>
                {/* Bouton caméra */}
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
                  <Camera size={13} color="#FFFFFF" strokeWidth={2.6} />
                </View>
              </Pressable>

              {/* Contact + bouton éditer */}
              <View style={styles.profileInfo}>
                <View style={styles.infoRow}>
                  <Phone size={15} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
                  <Text style={[styles.infoPhone, { color: colors.text }]} numberOfLines={1}>
                    {me.telephone}
                  </Text>
                </View>

                {memberSince ? (
                  <View style={styles.infoRow}>
                    <CalendarDays
                      size={15}
                      color={colors.primaryDeep}
                      strokeWidth={LUCIDE_STROKE}
                    />
                    <Text
                      style={[styles.infoMember, { color: colors.textMuted }]}
                      numberOfLines={1}>
                      Membre depuis le {memberSince}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.editBtn,
                    { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    pressed && styles.editBtnPressed,
                  ]}
                  onPress={() => router.push('/profile-edit')}>
                  <Pencil size={13} color={colors.primaryDeep} strokeWidth={2.4} />
                  <Text style={[styles.editBtnText, { color: colors.primaryDeep }]}>
                    Modifier le profil
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* ══════════════════════════════════════════════════
                CARTE STATS (3 colonnes)
            ══════════════════════════════════════════════════ */}
            <View
              style={[
                styles.statsCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <StatCell
                Icon={ClipboardList}
                value={stats.totalOrders}
                label="Commandes"
                colors={colors}
              />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <StatCell
                Icon={Heart}
                value={stats.totalFavorites}
                label="Favoris"
                colors={colors}
              />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <StatCell
                Icon={MapPin}
                value={stats.totalAddresses}
                label="Adresses"
                colors={colors}
              />
            </View>

            {/* ══════════════════════════════════════════════════
                BANNIÈRE PHOTO DE PROFIL
            ══════════════════════════════════════════════════ */}
            {showPhotoBanner && !avatarUri ? (
              <Pressable
                style={({ pressed }) => [
                  styles.photoBanner,
                  { backgroundColor: colors.primarySoft },
                  pressed && styles.photoBannerPressed,
                ]}
                onPress={() => router.push('/profile-edit')}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.photoBannerIcon, { backgroundColor: colors.primaryDeep }]}>
                  <Camera size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={styles.photoBannerBody}>
                  <Text style={[styles.photoBannerTitle, { color: colors.primaryDeep }]}>
                    Ajoutez une photo de profil
                  </Text>
                  <Text style={[styles.photoBannerSub, { color: colors.textSecondary }]}>
                    Personnalisez votre compte
                  </Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.primaryDeep}
                  strokeWidth={LUCIDE_STROKE}
                />
              </Pressable>
            ) : null}

            {/* ══════════════════════════════════════════════════
                MON ACTIVITÉ
            ══════════════════════════════════════════════════ */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Mon activité
            </Text>

            <View style={styles.menuList}>
              <MenuRow
                Icon={ShoppingBag}
                title="Mes commandes"
                onPress={openOrders}
                colors={colors}
                pill={ordersPill}
              />
              <MenuRow
                Icon={Heart}
                title="Mes favoris"
                onPress={openFavorites}
                colors={colors}
                count={stats.totalFavorites}
              />
              <MenuRow
                Icon={MapPin}
                title="Mes adresses"
                onPress={openAddresses}
                colors={colors}
                count={stats.totalAddresses}
              />
              <MenuRow
                Icon={Clock}
                title="Commandes en cours"
                onPress={openOrders}
                colors={colors}
                count={stats.activeOrders}
              />
            </View>

            {/* ══════════════════════════════════════════════════
                SUPPORT & AIDE
            ══════════════════════════════════════════════════ */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
              Aide & support
            </Text>

            <View style={styles.menuList}>
              <MenuRow
                Icon={HelpCircle}
                title="Aide & support"
                onPress={() => router.push('/help-support')}
                colors={colors}
              />
              <MenuRow
                Icon={Share2}
                title="Partager GoLivra"
                onPress={handleShare}
                colors={colors}
              />
              <MenuRow
                Icon={Star}
                title="Noter l'application"
                onPress={handleRate}
                colors={colors}
              />
            </View>

            {/* ══════════════════════════════════════════════════
                PARAMÈTRES & COMPTE
            ══════════════════════════════════════════════════ */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
              Paramètres & compte
            </Text>

            <View style={styles.menuList}>
              <MenuRow
                Icon={Settings}
                title="Paramètres"
                onPress={() => router.push('/settings')}
                colors={colors}
              />
              <MenuRow
                Icon={FileText}
                title="Informations légales"
                onPress={() => router.push('/legal-info')}
                colors={colors}
              />
              <MenuRow
                Icon={LogOut}
                title="Se déconnecter"
                onPress={confirmLogout}
                colors={colors}
                danger
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },

  // Error / loading
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  errTitle: { fontWeight: '700', marginBottom: 8 },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
  },
  retryText: { fontWeight: '800', fontSize: 13 },
  loadingCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '600' },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextBlock: { flex: 1, paddingRight: 12 },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 1,
  },
  displayName: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifDotTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Bloc profil ──────────────────────────────────────────────
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoPhone: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  infoMember: {
    fontSize: 12,
    flexShrink: 1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  editBtnPressed: { opacity: 0.8 },
  editBtnText: { fontSize: 12.5, fontWeight: '600' },

  // ── Stats card ───────────────────────────────────────────────
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 6,
    marginBottom: 16,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
  },

  // ── Bannière photo ───────────────────────────────────────────
  photoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 20,
  },
  photoBannerPressed: { opacity: 0.9 },
  photoBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBannerBody: { flex: 1, gap: 2 },
  photoBannerTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  photoBannerSub: {
    fontSize: 12.5,
    lineHeight: 17,
  },

  // ── Mon activité ─────────────────────────────────────────────
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  menuList: {
    gap: 10,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  menuRowPressed: { opacity: 0.82 },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  menuCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
