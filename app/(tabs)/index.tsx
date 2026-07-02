import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  ChevronRight,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeActiveOrderWidget } from '@/components/home-active-order-widget';
import { HomeCampaignBanner } from '@/components/home-campaign-banner';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useAppColors } from '@/hooks/use-app-colors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useEnterprises } from '@/hooks/useMarketplace';
import {
  fetchProductFeed,
  searchCatalog,
  type CatalogSearchType,
  type EnterprisePublic,
  type ProductPublic,
} from '@/lib/catalog';
import { prefetchClientCatalog } from '@/lib/client-data';
import { resolveRemoteImageUrl } from '@/lib/images';
import { toggleFavoriteProduct } from '@/lib/favorites';
import { productDetailHref } from '@/lib/listing-utils';
import { getEffectiveUnitPrice } from '@/lib/product-promo';
import { formatFcfa } from '@/lib/format';
import { fetchActiveCampaigns } from '@/lib/campaigns';
import { trackInteraction } from '@/lib/tracking';

// ─── Constants ────────────────────────────────────────────────────

const H_PAD = 16;
const FEED_PAGE_SIZE = 24;

// ─── Types ────────────────────────────────────────────────────────

type FilterTab = 'all' | 'plat' | 'article' | 'restaurant' | 'boutique' | 'promo';
type SortKey = 'recent' | 'price_low' | 'price_high';

// ─── Food category chips (visual) ─────────────────────────────────

const FOOD_CATEGORIES: { key: FilterTab; label: string; emoji: string }[] = [
  { key: 'all',        label: 'Tout',       emoji: '🍽️' },
  { key: 'plat',       label: 'Plats',      emoji: '🍳' },
  { key: 'restaurant', label: 'Restos',     emoji: '🏪' },
  { key: 'boutique',   label: 'Boutiques',  emoji: '🛒' },
  { key: 'article',    label: 'Produits',   emoji: '📦' },
  { key: 'promo',      label: 'Promos',     emoji: '🏷️' },
];

// ─── Helpers ─────────────────────────────────────────────────────

function categoryToSearchType(category: FilterTab): CatalogSearchType {
  if (category === 'plat') return 'plat';
  if (category === 'article') return 'article';
  if (category === 'restaurant') return 'restaurant';
  if (category === 'boutique') return 'boutique';
  return 'all';
}

function isPromoProduct(p: ProductPublic): boolean {
  const promo = Number(p.prix_promo);
  const base = Number(getEffectiveUnitPrice(p) ?? p.prix);
  return Number.isFinite(promo) && promo < base;
}

function unitPrice(p: ProductPublic): number {
  return Number(getEffectiveUnitPrice(p) ?? p.prix ?? 0);
}

function sortProducts(list: ProductPublic[], sort: SortKey): ProductPublic[] {
  if (sort === 'recent') return list;
  const copy = [...list];
  if (sort === 'price_low') copy.sort((a, b) => unitPrice(a) - unitPrice(b));
  if (sort === 'price_high') copy.sort((a, b) => unitPrice(b) - unitPrice(a));
  return copy;
}

function promoPercent(p: ProductPublic): number | null {
  const base = Number(p.prix);
  const promo = Number(p.prix_promo);
  if (!isPromoProduct(p) || !base) return null;
  return Math.round(((base - promo) / base) * 100);
}

// ─── Premium Product Card ─────────────────────────────────────────

function PremiumCard({
  product,
  onPress,
  isFav,
  onToggleFav,
  colors,
}: {
  product: ProductPublic;
  onPress: () => void;
  isFav: boolean;
  onToggleFav: () => void;
  colors: ReturnType<typeof useAppColors>;
}) {
  const imageUrl = resolveRemoteImageUrl(
    product.images_urls?.[0] ?? product.image_url,
    { width: 400, format: 'webp', quality: 80 },
  );
  const isPromo = isPromoProduct(product);
  const pct = promoPercent(product);
  const price = isPromo ? Number(product.prix_promo) : unitPrice(product);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.premiumCard,
        { backgroundColor: colors.surface, opacity: pressed ? 0.93 : 1 },
      ]}>
      {/* Image */}
      <View style={[styles.premiumCardImg, { backgroundColor: colors.primarySoft }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <UtensilsCrossed size={28} color={colors.primary} strokeWidth={1.5} />
        )}
        {/* Promo badge */}
        {pct ? (
          <View style={[styles.promoBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.promoBadgeTxt}>-{pct}%</Text>
          </View>
        ) : null}
        {/* Fav button */}
        <Pressable
          style={[styles.favBtn, { backgroundColor: 'rgba(255,255,255,0.92)' }]}
          onPress={(e) => { e.stopPropagation(); onToggleFav(); }}
          hitSlop={6}>
          <Star
            size={13}
            color={isFav ? '#F5A524' : '#8B939C'}
            fill={isFav ? '#F5A524' : 'none'}
            strokeWidth={2}
          />
        </Pressable>
      </View>

      {/* Info */}
      <View style={styles.premiumCardBody}>
        <Text style={[styles.premiumCardName, { color: colors.text }]} numberOfLines={1}>
          {product.nom || 'Produit'}
        </Text>

        {/* Rating + vendor + time */}
        <View style={styles.premiumCardMeta}>
          {product.enterprise_nom ? (
            <Text style={[styles.premiumCardVendor, { color: colors.textMuted }]} numberOfLines={1}>
              {product.enterprise_nom}
            </Text>
          ) : null}
        </View>

        {/* Price */}
        <View style={styles.premiumCardPriceRow}>
          <Text style={[styles.premiumCardPrice, { color: colors.primary }]}>
            {formatFcfa(price)}
          </Text>
          {isPromo ? (
            <Text style={[styles.premiumCardOldPrice, { color: colors.textMuted }]}>
              {formatFcfa(Number(product.prix))}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Enterprise card (horizontal scroll) ─────────────────────────

function EnterpriseCard({
  enterprise,
  onPress,
  colors,
}: {
  enterprise: EnterprisePublic;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
}) {
  const imgUrl = resolveRemoteImageUrl(enterprise.image_url, { width: 300, format: 'webp', quality: 80 });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.enterpriseCard,
        { backgroundColor: colors.surface, opacity: pressed ? 0.93 : 1 },
      ]}>
      <View style={[styles.enterpriseCardImg, { backgroundColor: colors.primarySoft }]}>
        {imgUrl ? (
          <Image
            source={{ uri: imgUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Store size={24} color={colors.primary} strokeWidth={1.5} />
        )}
        {enterprise.ouvert === false ? (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedTxt}>Fermé</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.enterpriseCardName, { color: colors.text }]} numberOfLines={1}>
        {enterprise.nom}
      </Text>
      {enterprise.delai_livraison_min ? (
        <Text style={[styles.enterpriseCardMeta, { color: colors.textMuted }]}>
          {enterprise.delai_livraison_min} min
        </Text>
      ) : null}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { heroOrder, isLoading: loadingOrders, refetch: refetchOrders } = useActiveOrders();

  // ── Campagnes marketing actives (offre du jour) ────────
  const { data: activeCampaigns = [] } = useQuery({
    queryKey: ['active-campaigns'],
    queryFn: () => fetchActiveCampaigns(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });

  const flatListRef = useRef<FlatList>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [showSort, setShowSort] = useState(false);
  const [favProductKeys, setFavProductKeys] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);

  const debouncedSearch = useDebouncedValue(search.trim(), 150);
  const searchActive = debouncedSearch.length >= 2;

  // ── Data hooks ────────────────────────────────────────────────

  const { data: restaurants = [] } = useEnterprises('restaurant');
  const { data: boutiques = [] } = useEnterprises('boutique');

  const feedParams = useMemo(() => {
    if (category === 'promo') return { promo: true };
    if (category === 'plat') return { type: 'plat' as const };
    if (category === 'article') return { type: 'article' as const };
    return {};
  }, [category]);

  const feedEnabled =
    !searchActive && category !== 'restaurant' && category !== 'boutique';

  const {
    data: feedPages,
    isLoading: loadingFeed,
    error: feedError,
    refetch: refetchFeed,
    isRefetching: refetchingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['home-feed', feedParams],
    queryFn: ({ pageParam }) =>
      fetchProductFeed({ ...feedParams, limit: FEED_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < FEED_PAGE_SIZE) return undefined;
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    enabled: feedEnabled,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
  });

  const feedProducts = useMemo(() => feedPages?.pages.flat() ?? [], [feedPages]);

  // Promo products from the feed
  const promoProducts = useMemo(
    () => feedProducts.filter(isPromoProduct).slice(0, 8),
    [feedProducts],
  );

  const {
    data: searchResult,
    isFetching: searching,
    refetch: refetchSearch,
    isRefetching: refetchingSearch,
  } = useQuery({
    queryKey: ['home-search', debouncedSearch, category],
    queryFn: () => searchCatalog(debouncedSearch, categoryToSearchType(category), 40),
    enabled: searchActive,
    staleTime: 1000 * 45,
  });

  const displayProducts = useMemo(() => {
    let list: ProductPublic[] = [];
    if (searchActive) {
      const serverProds = searchResult?.products ?? [];
      const needle = debouncedSearch.toLowerCase();
      const localProds = feedProducts.filter(
        (p) =>
          (p.nom ?? '').toLowerCase().includes(needle) ||
          (p.description ?? '').toLowerCase().includes(needle) ||
          (p.enterprise_nom ?? '').toLowerCase().includes(needle),
      );
      const seen = new Set(serverProds.map((p) => p.id));
      list = [...serverProds, ...localProds.filter((p) => !seen.has(p.id))];
      if (category === 'promo') list = list.filter(isPromoProduct);
    } else {
      list = feedProducts;
      if (category === 'promo') list = list.filter(isPromoProduct);
    }
    return sortProducts(list, sort);
  }, [searchActive, searchResult, feedProducts, category, sort, debouncedSearch]);

  const displayEnterprises = useMemo(() => {
    if (searchActive) return searchResult?.enterprises ?? [];
    if (category === 'restaurant') return restaurants;
    if (category === 'boutique') return boutiques;
    return [];
  }, [searchActive, searchResult, category, restaurants, boutiques]);

  const showProductGrid =
    !searchActive ? category !== 'restaurant' && category !== 'boutique' : true;

  // ── Effects ───────────────────────────────────────────────────

  useEffect(() => {
    prefetchClientCatalog();
    void queryClient.prefetchInfiniteQuery({
      queryKey: ['home-feed', {}],
      queryFn: ({ pageParam }) =>
        fetchProductFeed({ limit: FEED_PAGE_SIZE, offset: pageParam as number }),
      initialPageParam: 0,
    });
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      void refetchOrders();
    }, [refetchOrders]),
  );

  useEffect(() => {
    if (debouncedSearch.length >= 3) {
      void trackInteraction({ type: 'search', metadata: { query: debouncedSearch, category } });
    }
  }, [debouncedSearch]);

  // ── Handlers ──────────────────────────────────────────────────

  const onRefresh = useCallback(() => {
    if (searchActive) void refetchSearch();
    else void refetchFeed();
  }, [searchActive, refetchFeed, refetchSearch]);

  const onToggleFav = useCallback(
    async (p: ProductPublic) => {
      const kind: 'plat' | 'article' = p.kind === 'article' ? 'article' : 'plat';
      const key = `${kind}:${p.id}`;
      const wasFav = favProductKeys.has(key);
      void Haptics.selectionAsync();
      setFavProductKeys((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(key);
        else next.add(key);
        return next;
      });
      try {
        const next = await toggleFavoriteProduct(p.id, kind);
        setFavProductKeys((prev) => {
          const updated = new Set(prev);
          if (next) updated.add(key);
          else updated.delete(key);
          return updated;
        });
      } catch {
        setFavProductKeys((prev) => {
          const back = new Set(prev);
          if (wasFav) back.add(key);
          else back.delete(key);
          return back;
        });
      }
    },
    [favProductKeys],
  );

  const handleCategoryPress = (key: FilterTab) => {
    if (category === key) return;
    void Haptics.selectionAsync();
    setCategory(key);
    void trackInteraction({ type: 'category_click', targetId: key, targetType: 'category' });
  };

  const onEndReached = useCallback(() => {
    if (!feedEnabled || searchActive || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [feedEnabled, searchActive, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render helpers ────────────────────────────────────────────

  const renderProduct = useCallback(
    ({ item }: { item: ProductPublic }) => (
      <View style={styles.gridCell}>
        <PremiumCard
          product={item}
          onPress={() => router.push(productDetailHref(item) as never)}
          isFav={favProductKeys.has(`${item.kind === 'article' ? 'article' : 'plat'}:${item.id}`)}
          onToggleFav={() => void onToggleFav(item)}
          colors={colors}
        />
      </View>
    ),
    [favProductKeys, onToggleFav, router, colors],
  );

  const loading = searchActive
    ? searching && !searchResult
    : loadingFeed && feedProducts.length === 0;
  const refreshing = searchActive ? refetchingSearch : refetchingFeed;
  const hasActiveFilters = category !== 'all' || sort !== 'recent' || search.length > 0;

  // ── List Header ───────────────────────────────────────────────

  const listHeader = (
    <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 12) }]}>

      {/* ── Top bar: location + bell ─────────────────────── */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.locationRow}
          onPress={() => router.push('/my-addresses')}>
          <MapPin size={16} color={colors.primary} strokeWidth={2.5} />
          <Text style={[styles.locationText, { color: colors.text }]}>Brazzaville</Text>
          <Text style={[styles.locationChevron, { color: colors.textMuted }]}>›</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {hasActiveFilters ? (
            <Pressable
              style={[styles.topBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { setSearch(''); setCategory('all'); setSort('recent'); setShowSort(false); }}
              hitSlop={8}>
              <X size={16} color={colors.error} strokeWidth={2.5} />
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.topBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/notifications')}
            hitSlop={8}>
            <Bell size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            {unreadCount > 0 ? (
              <View style={[styles.notifDot, { backgroundColor: colors.error, borderColor: colors.background }]}>
                <Text style={styles.notifDotTxt}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* ── Search bar ───────────────────────────────────── */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Search size={17} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un plat, un produit, un restaurant…"
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Filter tabs (pill chips, no icons) ───────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FOOD_CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => handleCategoryPress(c.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}>
              <Text style={styles.filterChipEmoji}>{c.emoji}</Text>
              <Text style={[styles.filterChipTxt, { color: active ? colors.onPrimary : colors.text }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Sort toggle */}
        <Pressable
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSort(v => !v); }}
          style={[
            styles.filterChip,
            { backgroundColor: showSort ? colors.primary : colors.surface, borderColor: showSort ? colors.primary : colors.border },
          ]}>
          <SlidersHorizontal size={13} color={showSort ? colors.onPrimary : colors.text} strokeWidth={2} />
          <Text style={[styles.filterChipTxt, { color: showSort ? colors.onPrimary : colors.text }]}>Trier</Text>
        </Pressable>
      </ScrollView>

      {/* Sort chips */}
      {showSort ? (
        <View style={styles.sortRow}>
          {(['recent', 'price_low', 'price_high'] as SortKey[]).map((s) => {
            const labels: Record<SortKey, string> = { recent: 'Récents', price_low: 'Prix ↑', price_high: 'Prix ↓' };
            const active = sort === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSort(s)}
                style={[
                  styles.sortChip,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                ]}>
                <Text style={[styles.sortChipTxt, { color: active ? colors.onPrimary : colors.text }]}>{labels[s]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* ── Active order widget ───────────────────────────── */}
      {!loadingOrders && heroOrder && !searchActive ? (
        <HomeActiveOrderWidget order={heroOrder} />
      ) : null}

      {/* ─────────────────────────────────────────────────────
          BANNER — shown only on home (no search, no filter)
      ───────────────────────────────────────────────────── */}
      {/* ── Campagnes marketing actives (offre du jour) ── */}
      {!searchActive && category === 'all' && activeCampaigns.length > 0 ? (
        <HomeCampaignBanner
          campaigns={activeCampaigns}
          onPress={(campaign) => {
            if (campaign.type === 'promo') {
              handleCategoryPress('promo');
            }
          }}
          colors={colors}
        />
      ) : !searchActive && category === 'all' ? (
        <View style={styles.bannerWrap}>
          <LinearGradient
            colors={['#0C4F36', '#155C3F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerGradient}>
            {/* Text side */}
            <View style={styles.bannerTextSide}>
              <View style={styles.bannerPillWrap}>
                <Text style={styles.bannerPillTxt}>Bienvenue sur GoLivra</Text>
              </View>
              <Text style={styles.bannerTitle}>Commandez près de{'\n'}chez vous en{'\n'}quelques clics.</Text>
              <Pressable
                style={styles.bannerBtn}
                onPress={() => { handleCategoryPress('restaurant'); }}>
                <Text style={styles.bannerBtnTxt}>Explorer</Text>
              </Pressable>
            </View>
            {/* Food image side */}
            <View style={styles.bannerImgSide}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop' }}
                style={styles.bannerFood}
                contentFit="cover"
              />
            </View>
          </LinearGradient>
        </View>
      ) : null}

      {/* ─────────────────────────────────────────────────────
          RESTAURANTS POPULAIRES (horizontal scroll)
      ───────────────────────────────────────────────────── */}
      {!searchActive && category === 'all' && restaurants.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Restaurants populaires</Text>
            <Pressable
              style={styles.sectionSeeAll}
              onPress={() => handleCategoryPress('restaurant')}>
              <Text style={[styles.sectionSeeAllTxt, { color: colors.primary }]}>Voir tout</Text>
              <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {restaurants.slice(0, 8).map((ent) => (
              <EnterpriseCard
                key={ent.id}
                enterprise={ent}
                onPress={() => router.push(`/(tabs)/marketplace/${ent.id}` as never)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ─────────────────────────────────────────────────────
          RECOMMANDÉS POUR VOUS
      ───────────────────────────────────────────────────── */}
      {!searchActive && category === 'all' && feedProducts.length > 0 ? (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommandés pour vous</Text>
          <View style={styles.sectionSeeAll}>
            <Text style={[styles.sectionSeeAllTxt, { color: colors.textMuted }]}>
              {feedProducts.length} articles
            </Text>
          </View>
        </View>
      ) : null}

      {/* ─────────────────────────────────────────────────────
          ENTERPRISE LIST (restaurants / boutiques tabs)
      ───────────────────────────────────────────────────── */}
      {!searchActive && (category === 'restaurant' || category === 'boutique') ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }, { marginBottom: 10 }]}>
            {category === 'restaurant' ? 'Restaurants' : 'Boutiques'}
          </Text>
          {displayEnterprises.map((ent) => (
            <Pressable
              key={ent.id}
              style={({ pressed }) => [
                styles.entRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
              ]}
              onPress={() => router.push(`/(tabs)/marketplace/${ent.id}` as never)}>
              <View style={[styles.entRowImg, { backgroundColor: colors.primarySoft }]}>
                {resolveRemoteImageUrl(ent.image_url) ? (
                  <Image
                    source={{ uri: resolveRemoteImageUrl(ent.image_url)! }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <Store size={20} color={colors.primary} strokeWidth={1.5} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entRowName, { color: colors.text }]} numberOfLines={1}>
                  {ent.nom}
                </Text>
                <Text style={[styles.entRowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {[ent.categorie_nom, ent.delai_livraison_min ? `${ent.delai_livraison_min} min` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {ent.note_moyenne ? (
                <View style={styles.entRowRating}>
                  <Star size={12} color="#F5A524" fill="#F5A524" strokeWidth={0} />
                  <Text style={[styles.entRowRatingTxt, { color: colors.text }]}>
                    {ent.note_moyenne.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Search results: enterprises */}
      {searchActive && displayEnterprises.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Commerces</Text>
          {displayEnterprises.map((ent) => (
            <Pressable
              key={ent.id}
              style={({ pressed }) => [
                styles.entRow,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
              ]}
              onPress={() => router.push(`/(tabs)/marketplace/${ent.id}` as never)}>
              <View style={[styles.entRowImg, { backgroundColor: colors.primarySoft }]}>
                {resolveRemoteImageUrl(ent.image_url) ? (
                  <Image
                    source={{ uri: resolveRemoteImageUrl(ent.image_url)! }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <Store size={20} color={colors.primary} strokeWidth={1.5} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entRowName, { color: colors.text }]} numberOfLines={1}>{ent.nom}</Text>
                {ent.adresse ? (
                  <Text style={[styles.entRowMeta, { color: colors.textMuted }]} numberOfLines={1}>{ent.adresse}</Text>
                ) : null}
              </View>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Search result count */}
      {searchActive && !searching ? (
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {displayProducts.length + displayEnterprises.length} résultat{displayProducts.length + displayEnterprises.length !== 1 ? 's' : ''}
        </Text>
      ) : null}

      {/* Loading / searching */}
      {(loading && showProductGrid) || (searchActive && searching && !searchResult) ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loaderTxt, { color: colors.textMuted }]}>
            {searchActive ? 'Recherche…' : 'Chargement…'}
          </Text>
        </View>
      ) : null}

      {/* API error */}
      {feedError && !searchActive && showProductGrid ? (
        <View style={[styles.errorCard, { borderColor: colors.errorSoft, backgroundColor: colors.surface }]}>
          <Text style={[styles.errorTxt, { color: colors.textMuted }]}>
            {feedError instanceof Error ? feedError.message : 'Impossible de charger les produits.'}
          </Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => void refetchFeed()}>
            <Text style={[styles.retryBtnTxt, { color: colors.onPrimary }]}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Products section title */}
      {!searchActive && category !== 'all' && category !== 'restaurant' && category !== 'boutique' && displayProducts.length > 0 ? (
        <View style={[styles.sectionHeader, { marginBottom: 6 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {FOOD_CATEGORIES.find(c => c.key === category)?.label ?? 'Produits'}
          </Text>
          <Text style={[styles.sectionSeeAllTxt, { color: colors.textMuted }]}>
            {displayProducts.length} articles
          </Text>
        </View>
      ) : null}

      {searchActive && displayProducts.length > 0 ? (
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 8 }]}>Produits</Text>
      ) : null}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      {showProductGrid ? (
        <FlatList
          ref={flatListRef}
          data={displayProducts}
          key={`grid-${category}-${searchActive ? debouncedSearch : 'feed'}`}
          numColumns={2}
          keyExtractor={(p) => `${p.kind || 'p'}-${p.id}`}
          renderItem={renderProduct}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {searchActive ? 'Aucun résultat' : 'Aucun produit'}
                </Text>
                <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                  {searchActive ? 'Modifiez la recherche ou les filtres.' : 'Revenez un peu plus tard.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.loaderRow}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <View style={{ height: 8 }} />
            )
          }
          contentContainerStyle={{
            paddingHorizontal: H_PAD,
            paddingBottom: TAB_BAR_CONTENT_PADDING_BOTTOM + insets.bottom,
          }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          onScroll={(e) => setShowBackToTop(e.nativeEvent.contentOffset.y > 500)}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: H_PAD,
            paddingBottom: TAB_BAR_CONTENT_PADDING_BOTTOM + insets.bottom,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}>
          {listHeader}
        </ScrollView>
      )}

      {/* Back to top */}
      {showBackToTop ? (
        <Pressable
          style={[styles.backToTop, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => { flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          hitSlop={12}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>↑</Text>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  headerWrap: { gap: 12, marginBottom: 8 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  locationChevron: {
    fontSize: 18,
    fontWeight: '400',
    marginTop: -1,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notifDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDotTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Filter chips
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipEmoji: { fontSize: 14 },
  filterChipTxt: { fontSize: 13, fontWeight: '700' },

  // Sort
  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipTxt: { fontSize: 12, fontWeight: '700' },

  // Banner
  bannerWrap: { gap: 8 },
  bannerGradient: {
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    minHeight: 160,
  },
  bannerTextSide: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 10,
  },
  bannerPillWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bannerPillTxt: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerBtnTxt: {
    color: '#0C4F36',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerImgSide: {
    width: 140,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerFood: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 170,
    height: 190,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: -2,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerDotActive: {
    width: 18,
    borderRadius: 3,
  },

  // Sections
  section: { gap: 0 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionSeeAllTxt: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Horizontal scroll
  hScroll: { gap: 10, paddingBottom: 4 },

  // Enterprise card (horizontal)
  enterpriseCard: {
    width: 120,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    paddingBottom: 10,
  },
  enterpriseCardImg: {
    width: 120,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  closedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  enterpriseCardName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 7,
    paddingHorizontal: 8,
  },
  enterpriseCardMeta: {
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 8,
  },

  // Enterprise list row (vertical)
  entRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  entRowImg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entRowName: { fontSize: 15, fontWeight: '700' },
  entRowMeta: { fontSize: 12, marginTop: 2 },
  entRowRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  entRowRatingTxt: { fontSize: 13, fontWeight: '700' },

  // Premium product card (2-col grid)
  premiumCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  premiumCardImg: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  premiumCardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 3,
  },
  premiumCardName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  premiumCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  premiumCardVendor: { fontSize: 11 },
  premiumCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  premiumCardPrice: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  premiumCardOldPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },

  // Grid
  gridRow: { gap: 10, marginBottom: 10 },
  gridCell: { flex: 1 },

  // Loader
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loaderTxt: { fontSize: 13 },

  // Error
  errorCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  errorTxt: { fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnTxt: { fontWeight: '800', fontSize: 13 },

  // Empty state
  emptyCard: {
    padding: 20,
    borderRadius: 14,
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyBody: { fontSize: 13, textAlign: 'center' },

  // Result count
  resultCount: { fontSize: 13, marginTop: -4, marginBottom: 4 },

  // Back to top
  backToTop: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
});
