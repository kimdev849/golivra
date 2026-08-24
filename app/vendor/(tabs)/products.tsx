import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Package,
  Plus,
  Search,
  Star,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorTabHeader } from '@/components/vendor-tab-header';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { ThemedView } from '@/components/themed-view';
import { VENDOR_TAB_BAR_PADDING_BOTTOM } from '@/constants/vendor-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useVendor } from '@/contexts/vendor-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { formatFcfa } from '@/lib/format';
import { resolveRemoteImageUrl } from '@/lib/images';
import { deleteVendorProduct, updateVendorProduct } from '@/lib/vendor-api';
import { hrefVendorStock, VENDOR_HREF } from '@/lib/vendor-nav';
import { CardSkeleton } from '@/components/ui/skeleton';
import type { VendorProduct } from '@/lib/vendor-types';
import type { AppPalette } from '@/constants/app-palette';

function triggerHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/** Statut de stock / disponibilité affiché sous le prix, coloré selon l'état. */
function stockStatus(p: VendorProduct, commerceType: 'restaurant' | 'boutique', colors: AppPalette) {
  if (commerceType === 'restaurant') {
    return p.enLigne
      ? { label: 'En carte', color: colors.success, dot: true }
      : { label: 'Indisponible', color: colors.textMuted, dot: false };
  }
  const stock = p.stock ?? 0;
  if (!p.stockIllimite && stock <= 0) {
    return { label: 'Rupture de stock', color: colors.error, dot: false };
  }
  if (!p.stockIllimite && stock <= 5) {
    return { label: `Stock faible · ${stock}`, color: colors.warning, dot: false };
  }
  if (p.stockIllimite) return { label: 'Stock illimité', color: colors.textMuted, dot: false };
  return { label: `${stock} en stock`, color: colors.textMuted, dot: false };
}

function promoPercent(p: VendorProduct): number | null {
  const base = Number(p.prix);
  const promo = Number(p.prixPromo);
  if (!base || !promo || promo <= 0 || promo >= base) return null;
  return Math.round(((base - promo) / base) * 100);
}

/**
 * Photo du produit : image principale, sinon la 1re de la galerie.
 *
 * ⚠️ Aucun filtre « anti-logo » ici : c'est le catalogue du VENDEUR — il doit
 * voir ses vraies photos. Le filtre anti-logo (`isShopLogoImage`) reste côté
 * client (feed) où il évite d'afficher le logo de la boutique à la place d'une
 * photo de produit ; appliqué ici, il masquait des photos légitimes (images
 * stockées dans le dossier enterprises/) → vignettes vides.
 */
function productThumbUrl(p: VendorProduct): string | null {
  return (
    resolveRemoteImageUrl(p.imageUrl) ??
    resolveRemoteImageUrl(p.imagesUrls?.[0] ?? null) ??
    null
  );
}

export default function VendorProductsTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showError, showSuccess, showConfirm, FeedbackOverlay } = useActionFeedback();
  const { shop, products, setProducts, refresh, loading } = useVendor();
  const { palette, labels, commerceType } = useVendorTheme();
  const [tab, setTab] = useState<'all' | 'on' | 'off'>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const tabBarHeight = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  const itemLabel = commerceType === 'restaurant' ? 'plat' : 'produit';

  // Recherche locale par nom, puis filtre en ligne / hors ligne.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? products.filter((p) => p.nom.toLowerCase().includes(q)) : products;
    if (tab === 'on') return base.filter((p) => p.enLigne);
    if (tab === 'off') return base.filter((p) => !p.enLigne);
    return base;
  }, [products, tab, query]);

  const allCount = products.length;
  const onCount = products.filter((p) => p.enLigne).length;
  const offCount = products.filter((p) => !p.enLigne).length;

  const pillDefs = labels.productTabs.map((def) => {
    const n = def.key === 'all' ? allCount : def.key === 'on' ? onCount : offCount;
    return { ...def, label: `${def.label} (${n})` };
  });

  const lowStockProducts = useMemo(
    () => products.filter((p) => !p.stockIllimite && p.stock <= 5 && p.enLigne),
    [products],
  );

  const toggle = async (id: string, value: boolean) => {
    if (!shop?.id) return;
    const prev = products;
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, enLigne: value } : x)));
    setBusyId(id);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée');
      const updated = await updateVendorProduct(token, shop.id, id, { estDisponible: value });
      setProducts((p) => p.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setProducts(prev);
      showError('Erreur', e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (id: string, nom: string) => {
    if (!shop?.id) return;
    triggerHaptic();
    showConfirm({
      title: 'Supprimer',
      message: `Supprimer définitivement « ${nom} » ?`,
      primaryLabel: 'Supprimer',
      secondaryLabel: 'Annuler',
      onPrimary: async () => {
        const prev = products;
        setProducts((p) => p.filter((x) => x.id !== id));
        setBusyId(id);
        try {
          const token = await getSessionToken();
          if (!token) throw new Error('Session expirée');
          await deleteVendorProduct(token, shop.id, id);
          void refresh();
          showSuccess('Supprimé', `« ${nom} » a été retiré du catalogue.`);
        } catch (e) {
          setProducts(prev);
          showError('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const empty = !loading && filtered.length === 0;

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorTabHeader
        title={labels.productsHeader}
        subtitle={`${products.length} ${itemLabel}${products.length > 1 ? 's' : ''} · ${onCount} en ${commerceType === 'restaurant' ? 'carte' : 'ligne'}`}
        right={
          <Pressable
            onPress={() => router.push(VENDOR_HREF.addProduct)}
            style={({ pressed }) => [
              styles.headerAddBtn,
              { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            hitSlop={6}>
            <Plus size={22} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight }]}>
        {/* Recherche */}
        <View style={[styles.search, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Search size={17} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <TextInput
            style={[styles.searchIn, { color: colors.text }]}
            placeholder={`Rechercher un ${itemLabel}…`}
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ) : null}
        </View>

        {/* Alerte stock faible */}
        {lowStockProducts.length > 0 && tab === 'all' && !query ? (
          <View
            style={[styles.alertCard, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <AlertCircle size={18} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.alertText, { color: colors.warning }]} numberOfLines={1}>
              {lowStockProducts.length} {itemLabel}
              {lowStockProducts.length > 1 ? 's' : ''} en stock faible ou épuisé.
            </ThemedText>
            <Pressable
              onPress={() => setTab('off')}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={[styles.alertAction, { color: colors.warning }]}>Voir</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Filtres */}
        <View style={styles.pillRow}>
          {pillDefs.map((p) => {
            const on = tab === p.key;
            return (
              <Pressable
                key={p.key}
                style={[
                  styles.pill,
                  on
                    ? { backgroundColor: palette.primary, borderColor: palette.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTab(p.key);
                }}>
                <ThemedText
                  style={[
                    styles.pillText,
                    { color: on ? colors.onPrimary : colors.textSecondary },
                  ]}>
                  {p.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </View>
        ) : empty ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              {commerceType === 'restaurant' ? (
                <UtensilsCrossed size={26} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              ) : (
                <Package size={26} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              )}
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {query.trim()
                ? 'Aucun résultat'
                : commerceType === 'restaurant'
                  ? 'Votre menu est vide'
                  : 'Aucun produit'}
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>
              {query.trim()
                ? 'Essayez un autre mot-clé.'
                : `Ajoutez votre premier ${itemLabel} pour le proposer aux clients.`}
            </ThemedText>
            {!query.trim() ? (
              <Pressable
                style={({ pressed }) => [
                  styles.emptyCta,
                  { backgroundColor: palette.primary },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push(VENDOR_HREF.addProduct)}>
                <Plus size={18} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.emptyCtaTxt, { color: colors.onPrimary }]}>
                  {labels.addProductFab}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((p) => {
              // Photo du produit : image principale, sinon la 1re de la galerie.
              // Aucun filtre anti-logo ici : c'est le catalogue du vendeur, ses
              // vraies photos doivent s'afficher (voir productThumbUrl).
              const img = productThumbUrl(p);
              const status = stockStatus(p, commerceType, colors);
              const pct = promoPercent(p);
              const showOldPrice = pct != null;
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(hrefVendorStock(p.id))}
                  onLongPress={() => confirmDelete(p.id, p.nom)}
                  delayLongPress={450}
                  android_ripple={{ color: colors.primarySoft }}>
                  {/* Vignette */}
                  <View style={[styles.thumbWrap, { backgroundColor: colors.surfaceMuted }]}>
                    {img ? (
                      <ZoomableImage source={{ uri: img }} style={styles.thumb} contentFit="cover" />
                    ) : commerceType === 'restaurant' ? (
                      <UtensilsCrossed size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                    ) : (
                      <Package size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                    )}
                    {pct != null ? (
                      <View style={[styles.promoBadge, { backgroundColor: colors.error }]}>
                        <ThemedText style={styles.promoBadgeTxt}>-{pct}%</ThemedText>
                      </View>
                    ) : null}
                  </View>

                  {/* Corps */}
                  <View style={styles.body}>
                    <View style={styles.topRow}>
                      <View style={styles.nameWrap}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={[styles.name, { color: colors.text }]}
                          numberOfLines={1}>
                          {p.nom}
                        </ThemedText>
                        {p.enVedette ? (
                          <View style={styles.vedetteRow}>
                            <Star size={11} color="#F5A524" fill="#F5A524" strokeWidth={0} />
                            <ThemedText style={[styles.vedetteTxt, { color: colors.textMuted }]}>
                              En vedette
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      {busyId === p.id ? (
                        <View style={styles.switchSlot}>
                          <View style={[styles.switchBusy, { backgroundColor: colors.surfaceMuted }]} />
                        </View>
                      ) : (
                        <Pressable onPress={() => {}} hitSlop={4}>
                          <Switch
                            value={p.enLigne}
                            onValueChange={(v) => void toggle(p.id, v)}
                            trackColor={{ false: colors.borderStrong, true: colors.success }}
                            thumbColor={p.enLigne ? colors.surface : colors.textMuted}
                            accessibilityLabel={p.enLigne ? `Masquer ${p.nom}` : `Publier ${p.nom}`}
                          />
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.priceRow}>
                      <ThemedText style={[styles.price, { color: colors.primary }]}>
                        {showOldPrice ? formatFcfa(p.prixPromo as number) : formatFcfa(p.prix)}
                      </ThemedText>
                      {showOldPrice ? (
                        <ThemedText style={[styles.oldPrice, { color: colors.textMuted }]}>
                          {formatFcfa(p.prix)}
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: status.color, opacity: status.dot ? 1 : 0.35 },
                        ]}
                      />
                      <ThemedText style={[styles.statusTxt, { color: status.color }]} numberOfLines={1}>
                        {status.label}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {!loading && filtered.length > 0 ? (
          <ThemedText style={[styles.footerHint, { color: colors.textMuted }]}>
            Appui long sur un {itemLabel} pour le supprimer.
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 18, paddingTop: 10 },

  // Recherche
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchIn: { flex: 1, fontSize: 15, paddingVertical: 0 },

  // Alerte stock
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600' },
  alertAction: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },

  // Filtres
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: '800' },

  // Carte produit
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  promoBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  promoBadgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  body: { flex: 1, gap: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameWrap: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  vedetteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  vedetteTxt: { fontSize: 10.5, fontWeight: '700' },
  switchSlot: { minWidth: 46, alignItems: 'flex-end' },
  switchBusy: { width: 42, height: 23, borderRadius: 11.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11.5, fontWeight: '700' },

  // États vides
  emptyBox: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 6 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCtaTxt: { fontSize: 14, fontWeight: '800' },

  footerHint: { fontSize: 11.5, textAlign: 'center', marginTop: 16, opacity: 0.75 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
