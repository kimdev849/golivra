import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bell,
  Heart,
  MoreHorizontal,
  Search,
  ShoppingBag,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  User,
  UtensilsCrossed,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeActiveOrderWidget } from '@/components/home-active-order-widget';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useAppColors } from '@/hooks/use-app-colors';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { getSessionToken } from '@/lib/auth';
import { fetchAllEnterprises, fetchAuthMe, peekAllEnterprises } from '@/lib/client-data';
import { getFavoriteEnterpriseIds, toggleFavoriteEnterpriseId } from '@/lib/favorites';
import { resolveRemoteImageUrl } from '@/lib/images';
import {
  DEFAULT_PUBLIC_PRICING,
  displayDeliveryFeeFcfa,
  fetchPublicPricing,
  type PublicPricing,
} from '@/lib/pricing';
import { formatFcfa } from '@/lib/format';

type Enterprise = {
  id: string;
  nom: string | null;
  type: 'restaurant' | 'boutique';
  adresse: string | null;
  description?: string | null;
  image_url?: string | null;
  frais_livraison?: number | null;
};

type Me = {
  id: string;
  nom: string | null;
  telephone: string;
  image_url?: string | null;
  imageUrl?: string | null;
};

const CATEGORY_ITEMS: { key: string; label: string; Icon: LucideIcon; type: 'restaurant' | 'boutique' | 'all' }[] = [
  { key: 'restaurant', label: 'Restaurants', Icon: UtensilsCrossed, type: 'restaurant' },
  { key: 'boutique', label: 'Boutiques', Icon: ShoppingBag, type: 'boutique' },
  { key: 'supermarches', label: 'Supermarchés', Icon: ShoppingBasket, type: 'all' },
  { key: 'autres', label: 'Autres', Icon: MoreHorizontal, type: 'all' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { heroOrder, isLoading: loadingOrders, refetch: refetchOrders } = useActiveOrders();

  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  const [search, setSearch] = useState('');
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loadingEnterprises, setLoadingEnterprises] = useState(true);
  const [enterpriseError, setEnterpriseError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (force = false) => {
    setEnterpriseError(null);

    const cachedEnt = peekAllEnterprises();
    if (cachedEnt?.length) {
      setEnterprises(cachedEnt as Enterprise[]);
      setLoadingEnterprises(false);
    } else {
      setLoadingEnterprises(true);
    }

    const favTask = getFavoriteEnterpriseIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => setFavoriteIds(new Set()));

    const entTask = fetchAllEnterprises(force)
      .then((data) => setEnterprises(data as Enterprise[]))
      .catch((e) => {
        setEnterpriseError(e instanceof Error ? e.message : 'Erreur réseau');
        if (!cachedEnt?.length) setEnterprises([]);
      })
      .finally(() => setLoadingEnterprises(false));

    const token = await getSessionToken();
    const meTask =
      token != null
        ? fetchAuthMe(token, force)
            .then(setMe)
            .catch(() => setMe(null))
        : Promise.resolve().then(() => setMe(null));
    const pricingTask = fetchPublicPricing(force).then(setPricing).catch(() => undefined);

    await Promise.all([favTask, entTask, meTask, pricingTask]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
      void refetchOrders();
    }, [loadCatalog, refetchOrders])
  );

  const enterpriseById = useMemo(() => new Map(enterprises.map((e) => [e.id, e])), [enterprises]);

  const toggleFav = async (id: string) => {
    const nextIsFav = await toggleFavoriteEnterpriseId(id);
    setFavoriteIds((prev) => {
      const n = new Set(prev);
      if (nextIsFav) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const goMarketplace = (params?: { q?: string; type?: string }) => {
    if (params?.q || params?.type) {
      const q = new URLSearchParams();
      if (params.q) q.set('q', params.q);
      if (params.type) q.set('type', params.type);
      router.push(`/(tabs)/marketplace?${q.toString()}`);
    } else {
      router.push('/(tabs)/marketplace');
    }
  };

  const contentBottom = Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;
  const profileImage = resolveRemoteImageUrl(me?.imageUrl ?? me?.image_url);
  const pricingSnap = pricing ?? DEFAULT_PUBLIC_PRICING;
  const firstName = (me?.nom || '').trim().split(/\s+/)[0] || 'Bienvenue';
  const heroEnterprise = heroOrder?.entreprise_id ? enterpriseById.get(heroOrder.entreprise_id) : undefined;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 10), paddingBottom: contentBottom },
        ]}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Image source={require('@/assets/images/logo.png')} style={styles.brandLogo} contentFit="contain" />
            <ThemedText style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
              Bonjour, {firstName}
            </ThemedText>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/notifications')}
              hitSlop={10}>
              <Bell size={21} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
              {unreadCount > 0 ? (
                <View style={[styles.notifDot, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                  <ThemedText style={styles.notifDotText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={[styles.avatarOuter, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={8}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={80}
                />
              ) : (
                <User size={21} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              )}
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.primaryDeep,
            },
          ]}>
          <Search size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Restaurants, boutiques…"
            placeholderTextColor={colors.placeholder}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => {
              if (search.trim()) goMarketplace({ q: search.trim() });
            }}
            returnKeyType="search"
          />
          <Pressable
            style={[styles.filterTap, { backgroundColor: colors.primarySoft }]}
            onPress={() => goMarketplace(search.trim() ? { q: search.trim() } : undefined)}
            hitSlop={8}>
            <SlidersHorizontal size={18} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        <View style={[styles.shineBanner, { backgroundColor: colors.primaryDeep }]}>
          <View style={[styles.shineIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Zap size={16} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} fill={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.shineTitle, { color: colors.onPrimary }]}>Livraison express</ThemedText>
            <ThemedText style={[styles.shineSub, { color: colors.onPrimary }]}>
              Commandez maintenant, livré en moins d'une heure
            </ThemedText>
          </View>
          <Sparkles size={18} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
        </View>

        {loadingOrders ? null : heroOrder ? (
          <HomeActiveOrderWidget
            order={heroOrder}
            merchantName={heroEnterprise?.nom}
            merchantImage={heroEnterprise?.image_url}
            merchantType={heroEnterprise?.type}
          />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORY_ITEMS.map((c) => (
            <Pressable
              key={c.key}
              style={styles.catItem}
              onPress={() => goMarketplace(c.type === 'all' ? undefined : { type: c.type })}
              hitSlop={6}>
              <View style={[styles.catIcon, { backgroundColor: colors.primarySoft }]}>
                <c.Icon size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.catLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {c.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
            Près de vous
          </ThemedText>
          <Pressable onPress={() => goMarketplace()} hitSlop={10}>
            <ThemedText style={[styles.seeAll, { color: colors.primary }]}>Tout voir</ThemedText>
          </Pressable>
        </View>

        {loadingEnterprises ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={colors.primary} />
            <ThemedText style={[styles.loaderText, { color: colors.textMuted }]}>Chargement…</ThemedText>
          </View>
        ) : enterpriseError && enterprises.length === 0 ? (
          <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>Connexion en cours…</ThemedText>
            <Pressable style={[styles.warnBtn, { backgroundColor: colors.primary }]} onPress={() => void loadCatalog(true)}>
              <ThemedText style={[styles.warnBtnText, { color: colors.onPrimary }]}>Actualiser</ThemedText>
            </Pressable>
          </View>
        ) : enterprises.length === 0 ? (
          <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <ThemedText style={[styles.warnTitle, { color: colors.text }]}>Rien pour le moment</ThemedText>
            <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>
              Aucun commerce ouvert près de vous.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.commerceRow}>
            {enterprises.slice(0, 8).map((e) => {
              const img = resolveRemoteImageUrl(e.image_url);
              const fav = favoriteIds.has(e.id);
              const feeLabel = formatFcfa(displayDeliveryFeeFcfa(e.frais_livraison, pricingSnap));
              return (
                <Pressable
                  key={e.id}
                  style={[
                    styles.commerceCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      shadowColor: colors.primaryDeep,
                    },
                  ]}
                  onPress={() => router.push(`/(tabs)/marketplace/${e.id}`)}
                  android_ripple={{ color: colors.primaryMuted }}>
                  <View style={[styles.commerceImageWrap, { backgroundColor: colors.primarySoft }]}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.commerceImage} contentFit="cover" />
                    ) : e.type === 'restaurant' ? (
                      <UtensilsCrossed size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    ) : (
                      <Store size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    )}
                    <Pressable style={[styles.heartBtn, { backgroundColor: colors.surface }]} onPress={() => void toggleFav(e.id)} hitSlop={8}>
                      <Heart size={16} color={fav ? colors.error : colors.textMuted} fill={fav ? colors.error : 'none'} strokeWidth={LUCIDE_STROKE} />
                    </Pressable>
                  </View>
                  <View style={styles.commerceBody}>
                    <ThemedText type="defaultSemiBold" style={[styles.commerceName, { color: colors.text }]} numberOfLines={2}>
                      {e.nom ?? 'Commerce'}
                    </ThemedText>
                    <ThemedText style={[styles.commerceMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      Livraison {feeLabel}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Pressable
          style={[styles.promoBanner, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => goMarketplace()}
          android_ripple={{ color: colors.primaryMuted }}>
          <View style={[styles.promoIcon, { backgroundColor: colors.primarySoft }]}>
            <Tag size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          </View>
          <ThemedText style={[styles.promoBannerText, { color: colors.textSecondary }]}>
            Codes promo disponibles au paiement
          </ThemedText>
        </Pressable>

        {!loadingOrders && !heroOrder ? (
          <Pressable style={styles.historyLink} onPress={() => router.push('/(tabs)/explore')} hitSlop={10}>
            <ThemedText style={[styles.historyLinkText, { color: colors.primary }]}>Voir mes commandes</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topBarLeft: { flex: 1, gap: 4, marginRight: 8 },
  greeting: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  brandLogo: { width: 108, height: 34 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  avatarOuter: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 44,
    fontWeight: '500',
  },
  filterTap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRow: {
    gap: 20,
    paddingVertical: 18,
    paddingRight: 4,
  },
  catItem: {
    alignItems: 'center',
    gap: 8,
    width: 72,
  },
  catIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  seeAll: { fontSize: 14, fontWeight: '600' },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  loaderText: { fontSize: 14 },
  warnCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  warnTitle: { fontWeight: '700', fontSize: 15 },
  warnBody: { fontSize: 14, lineHeight: 20 },
  warnBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  warnBtnText: { fontWeight: '700' },
  commerceRow: {
    gap: 14,
    paddingBottom: 20,
    paddingRight: 4,
  },
  commerceCard: {
    width: 168,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  commerceImageWrap: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commerceImage: { width: '100%', height: '100%' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commerceBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  commerceName: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  commerceMeta: { fontSize: 11 },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  promoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBannerText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  historyLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyLinkText: { fontSize: 14, fontWeight: '600' },
  shineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  shineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shineTitle: { fontSize: 14, fontWeight: '900', letterSpacing: -0.1 },
  shineSub: { fontSize: 11, fontWeight: '500', opacity: 0.92, marginTop: 1 },
});
