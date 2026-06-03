import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Heart,
  Search,
  ShoppingBag,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
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
import { fetchAuthMe } from '@/lib/client-data';
import { fetchProductFeed, type ProductPublic } from '@/lib/catalog';
import { resolveRemoteImageUrl } from '@/lib/images';
import { formatFcfa } from '@/lib/format';
import { isFavoriteProduct, toggleFavoriteProduct } from '@/lib/favorites';
import { getEffectiveUnitPrice } from '@/lib/product-promo';

const PAGE_SIZE = 30;
const SCREEN_PADDING = 16;
const GRID_GAP = 12;

const FILTERS: { key: 'all' | 'plat' | 'article' | 'promo'; label: string; Icon: typeof Store }[] = [
  { key: 'all', label: 'Tout', Icon: ShoppingBag },
  { key: 'plat', label: 'Plats', Icon: UtensilsCrossed },
  { key: 'article', label: 'Articles', Icon: ShoppingBasket },
  { key: 'promo', label: 'Promos', Icon: Tag },
];

type Me = {
  id: string;
  nom: string | null;
  telephone: string;
  image_url?: string | null;
  imageUrl?: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { unreadCount } = useUnreadNotifications();
  const { heroOrder, isLoading: loadingOrders, refetch: refetchOrders } = useActiveOrders();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'plat' | 'article' | 'promo'>('all');
  const [me, setMe] = useState<Me | null>(null);
  const [products, setProducts] = useState<ProductPublic[]>([]);
  const [favProductKeys, setFavProductKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Charge le profil user
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const token = await getSessionToken();
        if (!token) return;
        const data = await fetchAuthMe(token);
        if (alive) setMe(data as Me);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadFavorites = useCallback(async (items: ProductPublic[]) => {
    if (items.length === 0) {
      setFavProductKeys(new Set());
      return;
    }
    const token = await getSessionToken();
    if (!token) return;
    // On charge en parallele, on garde seulement ceux qui matchent les items affiches.
    const checks = await Promise.all(
      items.map(async (p) => {
        const k = (p.kind === 'article' ? 'article' : 'plat') + ':' + p.id;
        try {
          return { k, fav: await isFavoriteProduct(p.id, p.kind === 'article' ? 'article' : 'plat') };
        } catch {
          return { k, fav: false };
        }
      }),
    );
    setFavProductKeys((prev) => {
      const next = new Set(prev);
      for (const { k, fav } of checks) {
        if (fav) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }, []);

  const loadFeed = useCallback(
    async (reset = true) => {
      setError(null);
      if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const params: Parameters<typeof fetchProductFeed>[0] = {
          limit: PAGE_SIZE,
          offset: reset ? 0 : offset,
        };
        if (filter === 'plat') params.type = 'plat';
        if (filter === 'article') params.type = 'article';
        if (filter === 'promo') params.promo = true;
        const data = await fetchProductFeed(params);
        if (reset) {
          setProducts(data);
        } else {
          setProducts((prev) => [...prev, ...data]);
        }
        setHasMore(data.length >= PAGE_SIZE);
        setOffset((reset ? 0 : offset) + data.length);
        void loadFavorites(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Impossible de charger les produits.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [filter, offset, loadFavorites],
  );

  useEffect(() => {
    void loadFeed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void refetchOrders();
    }, [refetchOrders]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFeed(true);
  }, [loadFeed]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    void loadFeed(false);
  }, [loadingMore, hasMore, loading, loadFeed]);

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

  const onPressProduct = useCallback(
    (p: ProductPublic) => {
      const kind = p.kind === 'article' ? 'article' : 'plat';
      router.push(`/(tabs)/product/${p.id}?kind=${kind}` as never);
    },
    [router],
  );

  const firstName = me?.nom?.split(' ')[0] || 'Bienvenue';

  const renderItem: ListRenderItem<ProductPublic> = useCallback(
    ({ item, index }) => (
      <ProductCard
        product={item}
        onPress={() => onPressProduct(item)}
        isFav={favProductKeys.has(`${item.kind === 'article' ? 'article' : 'plat'}:${item.id}`)}
        onToggleFav={() => void onToggleFav(item)}
        leftInRow={index % 2 === 0}
      />
    ),
    [favProductKeys, onPressProduct, onToggleFav],
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={products}
        keyExtractor={(p) => `${p.kind || 'p'}-${p.id}`}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnRow}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_CONTENT_PADDING_BOTTOM + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            {/* TOP BAR */}
            <View style={[styles.topBar, { marginTop: Math.max(insets.top, 12) }]}>
              <View style={styles.topBarLeft}>
                <ThemedText style={[styles.greeting, { color: colors.textMuted }]}>
                  Bonjour 👋
                </ThemedText>
                <ThemedText style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {firstName}
                </ThemedText>
              </View>
              <View style={styles.topBarRight}>
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push('/notifications')}
                  hitSlop={8}
                  accessibilityLabel="Notifications">
                  <Bell size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
                  {unreadCount > 0 ? (
                    <View style={[styles.notifDot, { backgroundColor: colors.error, borderColor: colors.background }]}>
                      <ThemedText style={styles.notifDotTxt}>
                        {unreadCount > 9 ? '9+' : String(unreadCount)}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>

            {/* SEARCH */}
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Search size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher un plat, un article…"
                placeholderTextColor={colors.placeholder}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              <Pressable
                style={[styles.filterTap, { backgroundColor: colors.primarySoft }]}
                onPress={() => router.push('/(tabs)/marketplace')}
                hitSlop={8}
                accessibilityLabel="Voir les commerces">
                <SlidersHorizontal size={16} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            </View>

            {/* SHINE BANNER */}
            <View style={[styles.shineBanner, { backgroundColor: colors.primaryDeep }]}>
              <View style={[styles.shineIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Zap size={14} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} fill={colors.onPrimary} />
              </View>
              <ThemedText style={[styles.shineTitle, { color: colors.onPrimary }]} numberOfLines={1}>
                Livraison express · moins d'une heure
              </ThemedText>
              <Sparkles size={16} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
            </View>

            {/* ACTIVE ORDER WIDGET */}
            {!loadingOrders && heroOrder ? (
              <View style={{ marginTop: 14 }}>
                <HomeActiveOrderWidget order={heroOrder} />
              </View>
            ) : null}

            {/* FILTER CHIPS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}>
                    <f.Icon
                      size={14}
                      color={active ? colors.onPrimary : colors.text}
                      strokeWidth={LUCIDE_STROKE}
                    />
                    <ThemedText
                      style={[
                        styles.chipTxt,
                        { color: active ? colors.onPrimary : colors.text },
                      ]}>
                      {f.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* SECTION TITLE */}
            <View style={styles.sectionHead}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                {filter === 'promo'
                  ? '🔥 Bonnes affaires'
                  : filter === 'plat'
                    ? '🍽️ Plats du moment'
                    : filter === 'article'
                      ? '🛍️ Articles populaires'
                      : '✨ Pour vous'}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/(tabs)/marketplace')}
                hitSlop={8}
                accessibilityLabel="Voir tous les commerces">
                <ThemedText style={[styles.seeAll, { color: colors.primary }]}>
                  Commerces
                </ThemedText>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator color={colors.primary} />
              <ThemedText style={[styles.loaderText, { color: colors.textMuted }]}>
                Chargement des produits…
              </ThemedText>
            </View>
          ) : error ? (
            <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <ThemedText style={[styles.warnTitle, { color: colors.text }]}>Oups</ThemedText>
              <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>{error}</ThemedText>
              <Pressable
                style={[styles.warnBtn, { backgroundColor: colors.primary }]}
                onPress={() => void loadFeed(true)}>
                <ThemedText style={[styles.warnBtnText, { color: colors.onPrimary }]}>
                  Réessayer
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.warnCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <ThemedText style={[styles.warnTitle, { color: colors.text }]}>
                Aucun produit
              </ThemedText>
              <ThemedText style={[styles.warnBody, { color: colors.textMuted }]}>
                Aucun {filter === 'plat' ? 'plat' : filter === 'article' ? 'article' : 'produit'} disponible pour le moment.
              </ThemedText>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS !== 'web'}
        windowSize={7}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

type ProductCardProps = {
  product: ProductPublic;
  onPress: () => void;
  onToggleFav: () => void;
  isFav: boolean;
  leftInRow: boolean;
};

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - SCREEN_PADDING * 2 - GRID_GAP) / 2;

function ProductCard({ product, onPress, onToggleFav, isFav, leftInRow }: ProductCardProps) {
  const colors = useAppColors();
  const kind: 'plat' | 'article' = product.kind === 'article' ? 'article' : 'plat';
  const basePrice = Number(getEffectiveUnitPrice(product) ?? product.prix ?? 0);
  const isPromo = product.prix_promo != null && Number(product.prix_promo) < Number(product.prix);
  const fallbackImage =
    Array.isArray(product.images_urls) && product.images_urls.length > 0
      ? product.images_urls[0]
      : null;
  const imageUrl = product.image_url || fallbackImage || null;
  const image = resolveRemoteImageUrl(imageUrl);
  const VendorIcon = kind === 'article' ? Store : UtensilsCrossed;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          width: cardWidth,
          marginLeft: leftInRow ? 0 : GRID_GAP,
        },
      ]}>
      <View style={[styles.cardImageWrap, { backgroundColor: colors.primarySoft }]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <VendorIcon size={32} color={colors.primary} strokeWidth={1.2} />
        )}
        {isPromo ? (
          <View style={[styles.promoBadge, { backgroundColor: colors.error }]}>
            <ThemedText style={styles.promoBadgeTxt}>PROMO</ThemedText>
          </View>
        ) : null}
        <Pressable
          style={[styles.cardFavBtn, { backgroundColor: colors.surface }]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          hitSlop={6}
          accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          <Heart
            size={14}
            color={isFav ? colors.error : colors.textMuted}
            fill={isFav ? colors.error : 'none'}
            strokeWidth={LUCIDE_STROKE}
          />
        </Pressable>
      </View>
      <View style={styles.cardBody}>
        <ThemedText style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
          {product.nom || 'Produit'}
        </ThemedText>
        {isPromo ? (
          <View style={styles.cardPriceRow}>
            <ThemedText style={[styles.cardPrice, { color: colors.primary }]}>
              {formatFcfa(Number(product.prix_promo))}
            </ThemedText>
            <ThemedText style={[styles.cardOldPrice, { color: colors.textMuted }]}>
              {formatFcfa(Number(product.prix))}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={[styles.cardPrice, { color: colors.text }]}>
            {formatFcfa(basePrice)}
          </ThemedText>
        )}
        {product.enterprise_nom ? (
          <ThemedText style={[styles.cardVendor, { color: colors.textMuted }]} numberOfLines={1}>
            {product.enterprise_nom}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
  },
  headerWrap: { gap: 12, marginBottom: 8 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topBarLeft: { flex: 1, gap: 2, marginRight: 8 },
  greeting: { fontSize: 13 },
  userName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  filterTap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  shineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shineTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  filterRow: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  seeAll: { fontSize: 13, fontWeight: '700' },
  columnRow: { gap: 0, marginBottom: GRID_GAP },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardImageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImage: { width: '100%', height: '100%' },
  cardFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoBadgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  cardBody: { padding: 10, gap: 4 },
  cardName: { fontSize: 13, fontWeight: '700', minHeight: 32 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardPrice: { fontSize: 14, fontWeight: '800' },
  cardOldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
  cardVendor: { fontSize: 11, marginTop: 2 },
  loaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  loaderText: { fontSize: 13 },
  warnCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  warnTitle: { fontSize: 14, fontWeight: '700' },
  warnBody: { fontSize: 12 },
  warnBtn: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  warnBtnText: { fontWeight: '800', fontSize: 13 },
  footerLoader: { padding: 16, alignItems: 'center' },
});
