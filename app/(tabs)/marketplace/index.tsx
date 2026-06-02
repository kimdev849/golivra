import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ChevronRight,
  Clock,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';

import { ProductPrice } from '@/components/product-price';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { brandGradient3 } from '@/constants/app-palette';
import { createMarketplaceStyles } from '@/constants/marketplace-screen-styles';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useAppColors } from '@/hooks/use-app-colors';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import { fetchProductsForEnterprise } from '@/lib/catalog';
import { isProductOrderable } from '@/lib/product-stock';
import { resolveProductPricing } from '@/lib/product-promo';
import { formatFcfa } from '@/lib/format';
import { resolveRemoteImageUrl } from '@/lib/images';
import {
  DEFAULT_PUBLIC_PRICING,
  displayDeliveryFeeFcfa,
  fetchPublicPricing,
} from '@/lib/pricing';
import { accentForEnterpriseCategory, iconForEnterpriseCategory } from '@/lib/marketplace-categories';
import { friendlyErrorMessage } from '@/lib/ux-copy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEnterprises, useEnterpriseCategories } from '@/hooks/useMarketplace';

type Segment = 'restaurant' | 'boutique';

function deliveryRange(ent: EnterprisePublic): string {
  const min =
    ent.type === 'restaurant'
      ? ent.delai_preparation_min ?? 20
      : ent.delai_livraison_min ?? 30;
  return `${min}–${min + 10} min`;
}

function formatRatingLabel(ent: EnterprisePublic): string | null {
  const nb = ent.nb_avis ?? 0;
  if (nb <= 0) return null;
  const note = ent.note_moyenne ?? 0;
  if (note <= 0) return null;
  const avisLabel = nb === 1 ? '1 avis' : `${nb} avis`;
  return `${note.toFixed(1)} (${avisLabel})`;
}

export default function MarketplaceListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { gridColumns, contentWidth, isTablet } = useResponsiveLayout();
  const params = useLocalSearchParams<{ q?: string; type?: string }>();
  const colors = useAppColors();
  const styles = useThemedStyles(createMarketplaceStyles);
  const offerGradient = brandGradient3(colors);

  const [segment, setSegment] = useState<Segment>('restaurant');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [popularProducts, setPopularProducts] = useState<ProductPublic[]>([]);

  useEffect(() => {
    const q = typeof params.q === 'string' ? params.q : '';
    if (q) setQuery(q);
    const t = typeof params.type === 'string' ? params.type : '';
    if (t === 'restaurant' || t === 'boutique') {
      setSegment(t);
      setCategoryId(null);
    }
  }, [params.q, params.type]);

  // -- Data Fetching avec React Query --
  const { data: pricing } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => fetchPublicPricing(false),
    staleTime: 1000 * 60 * 60, // 1h
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useEnterpriseCategories(segment);
  const { data: items = [], isLoading: isLoadingEnterprises, error, refetch, isRefetching } = useEnterprises(segment);

  const filteredEnterprises = useMemo(() => {
    let list = items;
    if (categoryId) {
      list = list.filter((e) => e.categorie_id === categoryId);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (it) =>
        (it.nom ?? '').toLowerCase().includes(q) ||
        (it.adresse ?? '').toLowerCase().includes(q) ||
        (it.description ?? '').toLowerCase().includes(q) ||
        (it.categorie_nom ?? '').toLowerCase().includes(q)
    );
  }, [items, query, categoryId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const slice = items.slice(0, 4);
      if (slice.length === 0) {
        setPopularProducts([]);
        return;
      }
      try {
        const batches = await Promise.all(slice.map((e) => fetchProductsForEnterprise(e.id).catch(() => [])));
        if (cancelled) return;
        const flat = batches.flat().filter((p) => isProductOrderable(p));
        setPopularProducts(flat.slice(0, 8));
      } catch {
        if (!cancelled) setPopularProducts([]);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;
  const gridGap = 10;
  const gridPad = isTablet ? Math.max(24, (width - contentWidth) / 2) + 20 : 20;
  const gridCol = (Math.min(width, contentWidth) - gridPad * 2 - gridGap * (gridColumns - 1)) / gridColumns;

  const renderHeader = () => (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Restaurants | Boutiques */}
      <View style={styles.segmentWrap}>
        <Pressable
          style={[styles.segmentBtn, segment === 'restaurant' && styles.segmentBtnOn]}
          onPress={() => {
            setSegment('restaurant');
            setCategoryId(null);
          }}>
          <UtensilsCrossed
            size={18}
            color={segment === 'restaurant' ? colors.onPrimary : colors.primary}
            strokeWidth={LUCIDE_STROKE}
          />
          <ThemedText style={[styles.segmentLabel, segment === 'restaurant' && styles.segmentLabelOn]}>
            Restaurants
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === 'boutique' && styles.segmentBtnOn]}
          onPress={() => {
            setSegment('boutique');
            setCategoryId(null);
          }}>
          <Store
            size={18}
            color={segment === 'boutique' ? colors.onPrimary : colors.primary}
            strokeWidth={LUCIDE_STROKE}
          />
          <ThemedText style={[styles.segmentLabel, segment === 'boutique' && styles.segmentLabelOn]}>Boutiques</ThemedText>
        </Pressable>
      </View>

      {(isLoadingEnterprises || isLoadingCategories) && items.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Chargement…</ThemedText>
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.errorCard}>
          <ThemedText style={styles.errorTitle}>{friendlyErrorMessage(error, 'Impossible de charger les données.')}</ThemedText>
          <Pressable style={styles.retryBtn} onPress={onRefresh}>
            <ThemedText style={styles.retryText}>Réessayer</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Catégories */}
          <View style={styles.sectionHead}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              {segment === 'restaurant' ? 'Catégories restaurants' : 'Catégories boutiques'}
            </ThemedText>
            <Pressable hitSlop={10} onPress={() => setCategoryId(null)}>
              <ThemedText style={styles.seeAll}>Voir tout</ThemedText>
            </Pressable>
          </View>
          {categories.length === 0 ? (
            <ThemedText style={styles.catEmpty}>Aucune catégorie disponible pour le moment.</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
              {categories.map((c) => {
                const on = categoryId === c.id;
                const CatIcon = iconForEnterpriseCategory(c.nom, segment);
                const accent = accentForEnterpriseCategory(c.nom, segment);
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.catItem, on && styles.catItemOn]}
                    onPress={() => setCategoryId((prev) => (prev === c.id ? null : c.id))}>
                    <View
                      style={[
                        styles.catIconWrap,
                        { backgroundColor: `${accent}18` },
                        on && { borderWidth: 2, borderColor: colors.primary },
                      ]}>
                      <CatIcon size={22} color={on ? colors.primary : accent} strokeWidth={LUCIDE_STROKE} />
                    </View>
                    <ThemedText style={[styles.catCaption, on && styles.catLabelOn]} numberOfLines={2}>
                      {c.nom}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Title before FlashList items */}
          <View style={styles.sectionHead}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              {segment === 'restaurant' ? 'Restaurants populaires' : 'Boutiques populaires'}
            </ThemedText>
          </View>
          {filteredEnterprises.length === 0 ? (
            <View style={styles.emptyHint}>
              <ThemedText style={styles.emptyHintText}>Aucun commerce dans cette sélection.</ThemedText>
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const renderFooter = () => {
    if (isLoadingEnterprises || error || items.length === 0) return null;
    return (
      <View style={{ paddingHorizontal: 20 }}>
        {/* Plats / Produits */}
        <View style={styles.sectionHead}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {segment === 'restaurant' ? 'Plats populaires' : 'Produits populaires'}
          </ThemedText>
        </View>
        {popularProducts.length === 0 ? (
          <View style={styles.emptyHint}>
            <ThemedText style={styles.emptyHintText}>
              Les articles mis en avant apparaîtront quand les commerces publient des produits.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {popularProducts.map((p) => {
              const img = resolveRemoteImageUrl(p.image_url);
              const onPromo = resolveProductPricing(p).promoActive;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.productCard, { width: gridCol }]}
                  onPress={() => router.push(`/(tabs)/marketplace/${p.entreprise_id}`)}>
                  <View style={[styles.productImgWrap, { width: '100%' }]}>
                    {onPromo ? (
                      <View style={[styles.promoRibbon, { backgroundColor: colors.success }]}>
                        <ThemedText style={[styles.promoRibbonText, { color: colors.onPrimary }]}>
                          Promo
                        </ThemedText>
                      </View>
                    ) : null}
                    {img ? (
                      <Image
                        source={{ uri: img }}
                        style={styles.productImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        recyclingKey={p.id}
                        transition={80}
                      />
                    ) : (
                      <View style={[styles.productImg, styles.productImgPh]}>
                        <UtensilsCrossed size={32} color={colors.placeholder} strokeWidth={LUCIDE_STROKE} />
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.productName} numberOfLines={2}>
                    {p.nom ?? 'Produit'}
                  </ThemedText>
                  <View style={styles.productPriceWrap}>
                    <ProductPrice product={p} size="sm" showBadge />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Offres */}
        <LinearGradient
          colors={offerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.offerBanner}>
          <Sparkles size={22} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.offerTitle}>Offres du moment</ThemedText>
            <ThemedText style={styles.offerSub}>
              Promotions selon les commerces — jusqu’à -20 % sur une sélection de produits partenaires.
            </ThemedText>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderEnterpriseItem = ({ item: it }: { item: EnterprisePublic }) => {
    const img = resolveRemoteImageUrl(it.image_url);
    const ratingLabel = formatRatingLabel(it);
    const fee = displayDeliveryFeeFcfa(it.frais_livraison, pricing ?? DEFAULT_PUBLIC_PRICING);
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable
          style={({ pressed }) => [styles.popRow, pressed && styles.popRowPressed]}
          onPress={() => router.push(`/(tabs)/marketplace/${it.id}`)}
          android_ripple={{ color: colors.primarySoft }}>
          <View style={styles.popThumb}>
            {img ? (
              <Image
                source={{ uri: img }}
                style={styles.popThumbImg}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={it.id}
                transition={80}
              />
            ) : (
              <View style={[styles.popThumbImg, styles.popThumbPh]}>
                {it.type === 'restaurant' ? (
                  <UtensilsCrossed size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                ) : (
                  <Store size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                )}
              </View>
            )}
          </View>
          <View style={styles.popBody}>
            <ThemedText type="defaultSemiBold" style={styles.popName} numberOfLines={2}>
              {it.nom ?? 'Commerce'}
            </ThemedText>
            <View style={styles.popMetaRow}>
              <Clock size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.popMeta}>{deliveryRange(it)}</ThemedText>
              {ratingLabel ? (
                <>
                  <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={styles.popMeta}>{ratingLabel}</ThemedText>
                </>
              ) : null}
            </View>
            <ThemedText style={styles.popDelivery}>Livraison à partir de {formatFcfa(fee)}</ThemedText>
          </View>
          <ChevronRight size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      </View>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Barre de recherche fixe (toujours visible, jamais cachée par le clavier) */}
      <View
        style={[
          styles.searchRow,
          { paddingHorizontal: 20, paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: 8 },
        ]}>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <TextInput
            style={styles.searchInput}
            placeholder="Restaurant, boutique, produit…"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>
        <Pressable
          style={styles.filterBtn}
          onPress={() =>
            Alert.alert(
              'Filtres',
              'Choisissez une catégorie ci-dessous ou utilisez la barre de recherche pour affiner les résultats.'
            )
          }
          hitSlop={8}>
          <SlidersHorizontal size={22} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        <FlashList
          data={filteredEnterprises.slice(0, 12)}
          renderItem={renderEnterpriseItem}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          refreshing={isRefetching}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
