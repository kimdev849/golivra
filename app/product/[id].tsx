import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  Clock,
  Heart,
  ImageIcon,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';

import { GalleryViewer } from '@/components/gallery-viewer';
import { ScreenEmptyState } from '@/components/screen-load-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DETAIL_SCREEN_PADDING_BOTTOM } from '@/constants/layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useCurrentTime } from '@/hooks/use-current-time';
import { computeLiveStatus } from '@/lib/horaires-status';
import {
  fetchEnterpriseById,
  fetchProductById,
  peekProductById,
  trackProductClick,
  type ProductPublic,
} from '@/lib/catalog';
import { peekEnterpriseById } from '@/lib/client-data';
import { enterprisePrepMinutes } from '@/lib/pricing';
import { trackInteraction } from '@/lib/tracking';
import { resolveRemoteImageUrl, type ResizeOptions } from '@/lib/images';
import { getEffectiveUnitPrice } from '@/lib/product-promo';
import { formatFcfa } from '@/lib/format';
import {
  effectiveStockCap,
  isProductOrderable,
  stockDisplayLabel,
} from '@/lib/product-stock';
import {
  addProductToCartPrompt,
  removeProductLineSync,
  saveCart,
  updateLineQuantitySync,
} from '@/lib/cart-local';
import { useCart } from '@/contexts/cart-context';
import { showToast } from '@/lib/app-toast';
import { isFavoriteProduct, toggleFavoriteProduct } from '@/lib/favorites';
import { getProductGalleryUrls } from '@/lib/listing-utils';

const IMG_HERO: ResizeOptions = { width: 800, format: 'webp', quality: 85 };
const IMG_THUMB: ResizeOptions = { width: 200, format: 'webp', quality: 80 };

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
  const { showError, FeedbackOverlay } = useActionFeedback();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const cart = useCart((s) => s.cart);

  const productId = typeof params.id === 'string' ? params.id : '';
  const kindParam = typeof params.kind === 'string' ? params.kind.toLowerCase() : '';
  const kind: 'plat' | 'article' = kindParam === 'article' ? 'article' : 'plat';

  const [quantity, setQuantity] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptionChoice[]>([]);
  const [note, setNote] = useState('');
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId, kind],
    queryFn: async () => {
      // Utiliser l'enterprise_id du cache mémoire pour accélérer (évite le scan complet du feed)
      const cached = peekProductById(productId);
      const p = await fetchProductById(productId, kind, cached?.entreprise_id);
      return p ?? Promise.reject(new Error('Produit introuvable.'));
    },
    staleTime: 1000 * 60 * 3,
    placeholderData: () => peekProductById(productId) ?? undefined,
    enabled: !!productId,
  });

  const trackedProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!product) return;
    if (trackedProductId.current === product.id) return;
    trackedProductId.current = product.id;
    void (async () => {
      const fav = await isFavoriteProduct(product.id, kind);
      setIsFav(fav);
    })();
    void trackInteraction({
      type: 'view_product',
      targetId: product.id,
      targetType: 'product',
      categoryId: product.categorie_id ?? undefined,
    });
  }, [product, kind]);

  const galleryImages = useMemo(() => {
    if (!product) return [] as string[];
    return getProductGalleryUrls(product, IMG_HERO);
  }, [product]);

  const basePrice = product ? Number(getEffectiveUnitPrice(product) ?? product.prix ?? 0) : 0;
  const optionSupplement = computeOptionSupplement(product?.options, selectedOptions);
  const unitPrice = basePrice + optionSupplement;
  const totalPrice = unitPrice * Math.max(1, quantity);

  // Horaires du commerce : on bloque l'ajout si la boutique/resto est fermé OU s'il
  // est trop tard pour commander (préparation impossible avant la fermeture).
  // Le serveur applique la même règle à la création de commande (source de vérité).
  const { data: enterprise } = useQuery({
    queryKey: ['enterprise', product?.entreprise_id],
    queryFn: () => fetchEnterpriseById(product!.entreprise_id),
    staleTime: 1000 * 60 * 3,
    refetchInterval: 1000 * 60 * 2,
    placeholderData: () =>
      product?.entreprise_id ? (peekEnterpriseById(product.entreprise_id) ?? undefined) : undefined,
    enabled: !!product?.entreprise_id,
  });

  // ⚡ Statut ouvert/fermé RECALCULÉ EN DIRECT côté client (horloge locale
  // toutes les 30 s) : les champs serveur est_ouvert_maintenant /
  // peut_commander_maintenant sont figés par le cache — sans recalcul, un
  // commerce qui ouvre à 7h30 resterait « fermé » à 7h53 et le bouton
  // d'ajout au panier resterait bloqué.
  const now = useCurrentTime(30_000);
  const liveStatus = computeLiveStatus(enterprise?.horaires ?? [], {
    prepMinutes: enterprisePrepMinutes(enterprise),
    kind: enterprise?.type === 'restaurant' ? 'restaurant' : 'boutique',
    fermeManuellement: enterprise?.ouvert === false,
    sansHoraires: enterprise?.accepte_commandes === false,
  }, now);
  const heuresBloquees = !!enterprise && liveStatus.commandesBloquees;
  const tropTard = !!enterprise && liveStatus.tropTard;

  const stockAvailable = product ? effectiveStockCap(product) : 0;
  const orderable = product ? isProductOrderable(product) && !heuresBloquees : false;
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
    // Chaque clic ajoute +1 unité. stockAvailable = plafond réel (stock dispo),
    // pas la quantité : sinon la ligne du panier resterait bloquée à 1.
    const stockCap = effectiveStockCap(product);

    addProductToCartPrompt({
      enterpriseId: product.entreprise_id,
      enterpriseNom: enterpriseName || 'Vendeur',
      enterpriseType,
      productId: product.id,
      nom: product.nom || 'Produit',
      prixUnitaire: unitPrice,
      stockAvailable: stockCap,
      onDone: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({
          message: 'Ajouté au panier',
          action: {
            label: 'Voir le panier',
            onPress: () => router.navigate('/(tabs)/cart'),
          },
        });
      },
    });
  };

  /** Ligne du panier correspondant à ce produit (si déjà ajouté). */
  const cartLine = useMemo(() => {
    if (!product) return null;
    const seg = cart?.segments.find((s) => s.enterpriseId === product.entreprise_id);
    return seg?.lines.find((l) => l.productId === product.id) ?? null;
  }, [cart, product]);

  const changeCartQty = (q: number) => {
    if (!product) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (q <= 0) {
      const next = cart ? removeProductLineSync(cart, product.entreprise_id, product.id) : null;
      void saveCart(next);
      return;
    }
    if (!cart) return;
    const next = updateLineQuantitySync(cart, product.entreprise_id, product.id, q, stockAvailable);
    void saveCart(next);
  };

  if (isLoading && !product) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ProductDetailSkeleton colors={colors} />
        {FeedbackOverlay()}
      </ThemedView>
    );
  }

  if ((error || !product) && !isLoading) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenEmptyState
          title="Produit introuvable"
          body={error instanceof Error ? error.message : "Ce produit n'existe plus ou a été retiré."}
          retryLabel="Retour à l'accueil"
          onRetry={() => router.replace('/(tabs)')}
        />
        {FeedbackOverlay()}
      </ThemedView>
    );
  }

  if (!product) return null;

  const EnterpriseBadge = () => (
    <Pressable
      style={[
        styles.vendorRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/marketplace/${product.entreprise_id}`)}
      android_ripple={{ color: colors.primaryMuted }}>
      <View style={[styles.vendorIcon, { backgroundColor: colors.primarySoft }]}>
        {product.enterprise_image_url ? (
          <Image
            source={{ uri: resolveRemoteImageUrl(product.enterprise_image_url, { width: 80, format: 'webp', quality: 80 }) || undefined }}
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
        contentContainerStyle={{ paddingBottom: DETAIL_SCREEN_PADDING_BOTTOM + insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}>
        {/* HERO IMAGE */}
        <View style={styles.heroWrap}>
          {galleryImages[selectedGalleryIndex] ? (
            <Pressable
              onPress={() => {
                setGalleryIndex(selectedGalleryIndex);
                setGalleryOpen(true);
              }}>
              <Image
                key={`${productId}-${selectedGalleryIndex}`}
                source={{ uri: galleryImages[selectedGalleryIndex] }}
                style={styles.heroImg}
                contentFit="cover"
                transition={200}
                recyclingKey={galleryImages[selectedGalleryIndex]}
              />
            </Pressable>
          ) : (
            <View style={[styles.heroImg, styles.heroEmpty, { backgroundColor: colors.primarySoft }]}>
              <ImageIcon size={48} color={colors.primary} strokeWidth={1.2} />
            </View>
          )}

          {/* top controls */}
          <View style={[styles.heroTop, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
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
                  setSelectedGalleryIndex(i);
                  void Haptics.selectionAsync();
                }}
                style={[
                  styles.thumb,
                  { borderColor: i === selectedGalleryIndex ? colors.primary : 'transparent' },
                ]}>
                <Image
                  source={{ uri: u }}
                  style={styles.thumbImg}
                  contentFit="cover"
                  recyclingKey={u}
                  transition={150}
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

          {/* Blocage horaires : commerce fermé ou trop tard pour commander */}
          {heuresBloquees && enterprise ? (
            <View
              style={[
                styles.stockBadge,
                {
                  borderColor: tropTard ? colors.warning : colors.error,
                  backgroundColor: tropTard ? colors.warningSoft : colors.errorSoft,
                },
              ]}>
              <Clock size={14} color={tropTard ? colors.warning : colors.error} strokeWidth={LUCIDE_STROKE} />
              <ThemedText
                style={[
                  styles.stockTxt,
                  { color: tropTard ? colors.warning : colors.error, flex: 1 },
                ]}>
                {tropTard
                  ? liveStatus.messageCommande ??
                    'Il est trop tard pour commander aujourd\'hui : la préparation ne peut pas finir avant la fermeture.'
                  : liveStatus.messageFermeture}
              </ThemedText>
            </View>
          ) : null}

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
            paddingBottom: Math.max(insets.bottom, 12) + 12,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}>
        {cartLine ? (
          <>
            {/* Contrôles de quantité — le produit est déjà au panier */}
            <View
              style={[
                styles.qtyGroup,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => changeCartQty(cartLine.quantite - 1)}
                hitSlop={6}
                accessibilityLabel="Diminuer la quantité">
                <Minus size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
              <ThemedText style={[styles.qtyTxt, { color: colors.text }]}>
                {cartLine.quantite}
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.qtyBtn, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => changeCartQty(cartLine.quantite + 1)}
                disabled={cartLine.quantite >= stockAvailable}
                hitSlop={6}
                accessibilityLabel="Augmenter la quantité">
                <Plus
                  size={18}
                  color={cartLine.quantite >= stockAvailable ? colors.textMuted : colors.primary}
                  strokeWidth={LUCIDE_STROKE}
                />
              </Pressable>
            </View>
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.navigate('/(tabs)/cart')}
              accessibilityLabel="Voir le panier">
              <ShoppingCart size={20} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.addBtnTxt, { color: colors.onPrimary }]}>
                Voir le panier · {formatFcfa(cartLine.quantite * unitPrice)}
              </ThemedText>
            </Pressable>
          </>
        ) : (
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
            <ShoppingCart size={20} color={orderable ? colors.onPrimary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            <ThemedText
              style={[
                styles.addBtnTxt,
                { color: orderable ? colors.onPrimary : colors.textMuted },
              ]}>
              {orderable
                ? `Ajouter au panier · ${formatFcfa(totalPrice)}`
                : heuresBloquees
                  ? "Fermé pour le moment"
                  : 'Indisponible'}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* gallery modal plein écran (swipe + zoom) */}
      <GalleryViewer
        visible={galleryOpen}
        images={galleryImages}
        initialIndex={galleryIndex}
        caption={product?.nom ?? null}
        onClose={() => setGalleryOpen(false)}
      />
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
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyTxt: { fontSize: 16, fontWeight: '800', minWidth: 28, textAlign: 'center' },
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
});

function ProductDetailSkeleton({ colors }: { colors: ReturnType<typeof useAppColors> }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Hero image skeleton */}
      <Skeleton width="100%" height={360} borderRadius={0} />
      {/* Thumbnails */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width={60} height={60} borderRadius={10} />
        ))}
      </View>
      <View style={{ padding: 18, gap: 18 }}>
        {/* Title */}
        <Skeleton width="85%" height={24} borderRadius={6} />
        <Skeleton width="40%" height={22} borderRadius={6} />
        {/* Vendor */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ gap: 6, flex: 1 }}>
            <Skeleton width="60%" height={14} borderRadius={4} />
            <Skeleton width="40%" height={12} borderRadius={4} />
          </View>
        </View>
        {/* Description */}
        <View style={{ gap: 8 }}>
          <Skeleton width="35%" height={16} borderRadius={4} />
          <Skeleton width="100%" height={14} borderRadius={4} />
          <Skeleton width="90%" height={14} borderRadius={4} />
          <Skeleton width="65%" height={14} borderRadius={4} />
        </View>
        {/* Options */}
        <Skeleton width="100%" height={80} borderRadius={12} />
        {/* Button */}
        <Skeleton width="100%" height={52} borderRadius={14} />
      </View>
    </ScrollView>
  );
}
