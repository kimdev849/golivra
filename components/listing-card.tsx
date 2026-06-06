import { Image } from 'expo-image';
import { Heart, Images, Store, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import type { ProductPublic } from '@/lib/catalog';
import { formatFcfa } from '@/lib/format';
import { getProductPhotoCount, getProductPrimaryImage, productKind } from '@/lib/listing-utils';
import { getEffectiveUnitPrice } from '@/lib/product-promo';

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
  const kind = productKind(product);
  const image = getProductPrimaryImage(product);
  const photoCount = getProductPhotoCount(product);
  const basePrice = Number(getEffectiveUnitPrice(product) ?? product.prix ?? 0);
  const isPromo =
    product.prix_promo != null && Number(product.prix_promo) < Number(product.prix);
  const PlaceholderIcon = kind === 'article' ? Store : UtensilsCrossed;
  const isGrid = variant === 'grid';
  const isFeed = variant === 'feed';

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
          <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <PlaceholderIcon size={isGrid ? 28 : 36} color={colors.primary} strokeWidth={1.2} />
          </View>
        )}
        {photoCount > 1 ? (
          <View style={[styles.photoBadge, isGrid && styles.photoBadgeGrid]}>
            <Images size={10} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={styles.photoBadgeTxt}>{photoCount}</ThemedText>
          </View>
        ) : null}
        {isPromo ? (
          <View style={[styles.promoBadge, isGrid && styles.promoBadgeGrid, { backgroundColor: colors.error }]}>
            <ThemedText style={styles.promoBadgeTxt}>Promo</ThemedText>
          </View>
        ) : null}
        {onToggleFav ? (
          <Pressable
            style={[styles.favBtn, isGrid && styles.favBtnGrid, { backgroundColor: colors.surface }]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            hitSlop={6}
            accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Heart
              size={isGrid ? 14 : 16}
              color={isFav ? colors.error : colors.textMuted}
              fill={isFav ? colors.error : 'none'}
              strokeWidth={LUCIDE_STROKE}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.body, isGrid && styles.bodyGrid, isFeed && styles.bodyFeed]}>
        <ThemedText
          style={[styles.price, isGrid && styles.priceGrid, { color: isPromo ? colors.primary : colors.text }]}
          numberOfLines={1}>
          {isPromo ? formatFcfa(Number(product.prix_promo)) : formatFcfa(basePrice)}
        </ThemedText>
        {isPromo && !isGrid ? (
          <ThemedText style={[styles.oldPrice, { color: colors.textMuted }]} numberOfLines={1}>
            {formatFcfa(Number(product.prix))}
          </ThemedText>
        ) : null}
        <ThemedText
          style={[styles.title, isGrid && styles.titleGrid, { color: colors.text }]}
          numberOfLines={2}>
          {product.nom || 'Produit'}
        </ThemedText>
        {product.enterprise_nom ? (
          <ThemedText style={[styles.vendor, isGrid && styles.vendorGrid, { color: colors.textMuted }]} numberOfLines={1}>
            {product.enterprise_nom}
          </ThemedText>
        ) : null}
        {!isGrid && !isFeed && product.description ? (
          <ThemedText style={[styles.snippet, { color: colors.textSecondary }]} numberOfLines={2}>
            {product.description}
          </ThemedText>
        ) : null}
      </View>
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
    borderRadius: 12,
    marginBottom: 10,
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
    aspectRatio: 1,
    borderRadius: 10,
  },
  imageWrapFeed: {
    aspectRatio: undefined,
    height: 220,
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
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  promoBadgeGrid: { top: 6, left: 6 },
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
  body: { padding: 12, gap: 3 },
  bodyGrid: { paddingHorizontal: 2, paddingTop: 6, paddingBottom: 4, gap: 2, minHeight: 58 },
  bodyFeed: { paddingHorizontal: 12, paddingVertical: 10, gap: 3, minHeight: 88 },
  price: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  priceGrid: { fontSize: 14, fontWeight: '800' },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  titleGrid: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  vendor: { fontSize: 13, marginTop: 2 },
  vendorGrid: { fontSize: 11, marginTop: 1 },
  snippet: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
