import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  BadgeCheck,
  Bookmark,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Heart,
  History,
  MapPin,
  Pencil,
  Smartphone,
  User,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { AppLogoutButton } from '@/components/app-logout-button';
import { getSessionToken } from '@/lib/auth';
import { fetchAuthMe, peekAuthMe, fetchAllEnterprises, type AuthMe } from '@/lib/client-data';
import { fetchFavorites, type FavoriteEnterprise } from '@/lib/favorites-api';
import { fetchUserAddresses } from '@/lib/addresses';
import { apiFetch } from '@/lib/api';
import { resolveRemoteImageUrl } from '@/lib/images';
import { isMerchantRole } from '@/lib/roles';
import { isActiveOrderStatus } from '@/lib/order-status';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useAppColors } from '@/hooks/use-app-colors';

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

// ─── Stat tile ────────────────────────────────────────────────────

function StatTile({
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
    <View style={styles.statTile}>
      <Icon size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Section label ─────────────────────────────────────────────────

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <ThemedText style={[styles.sectionLabel, { color: colors.primaryDeep }]}>
      {label}
    </ThemedText>
  );
}

// ─── Activity Row ─────────────────────────────────────────────────

function ActivityRow({
  Icon,
  title,
  subtitle,
  onPress,
  colors,
  rightBadge,
  rightImages,
  rightExtra,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  rightBadge?: string;
  rightImages?: string[];
  rightExtra?: number; // overflow count for images
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.activityRow,
        { backgroundColor: colors.surface },
        pressed && { backgroundColor: colors.primarySoft },
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}>
      {/* Icon circle */}
      <View
        style={[
          styles.activityIconCircle,
          { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
        ]}>
        <Icon size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <ThemedText
          type="defaultSemiBold"
          style={[styles.activityTitle, { color: colors.text }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.activitySub, { color: colors.textMuted }]}>
          {subtitle}
        </ThemedText>
      </View>

      {/* Right: badge */}
      {rightBadge ? (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
          ]}>
          <Text style={[styles.countBadgeText, { color: colors.primaryDeep }]}>
            {rightBadge}
          </Text>
        </View>
      ) : null}

      {/* Right: images stack */}
      {rightImages && rightImages.length > 0 ? (
        <View style={styles.favImagesStack}>
          {rightImages.slice(0, 2).map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[
                styles.favThumb,
                {
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: 10 - i,
                  borderColor: colors.surface,
                },
              ]}
              contentFit="cover"
            />
          ))}
          {(rightExtra ?? 0) > 0 ? (
            <View
              style={[
                styles.favMoreBubble,
                { backgroundColor: colors.primary, borderColor: colors.surface },
              ]}>
              <Text style={styles.favMoreText}>+{rightExtra}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ChevronRight
        size={18}
        color={colors.textMuted}
        strokeWidth={LUCIDE_STROKE}
        style={{ marginLeft: 4 }}
      />
    </Pressable>
  );
}

// ─── Settings row ─────────────────────────────────────────────────

function SettingsRow({
  Icon,
  title,
  subtitle,
  onPress,
  colors,
  isLast,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  isLast?: boolean;
}) {
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.settingsRow,
          { backgroundColor: colors.surface },
          pressed && { backgroundColor: colors.primarySoft },
        ]}
        onPress={onPress}
        android_ripple={{ color: colors.primaryMuted }}>
        <View
          style={[
            styles.settingsIconCircle,
            { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
          ]}>
          <Icon size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText
            type="defaultSemiBold"
            style={[styles.settingsTitle, { color: colors.text }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.settingsSub, { color: colors.textMuted }]}>
            {subtitle}
          </ThemedText>
        </View>
        <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
      </Pressable>
      {!isLast && (
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      )}
    </>
  );
}

// ─── Main screen ───────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showInfo, FeedbackOverlay } = useActionFeedback();

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

  // Favorite enterprise images for the stack preview
  const [favImages, setFavImages] = useState<string[]>([]);
  const [favTotal, setFavTotal] = useState(0);

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

      // Fetch profile + orders + favorites + addresses in parallel
      const [profileData, ordersData, favData, addressesData, allEnterprises] =
        await Promise.allSettled([
          fetchAuthMe(token, force),
          apiFetch<OrderSummary[]>('/api/orders', { method: 'GET', token }),
          fetchFavorites(token),
          fetchUserAddresses(token),
          fetchAllEnterprises(force),
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

      // Favorites stats + image preview
      let totalFavorites = 0;
      let previewImages: string[] = [];
      if (favData.status === 'fulfilled') {
        const items: FavoriteEnterprise[] = favData.value.items ?? [];
        totalFavorites = items.length;

        // Resolve image URLs using the enterprises list
        const enterpriseList =
          allEnterprises.status === 'fulfilled' ? allEnterprises.value : [];

        const enterpriseMap = new Map(
          enterpriseList.map((e) => [e.id, e.image_url]),
        );

        // Build preview images from favorites (enterprise images)
        previewImages = items
          .map((fav) => {
            const imgUrl = enterpriseMap.get(fav.enterprise_id) ?? null;
            return resolveRemoteImageUrl(imgUrl, { width: 80, height: 80 });
          })
          .filter((u): u is string => u !== null)
          .slice(0, 5); // keep up to 5 for display
      }

      // Addresses stats
      let totalAddresses = 0;
      if (addressesData.status === 'fulfilled') {
        totalAddresses = Array.isArray(addressesData.value)
          ? addressesData.value.length
          : 0;
      }

      setStats({ totalOrders, activeOrders, totalFavorites, totalAddresses });
      setFavImages(previewImages);
      setFavTotal(totalFavorites);
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

  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Active orders badge label
  const ordersBadge =
    stats.activeOrders > 0
      ? `${stats.activeOrders} en cours`
      : stats.totalOrders > 0
        ? `${stats.totalOrders} commande${stats.totalOrders > 1 ? 's' : ''}`
        : null;

  // Addresses badge label
  const addressesBadge =
    stats.totalAddresses > 0
      ? `${stats.totalAddresses} adresse${stats.totalAddresses > 1 ? 's' : ''}`
      : null;

  // Favorites overflow count for image stack
  const favOverflow = favTotal > 2 ? favTotal - 2 : 0;

  // ── Render ─────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingBottom: bottomPad,
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
                PROFILE HERO CARD
            ══════════════════════════════════════════════════ */}
            <View style={styles.profileShell}>
              <LinearGradient
                colors={['#0C4F36', '#1A6B40', '#C8920A'] as unknown as readonly [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileGradient}>

                {/* Compte vérifié badge */}
                <View style={styles.verifiedBadge}>
                  <BadgeCheck size={13} color="#0C4F36" strokeWidth={2.5} />
                  <Text style={styles.verifiedBadgeText}>Compte vérifié</Text>
                </View>

                {/* Row: avatar left, info right */}
                <View style={styles.profileHeroRow}>
                  {/* Avatar */}
                  <View style={styles.avatarContainer}>
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
                          size={36}
                          color={colors.primary}
                          strokeWidth={LUCIDE_STROKE}
                        />
                      )}
                    </View>
                    {/* Gold star badge */}
                    <View style={styles.starBadge}>
                      <Text style={styles.starEmoji}>⭐</Text>
                    </View>
                  </View>

                  {/* Name & info */}
                  <View style={styles.profileInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.displayName} numberOfLines={1}>
                        {me?.nom?.trim() || 'Client GoLivra'}
                      </Text>
                      <BadgeCheck
                        size={18}
                        color="#4FFFB0"
                        strokeWidth={2.5}
                        style={{ marginLeft: 4, marginTop: 2 }}
                      />
                    </View>

                    <View style={styles.phoneRow}>
                      <Smartphone
                        size={13}
                        color="rgba(255,255,255,0.75)"
                        strokeWidth={2}
                      />
                      <Text style={styles.phoneText}>{me?.telephone}</Text>
                    </View>

                    {memberSince ? (
                      <Text style={styles.memberSinceText}>
                        Membre depuis le {memberSince}
                      </Text>
                    ) : null}

                    {/* Edit button */}
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => router.push('/account-settings')}>
                      <Pencil size={13} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.editBtnText}>Modifier le profil</Text>
                    </Pressable>
                  </View>
                </View>
              </LinearGradient>

              {/* ── Stats strip ── */}
              <View
                style={[
                  styles.statsStrip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}>
                <StatTile
                  Icon={ClipboardList}
                  value={stats.totalOrders}
                  label={'Commandes\npassées'}
                  colors={colors}
                />
                <View
                  style={[styles.statDivider, { backgroundColor: colors.border }]}
                />
                <StatTile
                  Icon={Heart}
                  value={stats.totalFavorites}
                  label={'Favoris\nenregistrés'}
                  colors={colors}
                />
                <View
                  style={[styles.statDivider, { backgroundColor: colors.border }]}
                />
                <StatTile
                  Icon={MapPin}
                  value={stats.totalAddresses}
                  label={'Adresses\nenregistrées'}
                  colors={colors}
                />
                <View
                  style={[styles.statDivider, { backgroundColor: colors.border }]}
                />
                <StatTile
                  Icon={Bookmark}
                  value={
                    stats.activeOrders > 0 ? stats.activeOrders : '—'
                  }
                  label={'Commandes\nen cours'}
                  colors={colors}
                />
              </View>
            </View>

            {/* Merchant space if applicable */}
            {me && isMerchantRole(me.role) ? (
              <>
                <SectionLabel label="MON COMMERCE" colors={colors} />
                <View
                  style={[
                    styles.menuCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                  <SettingsRow
                    Icon={ClipboardList}
                    title={me.role === 'restaurateur' ? 'Espace restaurant' : 'Espace boutique'}
                    subtitle={
                      me.role === 'restaurateur'
                        ? 'Menu, commandes, livraisons'
                        : 'Catalogue, commandes, livraisons'
                    }
                    onPress={() => router.push('/vendor')}
                    colors={colors}
                    isLast
                  />
                </View>
              </>
            ) : null}

            {/* ══════════════════════════════════════════════════
                MON ACTIVITÉ
            ══════════════════════════════════════════════════ */}
            <SectionLabel label="MON ACTIVITÉ" colors={colors} />

            <View
              style={[
                styles.menuCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              {/* Commandes */}
              <ActivityRow
                Icon={ClipboardList}
                title="Commandes"
                subtitle="Suivi, historique et avis"
                onPress={() => router.push('/(tabs)/explore')}
                colors={colors}
                rightBadge={ordersBadge ?? undefined}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Favoris avec vraies images */}
              <ActivityRow
                Icon={Heart}
                title="Favoris"
                subtitle="Restaurants, boutiques et produits"
                onPress={() => router.push('/(tabs)/favorites')}
                colors={colors}
                rightImages={favImages.length > 0 ? favImages : undefined}
                rightExtra={favOverflow}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Adresses */}
              <ActivityRow
                Icon={MapPin}
                title="Adresses de livraison"
                subtitle="Gérer vos lieux de livraison"
                onPress={() => router.push('/my-addresses')}
                colors={colors}
                rightBadge={addressesBadge ?? undefined}
              />
            </View>

            {/* ══════════════════════════════════════════════════
                PARAMÈTRES DU COMPTE
            ══════════════════════════════════════════════════ */}
            <SectionLabel label="PARAMÈTRES DU COMPTE" colors={colors} />

            <View
              style={[
                styles.menuCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <SettingsRow
                Icon={CreditCard}
                title="Paiements"
                subtitle="Méthodes de paiement et sécurité"
                onPress={() => router.push('/payment-methods')}
                colors={colors}
              />
              <SettingsRow
                Icon={History}
                title="Historique des paiements"
                subtitle="Toutes vos transactions"
                onPress={() =>
                  showInfo(
                    'Historique',
                    "L'historique des paiements sera disponible prochainement.",
                  )
                }
                colors={colors}
                isLast
              />
            </View>

            {/* ── Déconnexion ────────────────────────────────────── */}
            <View style={styles.logoutWrapper}>
              <AppLogoutButton variant="ghost" clearCart />
            </View>

            <ThemedText style={[styles.versionLine, { color: colors.textMuted }]}>
              GoLivra · version {appVersion}
            </ThemedText>
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

  // Error
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

  // Loading
  loadingCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '600' },

  // ── Profile hero card ──────────────────────────────────────────
  profileShell: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  profileGradient: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },

  // Compte vérifié badge
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#4FFFB0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifiedBadgeText: {
    color: '#0C4F36',
    fontSize: 12,
    fontWeight: '800',
  },

  // Hero row: avatar + info
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  starBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5A524',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  starEmoji: { fontSize: 12 },

  // Profile info (right column)
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  displayName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    flexShrink: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  phoneText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  memberSinceText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.7,
  },

  // Menu card
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Activity row
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  activityIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  activityTitle: { fontSize: 15 },
  activitySub: { fontSize: 12, marginTop: 2 },

  // Count badge
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Favorites image stack
  favImagesStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  favMoreBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    borderWidth: 2,
    zIndex: 0,
  },
  favMoreText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Settings row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  settingsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  settingsTitle: { fontSize: 15 },
  settingsSub: { fontSize: 12, marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },

  // Logout
  logoutWrapper: { marginTop: 16, marginBottom: 8 },
  versionLine: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
});
