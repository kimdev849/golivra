import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownUp,
  Bell,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeActiveOrderWidget } from '@/components/home-active-order-widget';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
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

const GRID_GAP = 8;
const H_PAD = 10;
const FEED_PAGE_SIZE = 24;

type ExplorerCategory = 'all' | 'plat' | 'article' | 'restaurant' | 'boutique' | 'promo';
type SortKey = 'recent' | 'price_low' | 'price_high';

const CATEGORIES: {
  key: ExplorerCategory;
  label: string;
  Icon: typeof Store;
}[] = [
  { key: 'all', label: 'Tout', Icon: Sparkles },
  { key: 'plat', label: 'Plats', Icon: UtensilsCrossed },
  { key: 'article', label: 'Produits', Icon: ShoppingBasket },
  { key: 'restaurant', label: 'Restaurants', Icon: UtensilsCrossed },
  { key: 'boutique', label: 'Boutiques', Icon: Store },
  { key: 'promo', label: 'Promos', Icon: Tag },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Récents' },
  { key: 'price_low', label: 'Prix ↑' },
  { key: 'price_high', label: 'Prix ↓' },
];

function categoryToSearchType(category: ExplorerCategory): CatalogSearchType {
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

export default function ExplorerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { heroOrder, isLoading: loadingOrders, refetch: refetchOrders } = useActiveOrders();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExplorerCategory>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [showSortRow, setShowSortRow] = useState(false);
  const [favProductKeys, setFavProductKeys] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(search.trim(), 150);
  const searchActive = debouncedSearch.length >= 2;

  const { data: restaurants = [] } = useEnterprises('restaurant');
  const { data: boutiques = [] } = useEnterprises('boutique');

  const feedParams = useMemo(() => {
    if (category === 'promo') return { promo: true };
    if (category === 'plat') return { type: 'plat' as const };
    if (category === 'article') return { type: 'article' as const };
    return {};
  }, [category]);

  const feedEnabled = !searchActive && category !== 'restaurant' && category !== 'boutique';

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
    queryKey: ['explorer-feed', feedParams],
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
    placeholderData: (previousData) => previousData,
  });

  const feedProducts = useMemo(() => feedPages?.pages.flat() ?? [], [feedPages]);

  const {
    data: searchResult,
    isFetching: searching,
    refetch: refetchSearch,
    isRefetching: refetchingSearch,
  } = useQuery({
    queryKey: ['explorer-search', debouncedSearch, category],
    queryFn: () => searchCatalog(debouncedSearch, categoryToSearchType(category), 40),
    enabled: searchActive,
    staleTime: 1000 * 45,
  });

  const displayProducts = useMemo(() => {
    let list: ProductPublic[] = [];
    if (searchActive) {
      // Résultats serveur si dispo
      const serverProds = searchResult?.products ?? [];
      
      // Résultats locaux (pour l'effet < 100ms)
      const needle = debouncedSearch.toLowerCase();
      const localProds = feedProducts.filter(p => 
        (p.nom ?? '').toLowerCase().includes(needle) || 
        (p.description ?? '').toLowerCase().includes(needle) ||
        (p.enterprise_nom ?? '').toLowerCase().includes(needle)
      );

      // Fusionner sans doublons
      const seen = new Set(serverProds.map(p => p.id));
      list = [...serverProds, ...localProds.filter(p => !seen.has(p.id))];

      if (category === 'promo') {
        list = list.filter(isPromoProduct);
      }
    } else {
      list = feedProducts;
      if (category === 'promo') {
        list = list.filter(isPromoProduct);
      }
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

  useEffect(() => {
    prefetchClientCatalog();
    void queryClient.prefetchInfiniteQuery({
      queryKey: ['explorer-feed', {}],
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

  const onEndReached = useCallback(() => {
    if (!feedEnabled || searchActive || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [feedEnabled, searchActive, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderProduct = useCallback(
    ({ item }: { item: ProductPublic }) => (
      <View style={styles.gridCell}>
        <ListingCard
          product={item}
          variant="grid"
          onPress={() => router.push(productDetailHref(item) as never)}
          isFav={favProductKeys.has(`${item.kind === 'article' ? 'article' : 'plat'}:${item.id}`)}
          onToggleFav={() => void onToggleFav(item)}
        />
      </View>
    ),
    [favProductKeys, onToggleFav, router],
  );

  const renderEnterpriseRow = (ent: EnterprisePublic) => {
    const logoUrl = resolveRemoteImageUrl(ent.image_url);
    return (
      <Pressable
        key={ent.id}
        style={[styles.enterpriseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/(tabs)/marketplace/${ent.id}` as never)}>
        <View style={[styles.enterpriseLogoBox, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.enterpriseLogo} contentFit="cover" />
          ) : (
            <Store size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.enterpriseName, { color: colors.text }]} numberOfLines={1}>
            {ent.nom}
          </ThemedText>
          {ent.adresse ? (
            <ThemedText style={[styles.enterpriseMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {ent.adresse}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const loading = searchActive ? searching && !searchResult : loadingFeed && feedProducts.length === 0;
  const refreshing = searchActive ? refetchingSearch : refetchingFeed;
  const activeCategoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? 'Tout';
  const hasActiveFilters = category !== 'all' || sort !== 'recent' || search.length > 0;

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setSort('recent');
    setShowSortRow(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const listHeader = (
    <View style={styles.headerWrap}>
      <View style={[styles.topBar, { marginTop: Math.max(insets.top, 10) }]}>
        <View style={styles.topBarLeft}>
          <ThemedText style={[styles.marketTitle, { color: colors.text }]}>GoLivra</ThemedText>
          <ThemedText style={[styles.marketSub, { color: colors.textMuted }]}>
            Restaurants, Boutiques & Services
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {hasActiveFilters && (
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={clearAllFilters}
              hitSlop={8}>
              <X size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          )}
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications">
            <Bell size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            {unreadCount > 0 ? (
              <View style={[styles.notifDot, { backgroundColor: colors.error, borderColor: colors.background }]}>
                <ThemedText style={styles.notifDotTxt}>{unreadCount > 9 ? '9+' : String(unreadCount)}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Search size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher des articles…"
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setCategory(c.key);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}>
              <c.Icon
                size={14}
                color={active ? colors.onPrimary : colors.text}
                strokeWidth={LUCIDE_STROKE}
              />
              <ThemedText style={[styles.chipTxt, { color: active ? colors.onPrimary : colors.text }]}>
                {c.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toolbarRow}>
        <Pressable
          style={[
            styles.filterBtn,
            {
              backgroundColor: showSortRow ? colors.primary : colors.surface,
              borderColor: showSortRow ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowSortRow((v) => !v);
          }}
          accessibilityLabel="Filtres et tri">
          <SlidersHorizontal
            size={16}
            color={showSortRow ? colors.onPrimary : colors.text}
            strokeWidth={LUCIDE_STROKE}
          />
          <ThemedText style={[styles.filterBtnTxt, { color: showSortRow ? colors.onPrimary : colors.text }]}>
            Trier par
          </ThemedText>
        </Pressable>
        <View style={[styles.activeFilterPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1 }]}>
          <ThemedText style={[styles.activeFilterTxt, { color: colors.textSecondary }]} numberOfLines={1}>
            {activeCategoryLabel}
            {searchActive ? ` · « ${debouncedSearch} »` : ''}
            {sort !== 'recent' ? ` · ${SORT_OPTIONS.find((s) => s.key === sort)?.label}` : ''}
          </ThemedText>
        </View>
      </View>

      {showSortRow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          <ArrowDownUp size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          {SORT_OPTIONS.map((s) => {
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSort(s.key)}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}>
                <ThemedText style={[styles.sortChipTxt, { color: active ? colors.onPrimary : colors.text }]}>
                  {s.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!loadingOrders && heroOrder && !searchActive ? <HomeActiveOrderWidget order={heroOrder} /> : null}

      {searchActive && searching ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText style={[styles.loaderText, { color: colors.textMuted }]}>Recherche…</ThemedText>
        </View>
      ) : null}

      {searchActive && !searching ? (
        <ThemedText style={[styles.resultCount, { color: colors.textMuted }]}>
          {displayProducts.length + displayEnterprises.length} résultat
          {displayProducts.length + displayEnterprises.length !== 1 ? 's' : ''}
        </ThemedText>
      ) : null}

      {searchActive && displayEnterprises.length > 0 ? (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Commerces</ThemedText>
          {displayEnterprises.map(renderEnterpriseRow)}
        </View>
      ) : null}

      {!searchActive && (category === 'restaurant' || category === 'boutique') ? (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {category === 'restaurant' ? 'Restaurants' : 'Boutiques'}
          </ThemedText>
          {displayEnterprises.map(renderEnterpriseRow)}
        </View>
      ) : null}

      {loading && showProductGrid ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText style={[styles.loaderText, { color: colors.textMuted }]}>Chargement…</ThemedText>
        </View>
      ) : null}

      {feedError && !searchActive && showProductGrid ? (
        <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>
            {feedError instanceof Error ? feedError.message : 'Impossible de charger les produits.'}
          </ThemedText>
          <Pressable
            style={[styles.warnBtn, { backgroundColor: colors.primary }]}
            onPress={() => void refetchFeed()}>
            <ThemedText style={[styles.warnBtnText, { color: colors.onPrimary }]}>Réessayer</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      {showProductGrid ? (
        <FlatList
          data={displayProducts}
          key={`grid-${category}-${searchActive ? debouncedSearch : 'feed'}`}
          numColumns={2}
          keyExtractor={(p) => `${p.kind || 'p'}-${p.id}`}
          renderItem={renderProduct}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading ? (
              <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <ThemedText style={[styles.warnTitle, { color: colors.text }]}>
                  {searchActive ? 'Aucun résultat' : 'Aucun produit'}
                </ThemedText>
                <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>
                  {searchActive ? 'Modifiez la recherche ou les filtres.' : 'Revenez un peu plus tard.'}
                </ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.loaderRow}>
                <ActivityIndicator color={colors.primary} />
              </View>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerWrap: { gap: 10, marginBottom: 6 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarLeft: { flex: 1, gap: 2, marginRight: 8 },
  marketTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  marketSub: { fontSize: 13, fontWeight: '500' },
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
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDotTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  filterRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 14, fontWeight: '700' },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterBtnTxt: { fontSize: 13, fontWeight: '700' },
  activeFilterPill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activeFilterTxt: { fontSize: 12, fontWeight: '700' },
  sortRow: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipTxt: { fontSize: 12, fontWeight: '700' },
  section: { gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  resultCount: { fontSize: 13, marginBottom: 4 },
  gridRow: { gap: GRID_GAP },
  gridCell: {
    flex: 1,
    paddingHorizontal: GRID_GAP / 2,
    marginBottom: GRID_GAP + 4,
  },
  enterpriseRow: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  enterpriseLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterpriseLogo: {
    width: '100%',
    height: '100%',
  },
  enterpriseName: { fontSize: 16, fontWeight: '700' },
  enterpriseMeta: { fontSize: 13, marginTop: 2 },
  loaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  loaderText: { fontSize: 13 },
  warnCard: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8 },
  warnTitle: { fontSize: 14, fontWeight: '700' },
  warnBody: { fontSize: 13 },
  warnBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  warnBtnText: { fontWeight: '800', fontSize: 13 },
});
