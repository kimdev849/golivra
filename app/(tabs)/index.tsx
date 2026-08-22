import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowUp,
  BadgePercent,
  Bell,
  ChevronRight,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Star,
  Store,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { HomeActiveOrderWidget } from '@/components/home-active-order-widget';
import { HomeCampaignBanner } from '@/components/home-campaign-banner';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ThemedView } from '@/components/themed-view';
import { HomeFeedSkeleton } from '@/components/ui/skeleton';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { NAVBAR_HEIGHT } from '@/components/web-navbar';
import { useDesktopSearch } from '@/app/(tabs)/_layout';
import { useActiveOrders } from '@/hooks/useActiveOrders';
import { useAppColors } from '@/hooks/use-app-colors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useEnterprises } from '@/hooks/useMarketplace';
import { useDeliveryEstimate } from '@/hooks/use-delivery-estimate';
import {
  fetchProductFeed,
  searchCatalog,
  sortEnterprisesByPopularity,
  sortEnterprisesByRecency,
  type CatalogSearchType,
  type EnterprisePublic,
  type ProductPublic,
} from '@/lib/catalog';
import { prefetchClientCatalog } from '@/lib/client-data';
import { resolveRemoteImageUrl, type ResizeOptions } from '@/lib/images';
import { enterprisePrepMinutes } from '@/lib/pricing';
import { toggleFavoriteProduct } from '@/lib/favorites';
import { productDetailHref } from '@/lib/listing-utils';
import { getEffectiveUnitPrice, resolveProductPricing } from '@/lib/product-promo';
import { formatFcfa } from '@/lib/format';
import { fetchActiveCampaigns } from '@/lib/campaigns';
import { trackInteraction } from '@/lib/tracking';

// ─── Constants ────────────────────────────────────────────────────

const H_PAD = 16;
const DESKTOP_H_PAD = 32;
const DESKTOP_MAX_WIDTH = 1200;
const DESKTOP_GRID_COLUMNS = 4;
const FEED_PAGE_SIZE = 24;
// Vignettes commerces (rangée / liste) : version webp redimensionnée pour
// éviter de télécharger l'original pleine taille dans une case de 52px.
const ENT_IMG: ResizeOptions = { width: 120, format: 'webp', quality: 75 };

// ─── Types ────────────────────────────────────────────────────────

type FilterTab = 'all' | 'plat' | 'article' | 'restaurant' | 'boutique' | 'promo';
type SortKey = 'recent' | 'popular' | 'price_low' | 'price_high';

// ─── Food category chips (visual) ─────────────────────────────────

const FOOD_CATEGORIES: { key: FilterTab; label: string; Icon: LucideIcon }[] = [
  { key: 'all',        label: 'Tout',       Icon: LayoutGrid },
  { key: 'plat',       label: 'Plats',      Icon: UtensilsCrossed },
  { key: 'restaurant', label: 'Restos',     Icon: Store },
  { key: 'boutique',   label: 'Boutiques',  Icon: ShoppingBag },
  { key: 'article',    label: 'Produits',   Icon: Package },
  { key: 'promo',      label: 'Promos',     Icon: BadgePercent },
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
  // Basé sur resolveProductPricing : prix promo comparé au prix de BASE et
  // fenêtres de dates respectées — exactement comme la fiche produit. Avant,
  // le prix promo était comparé au prix EFFECTIF (déjà réduit) : la promo
  // disparaissait de la liste dès qu'elle devenait active.
  return resolveProductPricing(p).promoActive;
}

function unitPrice(p: ProductPublic): number {
  return Number(getEffectiveUnitPrice(p) ?? p.prix ?? 0);
}

function sortProducts(list: ProductPublic[], sort: SortKey): ProductPublic[] {
  if (sort === 'recent' || sort === 'popular') return list;
  const copy = [...list];
  if (sort === 'price_low') copy.sort((a, b) => unitPrice(a) - unitPrice(b));
  if (sort === 'price_high') copy.sort((a, b) => unitPrice(b) - unitPrice(a));
  return copy;
}

function promoPercent(p: ProductPublic): number | null {
  const pct = resolveProductPricing(p).discountPercent;
  return pct != null && pct > 0 ? pct : null;
}

// ─── Premium Product Card ─────────────────────────────────────────

const PremiumCard = memo(function PremiumCard({
  product,
  onPress,
  isFav,
  onToggleFav,
  colors,
  enterpriseImageUrl,
  isDesktop,
}: {
  product: ProductPublic;
  onPress: () => void;
  isFav: boolean;
  onToggleFav: () => void;
  colors: ReturnType<typeof useAppColors>;
  /** Photo de profil du commerce (repli local si absente du feed). */
  enterpriseImageUrl?: string | null;
  isDesktop?: boolean;
}) {
  const imageUrl = resolveRemoteImageUrl(
    product.images_urls?.[0] ?? product.image_url,
    { width: 400, format: 'webp', quality: 80 },
  );
  // Logo du commerce visible dès la liste (plus besoin d'entrer dans le produit).
  const vendorAvatar = resolveRemoteImageUrl(
    product.enterprise_image_url ?? enterpriseImageUrl,
    { width: 96, format: 'webp', quality: 80 },
  );
  const isPromo = isPromoProduct(product);
  const pct = promoPercent(product);
  const price = isPromo ? Number(product.prix_promo) : unitPrice(product);

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      style={({ pressed }) => [
        styles.premiumCard,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
      ]}>
      {/* Image */}
      <View style={[styles.premiumCardImg, isDesktop && styles.premiumCardImgDesktop, { backgroundColor: colors.primarySoft }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            recyclingKey={imageUrl}
            cachePolicy="memory-disk"
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
      <View style={[styles.premiumCardBody, isDesktop && styles.premiumCardBodyDesktop]}>
        <Text style={[styles.premiumCardName, { color: colors.text }]} numberOfLines={1}>
          {product.nom || 'Produit'}
        </Text>

        {/* Rating + vendor + time */}
        <View style={styles.premiumCardMeta}>
          {vendorAvatar ? (
            <Image source={{ uri: vendorAvatar }} style={styles.premiumCardAvatar} contentFit="cover" transition={150} />
          ) : null}
          {product.enterprise_nom ? (
            <Text style={[styles.premiumCardVendor, { color: colors.textMuted }]} numberOfLines={1}>
              {product.enterprise_nom}
            </Text>
          ) : null}
        </View>

        {/* Price */}
        <View style={styles.premiumCardPriceRow}>
          <Text style={[styles.premiumCardPrice, isDesktop && styles.premiumCardPriceDesktop, { color: colors.primary }]}>
            {formatFcfa(price)}
          </Text>
          {isPromo ? (
            <Text style={[styles.premiumCardOldPrice, { color: colors.textMuted }]}>
              {formatFcfa(Number(product.prix))}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

// ─── Enterprise card (horizontal scroll) ─────────────────────────

const EnterpriseCard = memo(function EnterpriseCard({
  enterprise,
  onPress,
  colors,
  deliveryMinutes,
  isDesktop,
}: {
  enterprise: EnterprisePublic;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  /** Temps de livraison GoLivra estimé par zone (25/35/45) — sinfon commerce. */
  deliveryMinutes?: number | null;
  isDesktop?: boolean;
}) {
  const imgUrl = resolveRemoteImageUrl(enterprise.image_url, { width: 300, format: 'webp', quality: 80 });

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      style={({ pressed }) => [
        styles.enterpriseCard,
        isDesktop && styles.enterpriseCardDesktop,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
      ]}>
      <View style={[styles.enterpriseCardImg, isDesktop && styles.enterpriseCardImgDesktop, { backgroundColor: colors.primarySoft }]}>
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
      {enterprise.note_moyenne && enterprise.note_moyenne > 0 ? (
        <View style={styles.entRatingRow}>
          <Star size={11} color="#F5A524" fill="#F5A524" strokeWidth={0} />
          <Text style={[styles.enterpriseCardRating, { color: colors.text }]}>
            {enterprise.note_moyenne.toFixed(1)}
          </Text>
          {enterprise.nb_avis ? (
            <Text style={[styles.enterpriseCardRatingAvis, { color: colors.textMuted }]}>
              ({enterprise.nb_avis})
            </Text>
          ) : null}
        </View>
      ) : deliveryMinutes != null ? (
        <Text style={[styles.enterpriseCardMeta, { color: colors.textMuted }]}>
          ~{enterprisePrepMinutes(enterprise) + deliveryMinutes} min
        </Text>
      ) : null}
    </PressableScale>
  );
});

// ─── Main screen ──────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { heroOrder, isLoading: loadingOrders, refetch: refetchOrders } = useActiveOrders();
  // ⚡ Temps de livraison dynamique (GoLivra) selon la zone de l'adresse principale.
  const { minutes: deliveryMinutes } = useDeliveryEstimate();
  const isDesktop = useIsWebDesktop();

  // ── Campagnes marketing actives (offre du jour) ────────
  // staleTime court : si une campagne est désactivée côté admin,
  // la bannière disparaît dès le prochain affichage de l'accueil.
  const { data: activeCampaigns = [] } = useQuery({
    queryKey: ['active-campaigns'],
    queryFn: () => fetchActiveCampaigns(),
    // staleTime court mais non nul : la bannière se met à jour en quelques
    // dizaines de secondes sans requête réseau à CHAQUE retour sur l'accueil.
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 2,
  });

  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const desktopSearch = useDesktopSearch();
  const [localSearch, setLocalSearch] = useState('');
  // On desktop, the search is controlled by the WebNavbar context
  const search = isDesktop ? desktopSearch.searchValue : localSearch;
  const setSearch = isDesktop ? desktopSearch.setSearchValue : setLocalSearch;
  const [category, setCategory] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [favProductKeys, setFavProductKeys] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);

  // ── En-tête fixe : la barre de recherche + filtres restent TOUJOURS
  // visibles en haut. Pas de repli → scroll fluide, aucun vide blanc.
  const [headerHeight, setHeaderHeight] = useState(0);

  const debouncedSearch = useDebouncedValue(search.trim(), 150);
  const searchActive = debouncedSearch.length >= 2;

  // ── Data hooks ────────────────────────────────────────────────

  const {
    data: restaurants = [],
    refetch: refetchRestaurants,
  } = useEnterprises('restaurant');
  const {
    data: boutiques = [],
    refetch: refetchBoutiques,
  } = useEnterprises('boutique');

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

  const isEnterpriseView = !searchActive && (category === 'restaurant' || category === 'boutique');

  /** Options de tri selon le contenu affiché : commerces ≠ produits. */
  const sortOptions: { key: SortKey; label: string }[] = isEnterpriseView
    ? [
        { key: 'popular', label: 'Plus populaires' },
        { key: 'recent', label: 'Plus récents' },
      ]
    : [
        { key: 'price_low', label: 'Prix les plus bas' },
        { key: 'price_high', label: 'Prix les plus chers' },
      ];

  const displayEnterprises = useMemo(() => {
    if (searchActive) return searchResult?.enterprises ?? [];
    if (category === 'restaurant') {
      if (sort === 'popular') return sortEnterprisesByPopularity(restaurants);
      if (sort === 'recent') return sortEnterprisesByRecency(restaurants);
      return restaurants;
    }
    if (category === 'boutique') {
      if (sort === 'popular') return sortEnterprisesByPopularity(boutiques);
      if (sort === 'recent') return sortEnterprisesByRecency(boutiques);
      return boutiques;
    }
    return [];
  }, [searchActive, searchResult, category, restaurants, boutiques, sort]);

  /** « À découvrir » : restos + boutiques mélangés, mieux notés. Sur desktop on montre plus. */
  const discoverEnterprises = useMemo(
    () => sortEnterprisesByPopularity([...restaurants, ...boutiques]).slice(0, isDesktop ? 8 : 3),
    [restaurants, boutiques, isDesktop],
  );

  /** Photo de profil par commerce (repli si le feed ne l'hydrate pas). */
  const enterpriseImageById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of [...restaurants, ...boutiques]) m.set(e.id, e.image_url ?? null);
    return m;
  }, [restaurants, boutiques]);

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

  // Préchargement des images dès que les données arrivent : les vignettes du
  // flux (grille) et des commerces sont mises en cache disque → défilement et
  // navigation plus fluides, plus de pop-in lent. Les URL déjà préchargées ne
  // sont pas relancées (dédupe par référence) à chaque pagination.
  const prefetchedImages = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls: string[] = [];
    for (const p of feedProducts.slice(0, 24)) {
      const u = resolveRemoteImageUrl(p.images_urls?.[0] ?? p.image_url, {
        width: 400,
        format: 'webp',
        quality: 80,
      });
      if (u) urls.push(u);
    }
    for (const e of [...restaurants, ...boutiques].slice(0, 8)) {
      const u = resolveRemoteImageUrl(e.image_url, { width: 300, format: 'webp', quality: 80 });
      if (u) urls.push(u);
    }
    const fresh = urls.filter((u) => !prefetchedImages.current.has(u));
    if (fresh.length === 0) return;
    for (const u of fresh) prefetchedImages.current.add(u);
    void Image.prefetch(fresh);
  }, [feedProducts, restaurants, boutiques]);

  // Le tri suit le type de contenu : commerces (populaire/récent) vs produits (prix).
  useEffect(() => {
    const enterprise = !searchActive && (category === 'restaurant' || category === 'boutique');
    if (enterprise) {
      setSort((s) => (s === 'popular' || s === 'recent' ? s : 'popular'));
    } else {
      setSort((s) => (s === 'price_low' || s === 'price_high' || s === 'recent' ? s : 'recent'));
    }
  }, [category, searchActive]);

  useFocusEffect(
    useCallback(() => {
      // Commandes actives : toujours rafraîchies au retour (suivi en direct).
      void refetchOrders();
      // Commerces : ne refetch QUE si les données sont périmées (> 2 min).
      // Avant, on forçait le réseau à chaque focus → l'app paraissait lente
      // et brûlait la batterie dès qu'on revenait sur l'accueil.
      const shouldRefetch = (type: 'restaurant' | 'boutique') => {
        const state = queryClient.getQueryState<EnterprisePublic[]>(['enterprises', type]);
        if (!state?.dataUpdatedAt) return true;
        return Date.now() - state.dataUpdatedAt > 1000 * 60 * 2;
      };
      if (shouldRefetch('restaurant')) void refetchRestaurants();
      if (shouldRefetch('boutique')) void refetchBoutiques();
    }, [queryClient, refetchOrders, refetchRestaurants, refetchBoutiques]),
  );

  useEffect(() => {
    if (debouncedSearch.length >= 3) {
      void trackInteraction({ type: 'search', metadata: { query: debouncedSearch, category } });
    }
  }, [debouncedSearch, category]);

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

  /** Suit le scroll uniquement pour afficher le bouton « retour en haut ». */
  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      setShowBackToTop(e.nativeEvent.contentOffset.y > 500);
    },
    [],
  );

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
          enterpriseImageUrl={enterpriseImageById.get(item.entreprise_id) ?? null}
          isDesktop={isDesktop}
        />
      </View>
    ),
    [favProductKeys, onToggleFav, router, colors, enterpriseImageById, isDesktop],
  );

  const loading = searchActive
    ? searching && !searchResult
    : loadingFeed && feedProducts.length === 0;
  const refreshing = searchActive ? refetchingSearch : refetchingFeed;
  const defaultSort: SortKey = isEnterpriseView ? 'popular' : 'recent';
  const hasActiveFilters = category !== 'all' || sort !== defaultSort || search.length > 0;

  /** Rangée de tri affichée juste au-dessus du contenu qu'elle trie. */
  const renderSortRow = (options: { key: SortKey; label: string }[]) => (
    <View style={styles.sortRowWrap}>
      {options.map((o) => {
        const active = sort === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              void Haptics.selectionAsync();
              setSort(o.key);
            }}
            style={[
              styles.sortChip,
              { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
            ]}>
            <Text style={[styles.sortChipTxt, { color: active ? colors.onPrimary : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ── En-tête fixe repliable : top bar + recherche + filtres ─────

  const fixedHeaderContent = (
    <View style={isDesktop ? styles.fixedHeaderContent : undefined}>
    <View style={styles.fixedHeaderInner}>

      {/* ── Top bar: location + bell (bell hidden on desktop) ── */}
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
              onPress={() => { setSearch(''); setCategory('all'); setSort('recent'); }}
              hitSlop={8}>
              <X size={16} color={colors.error} strokeWidth={2.5} />
            </Pressable>
          ) : null}
          {!isDesktop ? (
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
          ) : null}
        </View>
      </View>

      {/* ── Desktop welcome zone — greeting only, search is in the navbar ── */}
      {isDesktop ? (
        <View style={styles.desktopWelcomeZone}>
          <Text style={[styles.desktopWelcomeTitle, { color: colors.text }]}>Bonjour 👋</Text>
          <Text style={[styles.desktopWelcomeSub, { color: colors.textMuted }]}>Qu'est-ce que vous voulez commander aujourd'hui ?</Text>
        </View>
      ) : null}

      {/* ── Search bar (mobile only — hidden on desktop) ── */}
      {!isDesktop ? (
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
      ) : null}

      {/* ── Filter tabs (pill chips) ───────────── */}
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
              <c.Icon
                size={14}
                color={active ? colors.onPrimary : colors.textMuted}
                strokeWidth={active ? 2.4 : 2}
              />
              <Text style={[styles.filterChipTxt, { color: active ? colors.onPrimary : colors.text }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}

      </ScrollView>
    </View>
    </View>
  );

  // ── Liste : contenu défilant sous l'en-tête fixe ───────────────

  const listHeader = (
    <View style={isDesktop ? styles.headerWrapDesktop : styles.headerWrap}>

      {/* ── Active order widget ───────────────────────────── */}
      {!loadingOrders && heroOrder && !searchActive ? (
        <HomeActiveOrderWidget order={heroOrder} />
      ) : null}

      {/* ─────────────────────────────────────────────────────
          BANNER — shown only on home (no search, no filter)
      ───────────────────────────────────────────────────── */}
      {/* ── Campagnes marketing actives (offre du jour) — visibles uniquement
          si une campagne est réellement en cours. Sinon : rien du tout. ── */}
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
      ) : null}

      {/* ─────────────────────────────────────────────────────
          À DÉCOUVRIR (restos + boutiques mélangés, mieux notés, max 3)
      ───────────────────────────────────────────────────── */}
      {!searchActive && category === 'all' && discoverEnterprises.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop, { color: colors.text }]}>À découvrir</Text>
            <Pressable
              style={styles.sectionSeeAll}
              onPress={() => router.push('/discover-all')}
              hitSlop={8}>
              <Text style={[styles.sectionSeeAllTxt, isDesktop && styles.sectionSeeAllTxtDesktop, { color: colors.primary }]}>Voir plus</Text>
              <ChevronRight size={isDesktop ? 16 : 14} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {discoverEnterprises.map((ent) => (
              <EnterpriseCard
                key={ent.id}
                enterprise={ent}
                onPress={() => router.push(`/marketplace/${ent.id}` as never)}
                colors={colors}
                deliveryMinutes={deliveryMinutes}
                isDesktop={isDesktop}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ─────────────────────────────────────────────────────
          RECOMMANDÉS POUR VOUS
      ───────────────────────────────────────────────────── */}
      {!searchActive && category === 'all' && feedProducts.length > 0 ? (
        <>
          {isDesktop && discoverEnterprises.length > 0 ? <View style={styles.sectionDividerDesktop} /> : null}
          <View style={[styles.sectionHeader, isDesktop && { marginBottom: 14, marginTop: 10 }]}>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop, { color: colors.text }]}>Recommandés pour vous</Text>
          {isDesktop ? (
            <Pressable style={styles.sectionSeeAll} hitSlop={8}>
              <Text style={[styles.sectionSeeAllTxt, isDesktop && styles.sectionSeeAllTxtDesktop, { color: colors.primary }]}>Voir tout</Text>
              <ChevronRight size={16} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>
        </>
      ) : null}

      {/* ─────────────────────────────────────────────────────
          ENTERPRISE LIST (restaurants / boutiques tabs)
      ───────────────────────────────────────────────────── */}
      {!searchActive && (category === 'restaurant' || category === 'boutique') ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop, { color: colors.text, marginBottom: 10 }]}>
            {category === 'restaurant' ? 'Restaurants' : 'Boutiques'}
          </Text>
          {renderSortRow(sortOptions)}
          {/* Desktop: grid of enterprise cards | Mobile: list rows */}
          {isDesktop ? (
            <View style={styles.entGrid}>
              {displayEnterprises.map((ent) => (
                <Pressable
                  key={ent.id}
                  style={({ pressed }) => [
                    styles.entGridCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
                  ]}
                  onPress={() => router.push(`/marketplace/${ent.id}` as never)}>
                  <View style={[styles.entGridCardImg, { backgroundColor: colors.primarySoft }]}>
                    {resolveRemoteImageUrl(ent.image_url, ENT_IMG) ? (
                      <Image
                        source={{ uri: resolveRemoteImageUrl(ent.image_url, ENT_IMG)! }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <Store size={22} color={colors.primary} strokeWidth={1.5} />
                    )}
                  </View>
                  <View style={styles.entGridCardBody}>
                    <Text style={[styles.entGridCardName, { color: colors.text }]} numberOfLines={1}>{ent.nom}</Text>
                    <Text style={[styles.entGridCardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {[ent.categorie_nom, deliveryMinutes != null ? `~${enterprisePrepMinutes(ent) + deliveryMinutes} min` : null].filter(Boolean).join(' · ')}
                    </Text>
                    {ent.note_moyenne ? (
                      <View style={styles.entRatingRow}>
                        <Star size={12} color="#F5A524" fill="#F5A524" strokeWidth={0} />
                        <Text style={[styles.enterpriseCardRating, { color: colors.text }]}>{ent.note_moyenne.toFixed(1)}</Text>
                        {ent.nb_avis ? <Text style={[styles.enterpriseCardRatingAvis, { color: colors.textMuted }]}>({ent.nb_avis})</Text> : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            displayEnterprises.map((ent) => (
              <Pressable
                key={ent.id}
                style={({ pressed }) => [
                  styles.entRow,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
                ]}
                onPress={() => router.push(`/marketplace/${ent.id}` as never)}>
                <View style={[styles.entRowImg, { backgroundColor: colors.primarySoft }]}>
                  {resolveRemoteImageUrl(ent.image_url, ENT_IMG) ? (
                    <Image
                      source={{ uri: resolveRemoteImageUrl(ent.image_url, ENT_IMG)! }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <Store size={20} color={colors.primary} strokeWidth={1.5} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entRowName, { color: colors.text }]} numberOfLines={1}>{ent.nom}</Text>
                  <Text style={[styles.entRowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[ent.categorie_nom, deliveryMinutes != null ? `~${enterprisePrepMinutes(ent) + deliveryMinutes} min` : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {ent.note_moyenne ? (
                  <View style={styles.entRowRating}>
                    <Star size={12} color="#F5A524" fill="#F5A524" strokeWidth={0} />
                    <Text style={[styles.entRowRatingTxt, { color: colors.text }]}>{ent.note_moyenne.toFixed(1)}</Text>
                  </View>
                ) : null}
                <ChevronRight size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            ))
          )}
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
              onPress={() => router.push(`/marketplace/${ent.id}` as never)}>
              <View style={[styles.entRowImg, { backgroundColor: colors.primarySoft }]}>
                {resolveRemoteImageUrl(ent.image_url, ENT_IMG) ? (
                  <Image
                    source={{ uri: resolveRemoteImageUrl(ent.image_url, ENT_IMG)! }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    transition={150}
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


      {/* Loading / searching — squelette fidèle à la mise en page : l'interface
          « apparaît » progressivement au lieu d'un simple spinner. */}
      {(loading && showProductGrid) || (searchActive && searching && !searchResult) ? (
        <HomeFeedSkeleton />
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
        </View>
      ) : null}

      {searchActive && displayProducts.length > 0 ? (
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 8 }]}>Produits</Text>
      ) : null}

      {/* Tri des produits : juste au-dessus de la grille triée.
          Masqué sur « Recommandés pour vous » (catégorie all) : redondant, le tri
          reste disponible dans les catégories et la recherche. */}
      {showProductGrid && (searchActive || category !== 'all') ? renderSortRow(sortOptions) : null}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Fondu d'apparition de l'accueil (montage après connexion) :
          l'interface se révèle doucement au lieu de « claquer ». */}
      <Animated.View entering={FadeIn.duration(420)} style={{ flex: 1 }}>
      {showProductGrid ? (
        <FlatList
          ref={flatListRef}
          data={displayProducts}
          key={`grid-${category}-${searchActive ? debouncedSearch : 'feed'}`}
          numColumns={isDesktop ? DESKTOP_GRID_COLUMNS : 2}
          keyExtractor={(p) => `${p.kind || 'p'}-${p.id}`}
          renderItem={renderProduct}
          columnWrapperStyle={isDesktop ? styles.gridRowDesktop : styles.gridRow}
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
            paddingTop: headerHeight,
            paddingHorizontal: isDesktop ? DESKTOP_H_PAD : H_PAD,
            paddingBottom: isDesktop ? 24 : TAB_BAR_CONTENT_PADDING_BOTTOM + insets.bottom,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              progressViewOffset={headerHeight}
            />
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
          ref={scrollViewRef}
          contentContainerStyle={{
            paddingTop: headerHeight,
            paddingHorizontal: isDesktop ? DESKTOP_H_PAD : H_PAD,
            paddingBottom: isDesktop ? 24 : TAB_BAR_CONTENT_PADDING_BOTTOM + insets.bottom,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              progressViewOffset={headerHeight}
            />
          }
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          {listHeader}
        </ScrollView>
      )}
      </Animated.View>

      {/* ── En-tête fixe (recherche + filtres) : toujours visible ── */}
      {/* Fond plein : le contenu qui défile dessous est recouvert proprement,
          sans effet de flou ni de transparence. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.fixedHeader,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeaderHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
        }}>
        {fixedHeaderContent}
      </View>

      {/* Back to top — positionné bien AU-DESSUS de la barre d'onglets pour
          ne jamais être recouvert. La barre mesure ~73px hors insets
          (paddingTop 7 + icône 42 + libellé ~14 + padding gestes 10) :
          bottom = insets + 96 garantit ~23px de marge, même avec une taille
          de texte agrandie. Un bottom plus bas (82) le faisait glisser sous
          le menu sur certains appareils. */}
      {showBackToTop ? (
        <Pressable
          style={[
            styles.backToTop,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: isDesktop ? 24 : Math.max(insets.bottom, 10) + 96,
            },
          ]}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={12}>
          {/* Icône vectorielle (le glyphe texte « ↑ » s'affichait « ij » sur
              certains appareils dont la police système ne le contient pas). */}
          <ArrowUp size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
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
  headerWrapDesktop: { gap: 16, marginBottom: 12 },

  // En-tête fixe (top bar + recherche + filtres) : toujours visible,
  // fond plein + fine bordure basse pour une séparation propre (pas flottant).
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 4,
    paddingBottom: 10,
  },
  fixedHeaderContent: {
    maxWidth: DESKTOP_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  fixedHeaderInner: { gap: 12 },

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
  filterChipTxt: { fontSize: 13, fontWeight: '500', textTransform: 'lowercase' },

  // Sort
  sortRowWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
    marginBottom: 10,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipTxt: { fontSize: 12, fontWeight: '500' },

  // Sections
  section: { gap: 0 },
  sectionDesktop: { marginTop: 8 },
  sectionDividerDesktop: {
    height: 1,
    backgroundColor: '#E8F2EC',
    marginVertical: 20,
  },
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
  sectionTitleDesktop: {
    fontSize: 20,
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
  sectionSeeAllTxtDesktop: {
    fontSize: 14,
  },

  // Desktop welcome zone
  desktopWelcomeZone: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  desktopWelcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  desktopWelcomeSub: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 4,
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
    borderWidth: 1,
  },
  enterpriseCardDesktop: {
    width: 160,
    paddingBottom: 12,
  },
  enterpriseCardImg: {
    width: 120,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  enterpriseCardImgDesktop: {
    width: 160,
    height: 110,
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
  entRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
    paddingHorizontal: 8,
  },
  enterpriseCardRating: { fontSize: 11, fontWeight: '700' },
  enterpriseCardRatingAvis: { fontSize: 11, fontWeight: '500' },

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

  // Enterprise grid (desktop)
  entGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  entGridCard: {
    flex: 1,
    minWidth: 280,
    maxWidth: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  entGridCardImg: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  entGridCardBody: {
    padding: 12,
    gap: 4,
  },
  entGridCardName: { fontSize: 14, fontWeight: '700' },
  entGridCardMeta: { fontSize: 12 },

  // Premium product card (2-col grid → 4-col on desktop)
  premiumCard: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  premiumCardImg: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  premiumCardImgDesktop: {
    aspectRatio: 4 / 3,
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
  premiumCardBodyDesktop: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
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
  premiumCardAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
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
  premiumCardPriceDesktop: {
    fontSize: 15,
  },
  premiumCardOldPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },

  // Grid — maxWidth : quand il reste un seul produit sur la dernière rangée,
  // la carte garde la même taille que les autres (pas de carte pleine largeur).
  gridRow: { gap: 10, marginBottom: 10 },
  gridRowDesktop: { gap: 16, marginBottom: 16 },
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


  // Back to top
  backToTop: {
    position: 'absolute',
    right: 16,
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
