import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Heart,
  ImageIcon,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenEmptyState, ScreenLoadState } from '@/components/screen-load-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { fetchProductById, trackProductClick, type ProductPublic } from '@/lib/catalog';
import { resolveRemoteImageUrl } from '@/lib/images';
import { getEffectiveUnitPrice } from '@/lib/product-promo';
import { formatFcfa } from '@/lib/format';
import {
  effectiveStockCap,
  isProductOrderable,
  stockDisplayLabel,
} from '@/lib/product-stock';
import { addProductToCartPrompt } from '@/lib/cart-local';
import { isFavoriteProduct, toggleFavoriteProduct } from '@/lib/favorites';

type SelectedOptionChoice = { groupIndex: number; choiceIndex: number };

function computeOptionSupplement(
  groups: ProductPublic['options'] | null | undefined,
  selected: SelectedOptionChoice[],
): number {
  if (!groups || !Array.isArray(groups)) return 0;
  let total = 0;
  for (const s of selected) {
    const g = groups[s.groupIndex];
    const c = g?.choix?.[s.choiceIndex];
    if (c && typeof c.prix_sup === 'number' && Number.isFinite(c.prix_sup)) {
      total += c.prix_sup;
    }
  }
  return total;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();

  const productId = typeof params.id === 'string' ? params.id : '';
  const kindParam = typeof params.kind === 'string' ? params.kind.toLowerCase() : '';
  const kind: 'plat' | 'article' = kindParam === 'article' ? 'article' : 'plat';

  const [product, setProduct] = useState<ProductPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptionChoice[]>([]);
  const [note, setNote] = useState('');

  const load = useCallback(
    async (force = false) => {
      if (!productId) return;
      setError(null);
      if (!force) setLoading(true);
      try {
        const p = await fetchProductById(productId, kind);
        setProduct(p);
        if (p) {
          const fav = await isFavoriteProduct(p.id, kind);
          setIsFav(fav);
          // Track view (fire-and-forget) — on utilise l'endpoint click qui
          // a la meme signature et qui couvre l'ouverture detail.
          void trackProductClick(p.entreprise_id, p.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Produit introuvable.');
      } finally {
        setLoading(false);
      }
    },
    [productId, kind],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const galleryImages = useMemo(() => {
    if (!product) return [] as string[];
    const list: string[] = [];
    if (product.image_url) list.push(product.image_url);
    if (Array.isArray(product.images_urls)) {
      for (const u of product.images_urls) {
        if (u && !list.includes(u)) list.push(u);
      }
    }
    return list;
  }, [product]);

  const basePrice = product ? Number(getEffectiveUnitPrice(product) ?? product.prix ?? 0) : 0;
  const optionSupplement = computeOptionSupplement(product?.options, selectedOptions);
  const unitPrice = basePrice + optionSupplement;
  const totalPrice = unitPrice * Math.max(1, quantity);

  const stockAvailable = product ? effectiveStockCap(product) : 0;
  const orderable = product ? isProductOrderable(product) : false;
  const stockLabel = product ? stockDisplayLabel(product) : '';

  const enterpriseName = product?.enterprise_nom || '';
  const enterpriseType = product?.enterprise_type || (kind === 'plat' ? 'restaurant' : 'boutique');
  const EnterpriseIcon = enterpriseType === 'restaurant' ? UtensilsCrossed : Store;

  const onToggleFav = async () => {
    if (!product) return;
    void Haptics.selectionAsync();
    const wasFav = isFav;
    setIsFav(!wasFav);
    try {
      const next = await toggleFavoriteProduct(product.id, kind);
      setIsFav(next);
    } catch {
      setIsFav(wasFav);
      showError('Erreur', 'Impossible de mettre à jour les favoris.');
    }
  };

  const onAddToCart = () => {
    if (!product) return;
    const stockCap = effectiveStockCap(product);
    const qty = Math.max(1, Math.min(Math.max(1, stockCap || 999), quantity));

    addProductToCartPrompt({
      enterpriseId: product.entreprise_id,
      enterpriseNom: enterpriseName || 'Vendeur',
      enterpriseType,
      productId: product.id,
      nom: product.nom || 'Produit',
      prixUnitaire: unitPrice,
      stockAvailable: qty,
      onDone: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showSuccess('Ajouté au panier', `${qty} × ${product.nom}`, {
          primaryLabel: 'Voir le panier',
          onPrimary: () => router.push('/(tabs)/cart'),
        });
      },
    });
  };

  if (loading) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenLoadState message="Chargement du produit…" />
        {FeedbackOverlay()}
      </ThemedView>
    );
  }

  if (error || !product) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenEmptyState
          title="Produit introuvable"
          body={error || "Ce produit n'existe plus ou a été retiré."}
          retryLabel="Retour à l'accueil"
          onRetry={() => router.replace('/(tabs)')}
        />
        {FeedbackOverlay()}
      </ThemedView>
    );
  }

  const EnterpriseBadge = () => (
    <Pressable
      style={[
        styles.vendorRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/(tabs)/marketplace/${product.entreprise_id}`)}
      android_ripple={{ color: colors.primaryMuted }}>
      <View style={[styles.vendorIcon, { backgroundColor: colors.primarySoft }]}>
        {product.enterprise_image_url ? (
          <Image
            source={{ uri: resolveRemoteImageUrl(product.enterprise_image_url) || undefined }}
            style={styles.vendorIconImg}
            contentFit="cover"
          />
        ) : (
          <EnterpriseIcon size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
          {enterpriseName || 'Vendeur'}
        </ThemedText>
        <ThemedText style={[styles.vendorMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {enterpriseType === 'restaurant' ? 'Restaurant' : 'Boutique'} · Voir la boutique
        </ThemedText>
      </View>
      <ChevronDown
        size={18}
        color={colors.textMuted}
        strokeWidth={LUCIDE_STROKE}
        style={{ transform: [{ rotate: '-90deg' }] }}
      />
    </Pressable>
  );

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}>
        {/* HERO IMAGE */}
        <View style={styles.heroWrap}>
          {galleryImages[0] ? (
            <Pressable
              onPress={() => {
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}>
              <Image
                source={{ uri: resolveRemoteImageUrl(galleryImages[0]) || undefined }}
                style={styles.heroImg}
                contentFit="cover"
              />
            </Pressable>
          ) : (
            <View style={[styles.heroImg, styles.heroEmpty, { backgroundColor: colors.primarySoft }]}>
              <ImageIcon size={48} color={colors.primary} strokeWidth={1.2} />
            </View>
          )}

          {/* top controls */}
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.surface }]}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel="Retour">
              <ArrowLeft size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.surface }]}
              onPress={() => void onToggleFav()}
              hitSlop={8}
              accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
              <Heart
                size={20}
                color={isFav ? colors.error : colors.text}
                fill={isFav ? colors.error : 'none'}
                strokeWidth={LUCIDE_STROKE}
              />
            </Pressable>
          </View>

          {/* gallery badge */}
          {galleryImages.length > 1 ? (
            <Pressable
              style={[styles.galleryBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              onPress={() => {
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}>
              <ImageIcon size={14} color="#FFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.galleryBadgeTxt}>
                {galleryImages.length} photos
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {/* THUMBNAILS STRIP */}
        {galleryImages.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbStrip}>
            {galleryImages.map((u, i) => (
              <Pressable
                key={`${i}-${u}`}
                onPress={() => {
                  setGalleryIndex(i);
                  setGalleryOpen(true);
                }}
                style={[
                  styles.thumb,
                  { borderColor: i === 0 ? colors.primary : 'transparent' },
                ]}>
                <Image
                  source={{ uri: resolveRemoteImageUrl(u) || undefined }}
                  style={styles.thumbImg}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.body}>
          {/* name + price */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={3}>
                {product.nom}
              </ThemedText>
              {product.prix_promo != null ? (
                <View style={styles.priceRow}>
                  <ThemedText style={[styles.price, { color: colors.primary }]}>
                    {formatFcfa(Number(product.prix_promo))}
                  </ThemedText>
                  <ThemedText style={[styles.oldPrice, { color: colors.textMuted }]}>
                    {formatFcfa(Number(product.prix))}
                  </ThemedText>
                  <View style={[styles.promoChip, { backgroundColor: colors.error }]}>
                    <ThemedText style={styles.promoChipTxt}>PROMO</ThemedText>
                  </View>
                </View>
              ) : (
                <ThemedText style={[styles.price, { color: colors.text }]}>
                  {formatFcfa(Number(product.prix))}
                </ThemedText>
              )}
            </View>
          </View>

          {/* vendor */}
          <EnterpriseBadge />

          {/* description */}
          {product.description ? (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Description
              </ThemedText>
              <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                {product.description}
              </ThemedText>
            </View>
          ) : null}

          {/* tags */}
          {Array.isArray(product.tags) && product.tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {product.tags.slice(0, 6).map((t) => (
                <View key={t} style={[styles.tagChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <ThemedText style={[styles.tagTxt, { color: colors.textSecondary }]}>{t}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {/* options (plats) */}
          {Array.isArray(product.options) && product.options.length > 0 ? (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Personnalisation
              </ThemedText>
              {product.options.map((g, gi) => (
                <View key={`g-${gi}`} style={[styles.optionGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={[styles.optionGroupName, { color: colors.text }]}>
                    {g.nom}
                    {g.requis ? ' *' : ''}
                  </ThemedText>
                  {(g.choix || []).map((c, ci) => {
                    const sel = selectedOptions.some(
                      (s) => s.groupIndex === gi && s.choiceIndex === ci,
                    );
                    return (
                      <Pressable
                        key={`c-${gi}-${ci}`}
                        style={[
                          styles.optionChoice,
                          { borderColor: sel ? colors.primary : colors.border },
                        ]}
                        onPress={() => {
                          setSelectedOptions((prev) => {
                            // Toggle dans le groupe. Si on a deja ce choix, on l'enleve.
                            if (sel) {
                              return prev.filter(
                                (s) => !(s.groupIndex === gi && s.choiceIndex === ci),
                              );
                            }
                            // Sinon on retire les autres choix du meme groupe (radio) et on ajoute celui-ci.
                            return [
                              ...prev.filter((s) => s.groupIndex !== gi),
                              { groupIndex: gi, choiceIndex: ci },
                            ];
                          });
                        }}>
                        <View
                          style={[
                            styles.optionCheck,
                            { borderColor: sel ? colors.primary : colors.border },
                          ]}>
                          {sel ? (
                            <Check size={12} color={colors.primary} strokeWidth={3} />
                          ) : null}
                        </View>
                        <ThemedText style={[styles.optionChoiceLabel, { color: colors.text }]}>
                          {c.label}
                        </ThemedText>
                        {typeof c.prix_sup === 'number' && c.prix_sup > 0 ? (
                          <ThemedText style={[styles.optionChoiceSup, { color: colors.textMuted }]}>
                            +{formatFcfa(c.prix_sup)}
                          </ThemedText>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}

          {/* stock badge */}
          {stockLabel ? (
            <View style={[styles.stockBadge, { borderColor: orderable ? colors.success : colors.border, backgroundColor: orderable ? colors.surface : colors.surfaceMuted }]}>
              <View style={[styles.stockDot, { backgroundColor: orderable ? colors.success : colors.error }]} />
              <ThemedText style={[styles.stockTxt, { color: orderable ? colors.text : colors.textMuted }]}>
                {stockLabel}
              </ThemedText>
            </View>
          ) : null}

          {/* note */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Note pour le vendeur (optionnel)
            </ThemedText>
            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={note}
              onChangeText={setNote}
              placeholder="Ex. sans piment, livré à 18h…"
              placeholderTextColor={colors.placeholder}
              multiline
            />
          </View>
        </View>
      </ScrollView>

      {/* FOOTER CTA */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}>
        <View style={styles.qtyBox}>
          <Pressable
            style={[styles.qtyBtn, { backgroundColor: colors.surfaceMuted }]}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            hitSlop={6}
            accessibilityLabel="Diminuer la quantité">
            <Minus size={16} color={colors.text} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
          <ThemedText style={[styles.qtyTxt, { color: colors.text }]}>{quantity}</ThemedText>
          <Pressable
            style={[styles.qtyBtn, { backgroundColor: colors.primarySoft }]}
            onPress={() =>
              setQuantity((q) => {
                const cap = stockAvailable || 999;
                return Math.min(Math.max(1, cap), q + 1);
              })
            }
            hitSlop={6}
            accessibilityLabel="Augmenter la quantité">
            <Plus size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>
        <Pressable
          style={[
            styles.addBtn,
            {
              backgroundColor: orderable ? colors.primary : colors.surfaceMuted,
              opacity: orderable ? 1 : 0.5,
            },
          ]}
          onPress={() => (orderable ? onAddToCart() : null)}
          disabled={!orderable}
          accessibilityLabel="Ajouter au panier">
          <ShoppingCart size={18} color={orderable ? colors.onPrimary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <ThemedText
            style={[
              styles.addBtnTxt,
              { color: orderable ? colors.onPrimary : colors.textMuted },
            ]}>
            {orderable ? `Ajouter · ${formatFcfa(totalPrice)}` : 'Indisponible'}
          </ThemedText>
        </Pressable>
      </View>

      {/* gallery modal */}
      {galleryOpen ? (
        <View style={[styles.galleryOverlay, { backgroundColor: 'rgba(0,0,0,0.96)' }]}>
          <Pressable
            style={[styles.galleryClose, { top: insets.top + 8 }]}
            onPress={() => setGalleryOpen(false)}>
            <ThemedText style={styles.galleryCloseTxt}>Fermer</ThemedText>
          </Pressable>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * (Platform.OS === 'web' ? 400 : 400), y: 0 }}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const w = e.nativeEvent.layoutMeasurement.width;
              if (w > 0) setGalleryIndex(Math.round(x / w));
            }}>
            {galleryImages.map((u, i) => (
              <View key={`g-${i}`} style={styles.gallerySlide}>
                <Image
                  source={{ uri: resolveRemoteImageUrl(u) || undefined }}
                  style={styles.galleryImg}
                  contentFit="contain"
                />
              </View>
            ))}
          </ScrollView>
          {galleryImages.length > 1 ? (
            <ThemedText style={styles.galleryCounter}>
              {galleryIndex + 1} / {galleryImages.length}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {FeedbackOverlay()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroWrap: { position: 'relative' },
  heroImg: { width: '100%', aspectRatio: 1, backgroundColor: '#eee' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  heroTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  galleryBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  galleryBadgeTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  thumbStrip: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
  },
  thumbImg: { width: '100%', height: '100%' },
  body: { padding: 18, gap: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, lineHeight: 26 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 22, fontWeight: '800' },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  promoChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promoChipTxt: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  vendorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vendorIconImg: { width: '100%', height: '100%' },
  vendorName: { fontSize: 14, fontWeight: '700' },
  vendorMeta: { fontSize: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagTxt: { fontSize: 12, fontWeight: '600' },
  optionGroup: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  optionGroupName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  optionChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChoiceLabel: { flex: 1, fontSize: 14 },
  optionChoiceSup: { fontSize: 12, fontWeight: '700' },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  stockDot: { width: 8, height: 8, borderRadius: 4 },
  stockTxt: { fontSize: 12, fontWeight: '600' },
  noteInput: {
    minHeight: 60,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyTxt: { fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  addBtnTxt: { fontSize: 15, fontWeight: '800' },
  galleryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  galleryClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
  },
  galleryCloseTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  gallerySlide: { width: 400, alignItems: 'center', justifyContent: 'center' },
  galleryImg: { width: '100%', height: '100%' },
  galleryCounter: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
