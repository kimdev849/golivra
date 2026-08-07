import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Building2,
  Clock,
  Heart,
  Images,
  MapPin,
  Package,
  Phone,
  ShoppingBasket,
  ShoppingCart,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { GalleryViewer } from '@/components/gallery-viewer';
import { ProductPrice } from '@/components/product-price';
import { ScreenEmptyState, ScreenLoadState } from '@/components/screen-load-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ZoomableImage } from '@/components/zoomable-image';
import { createEnterpriseDetailStyles } from '@/constants/enterprise-detail-styles';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useCurrentTime } from '@/hooks/use-current-time';
import { computeLiveStatus } from '@/lib/horaires-status';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import {
  fetchEnterpriseById,
  fetchProductsForEnterprise,
  trackEnterpriseView,
  trackProductClick,
} from '@/lib/catalog';
import { peekEnterpriseById, peekProductsForEnterprise } from '@/lib/client-data';
import { addProductToCartPrompt } from '@/lib/cart-local';
import { showToast } from '@/lib/app-toast';
import { getEffectiveUnitPrice } from '@/lib/product-promo';
import { resolveRemoteImageUrl, type ResizeOptions } from '@/lib/images';
import { getProductGalleryUrls, productDetailHref } from '@/lib/listing-utils';
import {
  effectiveStockCap,
  isProductOrderable,
  stockDisplayLabel,
} from '@/lib/product-stock';
import { toggleFavorite, isFavorite } from '@/lib/favorites-api';
import { getSessionToken } from '@/lib/auth';
import { trackInteraction } from '@/lib/tracking';

const IMG_HERO: ResizeOptions = { width: 800, format: 'webp', quality: 85 };
const IMG_THUMB: ResizeOptions = { width: 200, format: 'webp', quality: 80 };

export default function EnterpriseDetailScreen() {
  const { enterpriseId } = useLocalSearchParams<{ enterpriseId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const id = typeof enterpriseId === 'string' ? enterpriseId : '';
  const colors = useAppColors();
  const styles = useThemedStyles(createEnterpriseDetailStyles);
  const queryClient = useQueryClient();

  const [isFavorited, setIsFavorited] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [galleryState, setGalleryState] = useState<{ images: string[]; index: number } | null>(null);

  const { data: enterprise, isLoading: loadingEnt, error: entError } = useQuery<EnterprisePublic>({
    queryKey: ['enterprise', id],
    queryFn: () => fetchEnterpriseById(id),
    staleTime: 1000 * 60 * 3,
    refetchInterval: 1000 * 60 * 2,
    placeholderData: () => peekEnterpriseById(id) ?? undefined,
    enabled: !!id,
  });

  const { data: products = [], isLoading: loadingProds } = useQuery({
    queryKey: ['products', id],
    queryFn: () => fetchProductsForEnterprise(id),
    staleTime: 1000 * 60 * 1.5,
    placeholderData: () => peekProductsForEnterprise(id) ?? undefined,
    enabled: !!id,
  });

  const loading = loadingEnt || loadingProds;
  const error = entError ? (entError instanceof Error ? entError.message : 'Erreur de chargement.') : null;

  // Tracking vue commerce
  useEffect(() => {
    if (enterprise && products.length > 0) {
      void trackInteraction({
        type: 'view_enterprise',
        targetId: enterprise.id,
        targetType: enterprise.type === 'restaurant' ? 'restaurant' : 'boutique',
        categoryId: enterprise.categorie_id ?? undefined,
      });
    }
  }, [enterprise, products]);

  // Vérifier le statut favori
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const t = await getSessionToken();
        if (!alive || !t || !id) return;
        setToken(t);
        const fav = await isFavorite(t, id);
        if (alive) setIsFavorited(fav);
      } catch { /* ignore */ }
    };
    void check();
    return () => { alive = false; };
  }, [id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!token || !enterprise) return;
    try {
      const newStatus = await toggleFavorite(token, enterprise.id, enterprise.nom ?? 'Commerce', enterprise.type);
      setIsFavorited(newStatus);
    } catch {
      // silent
    }
  }, [token, enterprise]);

  const hero = resolveRemoteImageUrl(enterprise?.image_url, IMG_HERO);
  const isRestaurant = enterprise?.type === 'restaurant';
  const prepMin = enterprise?.delai_preparation_min ?? 25;
  const shipMin = enterprise?.delai_livraison_min ?? 48;
  // ⚡ Statut ouvert/fermé RECALCULÉ EN DIRECT côté client.
  // Le serveur calcule est_ouvert_maintenant / peut_commander_maintenant à
  // l'instant de la requête, puis le cache client le fige (jusqu'à plusieurs
  // minutes) : sans recalcul local, un commerce qui ouvre à 7h30 resterait
  // affiché « Réouverture à 7h30 » à 7h53, et le panier resterait bloqué.
  // On recalcule donc à partir des horaires de la fiche (déjà dans la réponse)
  // avec une horloge locale qui rafraîchit l'écran toutes les 30 s.
  const now = useCurrentTime(30_000);
  const liveStatus = computeLiveStatus(enterprise?.horaires ?? [], {
    prepMinutes: prepMin,
    kind: isRestaurant ? 'restaurant' : 'boutique',
    fermeManuellement: enterprise?.ouvert === false,
    sansHoraires: enterprise?.accepte_commandes === false,
  }, now);
  const estFerme = liveStatus.estFerme;
  const tropTard = liveStatus.tropTard;
  const commandesBloquees = liveStatus.commandesBloquees;
  const derniereCommandeLabel = liveStatus.derniereCommandeLabel;
  // Référence grammaticale du commerce (messages adaptés boutique / restaurant).
  const commerceRef = isRestaurant ? 'ce restaurant' : 'cette boutique';
  // Statut compact affiché près du nom (pastille colorée type Glovo / Uber Eats).
  const statusInfo = (() => {
    if (!enterprise) return { label: 'Ouvert', color: colors.success };
    const toneColor =
      liveStatus.tone === 'error'
        ? colors.error
        : liveStatus.tone === 'warning'
          ? colors.warning
          : colors.success;
    return { label: liveStatus.label, color: toneColor };
  })();

  const addProduct = (p: ProductPublic) => {
    if (!enterprise) return;
    const prix = getEffectiveUnitPrice(p);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackProductClick(enterprise.id, p.id);
    addProductToCartPrompt({
      enterpriseId: enterprise.id,
      enterpriseNom: enterprise.nom ?? 'Commerce',
      enterpriseType: enterprise.type,
      productId: p.id,
      nom: p.nom ?? 'Produit',
      prixUnitaire: prix,
      stockAvailable: effectiveStockCap(p, { enterpriseType: enterprise.type }),
      onDone: () => {
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

  const viewTrackedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!enterprise || products.length === 0) return;
    if (viewTrackedFor.current === enterprise.id) return;
    viewTrackedFor.current = enterprise.id;
    trackEnterpriseView(enterprise.id, products.map((p) => p.id));
  }, [enterprise, products]);

  // Préchargement des images (hero + vignettes produits) dès que les données
  // arrivent : expo-image les sert ensuite depuis son cache disque → affichage
  // instantané au défilement, plus de pop-in lent. Limité aux 40 premiers
  // produits pour ne pas saturer le réseau sur les gros catalogues.
  useEffect(() => {
    if (!enterprise && products.length === 0) return;
    const urls: string[] = [];
    if (hero) urls.push(hero);
    for (const p of products.slice(0, 40)) {
      for (const u of getProductGalleryUrls(p, IMG_THUMB)) {
        urls.push(u);
      }
    }
    if (urls.length > 0) void Image.prefetch(urls);
  }, [enterprise, products, hero]);

  if (!id) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Identifiant commerce manquant.</ThemedText>
      </ThemedView>
    );
  }

  if (loading && !enterprise) {
    return (
      <ThemedView style={styles.center}>
        <ScreenLoadState message="Chargement du commerce…" />
      </ThemedView>
    );
  }

  if (!loading && (error || !enterprise)) {
    return (
      <ThemedView style={styles.center}>
        <Building2 size={44} color={colors.placeholder} strokeWidth={LUCIDE_STROKE} />
        <ScreenEmptyState
          title="Commerce indisponible"
          body={error ?? 'Ce commerce est fermé ou n\'existe plus.'}
          onRetry={() => {
            queryClient.invalidateQueries({ queryKey: ['enterprise', id] });
            queryClient.invalidateQueries({ queryKey: ['products', id] });
          }}
        />
      </ThemedView>
    );
  }

  if (!enterprise) {
    return (
      <ThemedView style={styles.center}>
        <ScreenLoadState message="Chargement du commerce…" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          {hero ? (
            <ZoomableImage
              source={{ uri: hero }}
              style={styles.heroImg}
              contentFit="cover"
              transition={200}
              caption={enterprise?.nom ?? null}
            />
          ) : (
            <View style={[styles.heroImg, styles.heroPh]}>
              {enterprise.type === 'restaurant' ? (
                <UtensilsCrossed size={56} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              ) : (
                <Store size={56} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              )}
            </View>
          )}

          {/* top controls custom header */}
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
              onPress={handleToggleFavorite}
              hitSlop={8}
              accessibilityLabel={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
              <Heart
                size={20}
                color={isFavorited ? colors.error : colors.text}
                fill={isFavorited ? colors.error : 'none'}
                strokeWidth={LUCIDE_STROKE}
              />
            </Pressable>
          </View>

          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeText}>{enterprise.type === 'restaurant' ? 'Restaurant' : 'Boutique'}</ThemedText>
          </View>

          {/* Note du commerce (badge sombre sur la photo) : toujours visible,
              « · N avis » si déjà noté, sinon « Nouveau ». */}
          <View style={styles.ratingBadge}>
            <Star size={13} color="#FFC53D" fill="#FFC53D" strokeWidth={LUCIDE_STROKE} />
            {enterprise.note_moyenne != null && enterprise.note_moyenne > 0 ? (
              <>
                <ThemedText style={styles.ratingBadgeValue}>
                  {enterprise.note_moyenne.toFixed(1)}
                </ThemedText>
                {enterprise.nb_avis != null && enterprise.nb_avis > 0 ? (
                  <ThemedText style={styles.ratingBadgeCount}>
                    · {enterprise.nb_avis} avis
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText style={styles.ratingBadgeValue}>Nouveau</ThemedText>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <ThemedText type="title" style={styles.name}>
            {enterprise.nom ?? 'Commerce'}
          </ThemedText>
          {/* Statut d'ouverture en un coup d'œil, près du nom */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
            <ThemedText style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </ThemedText>
          </View>
          {enterprise.description ? (
            <ThemedText style={styles.desc}>{enterprise.description}</ThemedText>
          ) : null}
          {enterprise.adresse ? (
            <View style={styles.infoRow}>
              <MapPin size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.infoText}>{enterprise.adresse}</ThemedText>
            </View>
          ) : null}
          {enterprise.telephone ? (
            <View style={styles.infoRow}>
              <Phone size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.infoText}>{enterprise.telephone}</ThemedText>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Clock size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={styles.infoText}>
              Préparation ~{prepMin} min · Livraison ~{shipMin} min
            </ThemedText>
          </View>
        </View>

        {/* Statut d'ouverture (horaires) */}
        {enterprise.horaires && enterprise.horaires.length > 0 ? (
          tropTard ? (
            <View
              style={[
                styles.hoursBanner,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}>
              <Clock size={16} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.hoursBannerText, { color: colors.warning }]}>
                {liveStatus.messageCommande ??
                  `Il est trop tard pour commander aujourd'hui : ${commerceRef} ferme et la préparation prend ${prepMin} min.`}
              </ThemedText>
            </View>
          ) : estFerme ? (
            <View
              style={[
                styles.hoursBanner,
                { backgroundColor: colors.errorSoft, borderColor: colors.error },
              ]}>
              <Clock size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.hoursBannerText, { color: colors.error }]}>
                {liveStatus.messageFermeture}
              </ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.hoursBanner,
                { backgroundColor: colors.successSoft, borderColor: colors.success },
              ]}>
              <Clock size={16} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.hoursBannerText, { color: colors.success }]}>
                Ouvert actuellement — vous pouvez commander.
                {derniereCommandeLabel ? ` ${derniereCommandeLabel}` : ''}
              </ThemedText>
            </View>
          )
        ) : enterprise.accepte_commandes === false ? (
          <View
            style={[
              styles.hoursBanner,
              { backgroundColor: colors.warningSoft, borderColor: colors.warning },
            ]}>
            <Clock size={16} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.hoursBannerText, { color: colors.warning }]}>
              {liveStatus.messageFermeture}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <ThemedText style={styles.sectionTitle}>Articles</ThemedText>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyProducts}>
            <Package size={36} color={colors.placeholder} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={styles.emptyProductsText}>
              {isRestaurant ? 'Aucun plat au menu pour le moment.' : 'Aucun produit au catalogue.'}
            </ThemedText>
          </View>
        ) : (
          products.map((p) => {
            const allImages = getProductGalleryUrls(p, IMG_THUMB);
            const img = allImages[0] ?? null;
            const disabled = commandesBloquees || !isProductOrderable(p, { enterpriseType: enterprise.type });
            const stockLabel = stockDisplayLabel(p, { enterpriseType: enterprise.type });
            const openGallery = () => {
              if (!allImages.length) return;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setGalleryState({ images: getProductGalleryUrls(p, IMG_HERO), index: 0 });
            };
            return (
              <Pressable
                key={p.id}
                style={styles.productCard}
                onPress={() => router.push(productDetailHref(p) as never)}
                android_ripple={{ color: colors.primaryMuted }}>
                <Pressable
                  style={styles.productThumb}
                  accessibilityRole="button"
                  accessibilityLabel={allImages.length > 1 ? `Voir les ${allImages.length} photos` : 'Voir la photo'}
                  onPress={(e) => {
                    e.stopPropagation();
                    openGallery();
                  }}
                  disabled={!img}>
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={styles.productImg}
                      contentFit="cover"
                      transition={150}
                      recyclingKey={img}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.productImg, styles.productImgPh]}>
                      <ShoppingBasket size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    </View>
                  )}
                  {allImages.length > 1 ? (
                    <View style={styles.galleryBadge}>
                      <Images size={12} color="#FFF" strokeWidth={LUCIDE_STROKE} />
                      <ThemedText style={styles.galleryBadgeTxt}>{allImages.length}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={styles.productName}>
                    {p.nom ?? 'Produit'}
                  </ThemedText>
                  {p.description ? (
                    <ThemedText style={styles.productDesc} numberOfLines={2}>
                      {p.description}
                    </ThemedText>
                  ) : null}
                  <ProductPrice product={p} showBadge />
                  {disabled ? (
                    <ThemedText style={[styles.stock, styles.stockDisabled]}>
                      {commandesBloquees
                        ? tropTard
                          ? 'Plus de commandes aujourd’hui'
                          : 'Commerce fermé'
                        : (stockLabel ?? 'Indisponible')}
                    </ThemedText>
                  ) : stockLabel ? (
                    <ThemedText style={styles.stock}>{stockLabel}</ThemedText>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.addBtn, disabled && styles.addBtnDisabled]}
                  disabled={disabled}
                  onPress={(e) => {
                    e.stopPropagation();
                    addProduct(p);
                  }}
                  android_ripple={{ color: colors.primaryMuted }}>
                  <ShoppingCart
                    size={22}
                    color={disabled ? colors.textMuted : colors.onPrimary}
                    strokeWidth={LUCIDE_STROKE}
                  />
                </Pressable>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
      <GalleryViewer
        visible={Boolean(galleryState)}
        images={galleryState?.images ?? []}
        initialIndex={galleryState?.index ?? 0}
        onClose={() => setGalleryState(null)}
      />
    </ThemedView>
  );
}
