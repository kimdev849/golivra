import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {
  ChevronRight,
  Heart,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ListingCard } from '@/components/listing-card';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import { fetchAllEnterprises, peekAllEnterprises } from '@/lib/client-data';
import { fetchProductFeed } from '@/lib/catalog';
import {
  getFavoriteEnterpriseIds,
  getFavoriteEnterpriseIdsLocal,
  getFavoriteProducts,
  getFavoriteProductsLocal,
  toggleFavoriteProduct,
  type FavoriteProductRef,
} from '@/lib/favorites';
import { resolveRemoteImageUrl } from '@/lib/images';
import { productDetailHref } from '@/lib/listing-utils';
import { useAppColors } from '@/hooks/use-app-colors';

type TabKey = 'commerces' | 'produits';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [tab, setTab] = useState<TabKey>('commerces');

  // Commerces
  const [enterprises, setEnterprises] = useState<EnterprisePublic[]>([]);
  const [loadingEnt, setLoadingEnt] = useState(true);
  const [refreshingEnt, setRefreshingEnt] = useState(false);
  const [errorEnt, setErrorEnt] = useState<string | null>(null);
  const [favoriteEntIds, setFavoriteEntIds] = useState<string[]>([]);

  // Produits
  const [favProductRefs, setFavProductRefs] = useState<FavoriteProductRef[]>([]);
  const [favProducts, setFavProducts] = useState<ProductPublic[]>([]);
  const [loadingProd, setLoadingProd] = useState(true);
  const [refreshingProd, setRefreshingProd] = useState(false);
  const [errorProd, setErrorProd] = useState<string | null>(null);

  const isDesktop = useIsWebDesktop();
  const bottomPad = isDesktop ? 24 : Math.max(insets.bottom, 16) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  // Garde d'instance : ignore les réponses d'un chargement obsolète si un
  // nouveau chargement a démarré entre-temps (pull-to-refresh + focus).
  const loadGen = useRef(0);

  const loadEnterprises = useCallback(async (force = false) => {
    const gen = ++loadGen.current;
    setErrorEnt(null);
    // 1) Affichage instantané : favoris locaux + catalogue en cache.
    const localIds = await getFavoriteEnterpriseIdsLocal();
    setFavoriteEntIds(localIds);
    const cached = peekAllEnterprises();
    const cachedSet = new Set(localIds);
    if (localIds.length === 0) setEnterprises([]);
    else if (cached?.length) setEnterprises(cached.filter((e) => cachedSet.has(e.id)));
    setLoadingEnt(false);
    // 2) Rafraîchissement réseau en arrière-plan.
    try {
      const ids = await getFavoriteEnterpriseIds();
      if (gen !== loadGen.current) return;
      setFavoriteEntIds(ids);
      if (ids.length === 0) {
        setEnterprises([]);
        setRefreshingEnt(false);
        return;
      }
      const data = await fetchAllEnterprises(force);
      if (gen !== loadGen.current) return;
      const idSet = new Set(ids);
      setEnterprises(data.filter((e) => idSet.has(e.id)));
    } catch (e) {
      if (gen === loadGen.current && localIds.length === 0) {
        setErrorEnt(e instanceof Error ? e.message : 'Impossible de charger les favoris.');
      }
    } finally {
      if (gen === loadGen.current) setRefreshingEnt(false);
    }
  }, []);

  const loadProducts = useCallback(async (force = false) => {
    const gen = ++loadGen.current;
    setErrorProd(null);
    // 1) Affichage instantané : favoris produits locaux.
    const localRefs = await getFavoriteProductsLocal();
    setFavProductRefs(localRefs);
    if (localRefs.length === 0) setFavProducts([]);
    setLoadingProd(false);
    // 2) Rafraîchissement réseau en arrière-plan.
    try {
      const refs = await getFavoriteProducts();
      if (gen !== loadGen.current) return;
      setFavProductRefs(refs);
      if (refs.length === 0) {
        setFavProducts([]);
        setRefreshingProd(false);
        return;
      }
      // Charge les 2 feeds en parallele.
      const [plats, articles] = await Promise.all([
        fetchProductFeed({ type: 'plat', limit: 100, offset: 0 }),
        fetchProductFeed({ type: 'article', limit: 100, offset: 0 }),
      ]);
      if (gen !== loadGen.current) return;
      const refSet = new Set(refs.map((r) => `${r.produit_kind}:${r.produit_id}`));
      const merged = [...plats, ...articles].filter((p) => {
        const kind: 'plat' | 'article' = p.kind === 'article' ? 'article' : 'plat';
        return refSet.has(`${kind}:${p.id}`);
      });
      // Tri par date de favoris (created_at) si possible, sinon ordre d'origine.
      const orderMap = new Map(refs.map((r, i) => [`${r.produit_kind}:${r.produit_id}`, i]));
      merged.sort((a, b) => {
        const ka = `${a.kind === 'article' ? 'article' : 'plat'}:${a.id}`;
        const kb = `${b.kind === 'article' ? 'article' : 'plat'}:${b.id}`;
        return (orderMap.get(ka) ?? 0) - (orderMap.get(kb) ?? 0);
      });
      setFavProducts(merged);
      void force; // force non utilise ici (pas de cache dedie produits)
    } catch (e) {
      if (gen === loadGen.current && localRefs.length === 0) {
        setErrorProd(e instanceof Error ? e.message : 'Impossible de charger les favoris produits.');
      }
    } finally {
      if (gen === loadGen.current) setRefreshingProd(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEnterprises();
      void loadProducts();
    }, [loadEnterprises, loadProducts]),
  );

  const onRefreshEnt = () => {
    setRefreshingEnt(true);
    void loadEnterprises(true);
  };

  const onRefreshProd = () => {
    setRefreshingProd(true);
    void loadProducts(true);
  };

  const onUnfavProduct = async (p: ProductPublic) => {
    const kind: 'plat' | 'article' = p.kind === 'article' ? 'article' : 'plat';
    setFavProducts((prev) => prev.filter((x) => x.id !== p.id));
    setFavProductRefs((prev) =>
      prev.filter((r) => !(r.produit_id === p.id && r.produit_kind === kind)),
    );
    try {
      await toggleFavoriteProduct(p.id, kind);
    } catch {
      // Revert en cas d'erreur
      setFavProducts((prev) => [p, ...prev]);
      setFavProductRefs((prev) => [...prev, { produit_id: p.id, produit_kind: kind }]);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.head, {
        paddingTop: Math.max(insets.top, 14),
        paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
        maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
        alignSelf: isDesktop ? 'center' : undefined,
        width: isDesktop ? '100%' : undefined,
      }]}>
        <ThemedText type="title" style={[styles.title, { color: colors.primaryDeep }]}>
          Favoris
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Commerces et produits que vous avez enregistrés.
        </ThemedText>

        {/* TABS */}
        <View style={[styles.tabsWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {(['commerces', 'produits'] as TabKey[]).map((k) => {
            const active = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.surface },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}>
                <ThemedText
                  style={[
                    styles.tabTxt,
                    { color: active ? colors.text : colors.textMuted },
                    active && { fontWeight: '800' },
                  ]}>
                  {k === 'commerces' ? 'Commerces' : 'Produits'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'commerces' ? (        <FlatList
          key="favorites-enterprises"
          data={enterprises}
          keyExtractor={(item) => `ent-${item.id}`}
          numColumns={isDesktop ? 3 : 1}
          columnWrapperStyle={isDesktop ? { gap: 12, marginBottom: 12 } : undefined}
          contentContainerStyle={[styles.list, {
            paddingBottom: bottomPad,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
          }]} 
          ListEmptyComponent={
            loadingEnt ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement…</ThemedText>
              </View>
            ) : errorEnt ? (
              <StateCard
                title="Oups"
                body={errorEnt}
                ctaLabel="Réessayer"
                onCta={() => void loadEnterprises(true)}
                colors={colors}
              />
            ) : favoriteEntIds.length === 0 ? (
              <StateCard
                icon={<Heart size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                title="Aucun commerce favori"
                body="Touchez le cœur sur un commerce dans l'accueil pour le retrouver ici."
                ctaLabel="Retour à l'accueil"
                onCta={() => router.navigate('/(tabs)')}
                colors={colors}
              />
            ) : (
              <StateCard
                title="Commerces indisponibles"
                body="Ces commerces ne sont plus listés comme ouverts."
                ctaLabel="Actualiser"
                onCta={onRefreshEnt}
                colors={colors}
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshingEnt} onRefresh={onRefreshEnt} tintColor={colors.primary} />
          }
          renderItem={({ item }) => {
            const img = resolveRemoteImageUrl(item.image_url, { width: 300, format: 'webp', quality: 75 });
            if (isDesktop) {
              return (
                <Pressable
                  style={[styles.entGridCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/marketplace/${item.id}`)}>
                  <View style={[styles.entGridImg, { backgroundColor: colors.primarySoft }]}>
                    {img ? (
                      <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
                    ) : (
                      item.type === 'restaurant' ? <UtensilsCrossed size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      : <Store size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    )}
                  </View>
                  <View style={styles.entCardBody}>
                    <ThemedText type="defaultSemiBold" style={[styles.entCardName, { color: colors.text }]} numberOfLines={1}>
                      {item.nom ?? 'Commerce'}
                    </ThemedText>
                    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                      <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                        {item.type === 'restaurant' ? 'Restaurant' : 'Boutique'}
                      </ThemedText>
                    </View>
                    {item.adresse ? (
                      <ThemedText style={[styles.rowAddr, { color: colors.textMuted }]} numberOfLines={1}>
                        {item.adresse}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            }
            return (
              <Pressable
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => router.push(`/marketplace/${item.id}`)}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.thumbWrap, { backgroundColor: colors.primarySoft }]}>
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={styles.thumb}
                      contentFit="cover"
                      transition={150}
                      recyclingKey={img}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPh]}>
                      {item.type === 'restaurant' ? (
                        <UtensilsCrossed size={30} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      ) : (
                        <Store size={30} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      )}
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.nom ?? 'Commerce'}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                    <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                      {item.type === 'restaurant' ? 'Restaurant' : 'Boutique'}
                    </ThemedText>
                  </View>
                  {item.adresse ? (
                    <ThemedText style={[styles.rowAddr, { color: colors.textMuted }]} numberOfLines={2}>
                      {item.adresse}
                    </ThemedText>
                  ) : null}
                </View>
                <ChevronRight size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          key="favorites-products"
          data={favProducts}
          keyExtractor={(item) => `p-${item.kind}-${item.id}`}
          contentContainerStyle={[styles.list, {
            paddingBottom: bottomPad,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
          }]}
          ListEmptyComponent={
            loadingProd ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement…</ThemedText>
              </View>
            ) : errorProd ? (
              <StateCard
                title="Oups"
                body={errorProd}
                ctaLabel="Réessayer"
                onCta={() => void loadProducts(true)}
                colors={colors}
              />
            ) : favProductRefs.length === 0 ? (
              <StateCard
                icon={<Heart size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
                title="Aucun produit favori"
                body="Touchez le cœur sur un produit dans l'accueil pour le retrouver ici."
                ctaLabel="Retour à l'accueil"
                onCta={() => router.navigate('/(tabs)')}
                colors={colors}
              />
            ) : (
              <StateCard
                title="Produits indisponibles"
                body="Ces produits ne sont plus listés. Ils ont peut-être été retirés par le vendeur."
                ctaLabel="Actualiser"
                onCta={onRefreshProd}
                colors={colors}
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshingProd} onRefresh={onRefreshProd} tintColor={colors.primary} />
          }
          numColumns={isDesktop ? 4 : 1}
          columnWrapperStyle={isDesktop ? { gap: 12, marginBottom: 12 } : undefined}
          renderItem={({ item }) => (
            <View style={isDesktop ? { flex: 1, maxWidth: '25%' } : undefined}>
              <ListingCard
                product={item}
                variant={isDesktop ? 'grid' : 'feed'}
                onPress={() => router.push(productDetailHref(item) as never)}
                isFav
                onToggleFav={() => void onUnfavProduct(item)}
              />
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

type StateCardProps = {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  icon?: React.ReactNode;
  colors: ReturnType<typeof useAppColors>;
};

function StateCard({ title, body, ctaLabel, onCta, icon, colors }: StateCardProps) {
  return (
    <View style={[styles.stateCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {icon ? (
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          {icon}
        </View>
      ) : null}
      <ThemedText style={[styles.stateTitle, { color: colors.primaryDeep }]}>{title}</ThemedText>
      <ThemedText style={[styles.stateBody, { color: colors.textMuted }]}>{body}</ThemedText>
      <Pressable style={[styles.retry, { backgroundColor: colors.primary }]} onPress={onCta}>
        <ThemedText style={[styles.retryText, { color: colors.surface }]}>{ctaLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, marginBottom: 14, gap: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22, opacity: 0.92 },
  tabsWrap: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabTxt: { fontSize: 14, fontWeight: '700' },
  list: { flexGrow: 1, gap: 14 },
  center: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  muted: { fontSize: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  rowAddr: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  stateCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    gap: 12,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: { fontWeight: '800' },
  // Desktop enterprise grid card
  entGridCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  entGridImg: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  entCardBody: { padding: 12, gap: 4 },
  entCardName: { fontSize: 14, fontWeight: '700' },
  // Product grid
  gridRow: { gap: 0, marginBottom: 10 },
  productCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  productImgWrap: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImg: { width: '100%', height: '100%' },
  productFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBody: { padding: 10, gap: 4 },
  productName: { fontSize: 13, fontWeight: '700', minHeight: 32 },
  productPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  productPrice: { fontSize: 14, fontWeight: '800' },
  productOldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
});
