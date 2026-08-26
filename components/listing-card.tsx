import { Image } from 'expo-image';
import { Heart, Images, Maximize2, Store, UtensilsCrossed } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GalleryViewer } from '@/components/gallery-viewer';
import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import type { ProductPublic } from '@/lib/catalog';
import { formatFcfa } from '@/lib/format';
import {
  getProductCondition,
  getProductConditionColor,
  getProductGalleryUrls,
  getProductPhotoCount,
  getProductPrimaryImage,
  productKind,
} from '@/lib/listing-utils';
import { resolveProductPricing } from '@/lib/product-promo';
import { resolveRemoteImageUrl, type ResizeOptions } from '@/lib/images';

type Props = {
  product: ProductPublic;
  onPress: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
  /** grid = 2 colonnes marketplace · feed = fil large · default = carte classique */
  variant?: 'grid' | 'feed' | 'default';
};

/**
 * Carte annonce style marketplace : dimensions fixes, image cover.
 */
export function ListingCard({ product, onPress, isFav = false, onToggleFav, variant = 'grid' }: Props) {
  const colors = useAppColors();
  const [zoomOpen, setZoomOpen] = useState(false);
  const galleryImages = useMemo(
    () => getProductGalleryUrls(product, { width: 900, format: 'webp', quality: 85 }),
    [product],
  );
  const kind = productKind(product);
  const isGrid = variant === 'grid';
  const isFeed = variant === 'feed';
  const imgWidth = isGrid ? 350 : isFeed ? 220 : 400;
  const imgOpts: ResizeOptions = { width: imgWidth, format: 'webp', quality: 80 };
  const image = getProductPrimaryImage(product, imgOpts);
  const photoCount = getProductPhotoCount(product, imgOpts);
  // Même logique promo que la fiche produit (prix de base + fenêtres de dates) :
  // le badge ne disparaît plus de la liste quand la promo est active.
  const pricing = resolveProductPricing(product);
  const isPromo = pricing.promoActive;
  const basePrice = pricing.basePrice;
  const PlaceholderIcon = kind === 'article' ? Store : UtensilsCrossed;
  // État du produit (neuf / occasion / reconditionné) — affiché dès la liste.
  const condition = getProductCondition(product);
  // Photo de profil du commerce, visible dès la liste (pas besoin d'entrer
  // dans le produit pour la voir).
  const vendorAvatar = product.enterprise_image_url
    ? resolveRemoteImageUrl(product.enterprise_image_url, { width: 96, format: 'webp', quality: 80 })
    : null;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}
      style={({ pressed }) => [
        styles.card,
        isGrid && styles.cardGrid,
        isFeed && styles.cardFeed,
        {
          backgroundColor: isGrid ? 'transparent' : colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View
        style={[
          styles.imageWrap,
          isGrid && styles.imageWrapGrid,
          isFeed && styles.imageWrapFeed,
          { backgroundColor: colors.primarySoft },
        ]}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={200} recyclingKey={image} />
            <Pressable
              style={[styles.zoomBtn, isGrid && styles.zoomBtnGrid, isFeed && styles.zoomBtnFeed]}
              onPress={(e) => {
                e.stopPropagation();
                setZoomOpen(true);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Agrandir la photo">
              <Maximize2 size={13} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <PlaceholderIcon size={isGrid ? 28 : isFeed ? 24 : 36} color={colors.primary} strokeWidth={1.2} />
          </View>
        )}
        {photoCount > 1 ? (
          <View style={[styles.photoBadge, isGrid && styles.photoBadgeGrid]}>
            <Images size={10} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={styles.photoBadgeTxt}>{photoCount}</ThemedText>
          </View>
        ) : null}
        {condition ? (
          <View
            style={[
              styles.condBadge,
              isGrid && styles.condBadgeGrid,
              isFeed && styles.condBadgeFeed,
              { backgroundColor: getProductConditionColor(condition.key, colors) },
            ]}>
            <ThemedText style={styles.condBadgeTxt}>{condition.label}</ThemedText>
          </View>
        ) : null}
        {isPromo ? (
          <View
            style={[
              styles.promoBadge,
              isGrid && styles.promoBadgeGrid,
              isFeed && styles.promoBadgeFeed,
              condition ? styles.promoBadgeWithCond : null,
              { backgroundColor: colors.error },
            ]}>
            <ThemedText style={styles.promoBadgeTxt}>Promo</ThemedText>
          </View>
        ) : null}
        {onToggleFav ? (
          <Pressable
            style={[styles.favBtn, isGrid && styles.favBtnGrid, isFeed && styles.favBtnFeed, { backgroundColor: colors.surface }]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            hitSlop={6}
            accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Heart
              size={isGrid || isFeed ? 14 : 16}
              color={isFav ? colors.error : colors.textMuted}
              fill={isFav ? colors.error : 'none'}
              strokeWidth={LUCIDE_STROKE}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.body, isGrid && styles.bodyGrid, isFeed && styles.bodyFeed]}>
        <View style={styles.priceRow}>
          <ThemedText
            style={[styles.price, isGrid && styles.priceGrid, isFeed && styles.priceFeed, { color: isPromo ? colors.primary : colors.text }]}
            numberOfLines={1}>
            {formatFcfa(isPromo && pricing.promoPrice != null ? pricing.promoPrice : basePrice)}
          </ThemedText>
          {isPromo && !isGrid ? (
            <ThemedText style={[styles.oldPrice, { color: colors.textMuted }]} numberOfLines={1}>
              {formatFcfa(basePrice)}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          style={[styles.title, isGrid && styles.titleGrid, isFeed && styles.titleFeed, { color: colors.text }]}
          numberOfLines={2}>
          {product.nom || 'Produit'}
        </ThemedText>
        {product.enterprise_nom ? (
          <View style={styles.vendorRow}>
            {vendorAvatar ? (
              <Image
                source={{ uri: vendorAvatar }}
                style={[styles.vendorAvatar, isGrid && styles.vendorAvatarGrid, isFeed && styles.vendorAvatarFeed]}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <ThemedText style={[styles.vendor, isGrid && styles.vendorGrid, isFeed && styles.vendorFeed, { color: colors.textMuted }]} numberOfLines={1}>
              {product.enterprise_nom}
            </ThemedText>
          </View>
        ) : null}
        {!isGrid && !isFeed && product.description ? (
          <ThemedText style={[styles.snippet, { color: colors.textSecondary }]} numberOfLines={2}>
            {product.description}
          </ThemedText>
        ) : null}
      </View>

      {/* Visionneuse plein écran des photos (zoom) */}
      {zoomOpen && galleryImages.length > 0 ? (
        <GalleryViewer
          visible
          images={galleryImages}
          caption={product.nom ?? null}
          onClose={() => setZoomOpen(false)}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardGrid: {
    borderRadius: 10,
    borderWidth: 0,
    marginBottom: 0,
    flex: 1,
  },
  cardFeed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    marginBottom: 4,
    padding: 12,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageWrapGrid: {
    aspectRatio: 4 / 3,
    borderRadius: 10,
  },
  imageWrapFeed: {
    width: 88,
    height: 88,
    aspectRatio: undefined,
    borderRadius: 12,
    flexShrink: 0,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  photoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoBadgeGrid: { bottom: 6, left: 6 },
  photoBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  zoomBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  zoomBtnGrid: { bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13 },
  zoomBtnFeed: { bottom: 6, right: 6, width: 24, height: 24, borderRadius: 12 },
  condBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  condBadgeGrid: { top: 6, left: 6 },
  condBadgeFeed: { top: 6, left: 6 },
  condBadgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  promoBadgeGrid: { top: 6, left: 6 },
  promoBadgeFeed: { top: 6, left: 6 },
  /** Quand l'état est affiché à gauche, la promo se centre pour ne pas se chevaucher. */
  promoBadgeWithCond: { left: '50%', marginLeft: -22 },
  promoBadgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  favBtnGrid: {
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  favBtnFeed: {
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  body: { padding: 12, gap: 3 },
  bodyGrid: { paddingHorizontal: 2, paddingTop: 6, paddingBottom: 4, gap: 2, minHeight: 58 },
  bodyFeed: { flex: 1, padding: 0, gap: 3, minHeight: 0 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  priceGrid: { fontSize: 14, fontWeight: '800' },
  priceFeed: { fontSize: 15 },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  titleGrid: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  titleFeed: { fontSize: 14, lineHeight: 18 },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  vendorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
  },
  vendorAvatarGrid: { width: 15, height: 15, borderRadius: 7.5 },
  vendorAvatarFeed: { width: 16, height: 16, borderRadius: 8 },
  vendor: { fontSize: 13, marginTop: 2, flexShrink: 1 },
  vendorGrid: { fontSize: 11, marginTop: 1 },
  vendorFeed: { fontSize: 12, marginTop: 1 },
  snippet: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
