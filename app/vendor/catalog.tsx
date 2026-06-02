import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorAddProductFab } from '@/components/vendor-add-product-fab';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
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
import { vendorStockLabel } from '@/lib/product-stock';
import { deleteVendorProduct, updateVendorProduct } from '@/lib/vendor-api';
import { hrefVendorStock, VENDOR_HREF } from '@/lib/vendor-nav';

function triggerHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

export default function VendorCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showError, showSuccess, FeedbackOverlay } = useActionFeedback();
  const { shop, products, setProducts, refresh } = useVendor();
  const { commerceType, palette } = useVendorTheme();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const tabBarHeight = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;
  const fabBottom = tabBarHeight + 12;
  const fabClearance = fabBottom + 76;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.nom.toLowerCase().includes(q));
  }, [products, query]);

  const onCount = products.filter((p) => p.enLigne).length;

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
    Alert.alert(
      'Supprimer',
      `Supprimer définitivement « ${nom} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const prev = products;
            setProducts((p) => p.filter((x) => x.id !== id));
            setBusyId(id);
            try {
              const token = await getSessionToken();
              if (!token) throw new Error('Session expirée');
              await deleteVendorProduct(token, shop.id, id);
              void refresh();
              showSuccess('Produit supprimé', `« ${nom} » a été retiré du catalogue.`);
            } catch (e) {
              setProducts(prev);
              showError('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title="CATALOGUE" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: fabClearance }]}>
        <View style={[styles.search, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <TextInput
            style={[styles.searchIn, { color: colors.text }]}
            placeholder={`Rechercher un ${commerceType === 'restaurant' ? 'plat' : 'produit'}…`}
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <View style={[styles.statRow, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <ThemedText style={[styles.statText, { color: colors.primaryDeep }]}>
            {onCount} en ligne · {products.length} au total
          </ThemedText>
        </View>

        <View style={[styles.hint, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <ThemedText style={[styles.hintText, { color: colors.textMuted }]}>
            Astuce : appui long sur un produit pour le supprimer en une action.
          </ThemedText>
        </View>

        {filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              {query.trim()
                ? 'Aucun résultat pour cette recherche.'
                : `Aucun ${commerceType === 'restaurant' ? 'plat' : 'produit'} dans votre catalogue.`}
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((p) => {
              const img = resolveRemoteImageUrl(p.imageUrl);
              const isBusy = busyId === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(hrefVendorStock(p.id))}
                  onLongPress={() => confirmDelete(p.id, p.nom)}
                  delayLongPress={450}
                  android_ripple={{ color: colors.primarySoft }}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.name, { color: colors.text }]}
                      numberOfLines={1}>
                      {p.nom}
                    </ThemedText>
                    <ThemedText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                      {formatFcfa(p.prix)} · {commerceType === 'restaurant'
                        ? (p.enLigne ? 'En ligne' : 'Hors ligne')
                        : `Stock ${vendorStockLabel(p, { enterpriseType: 'boutique' })}`}
                    </ThemedText>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator color={palette.primary} />
                  ) : (
                    <Switch
                      value={p.enLigne}
                      onValueChange={(v) => void toggle(p.id, v)}
                      trackColor={{ false: colors.borderStrong, true: colors.success }}
                      thumbColor={p.enLigne ? colors.surface : colors.textMuted}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <VendorAddProductFab
        label={commerceType === 'restaurant' ? 'Ajouter un plat' : 'Ajouter un produit'}
        bottom={fabBottom}
        onPress={() => router.push(VENDOR_HREF.addProduct)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  searchIn: { flex: 1, fontSize: 15 },
  statRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  statText: { fontSize: 12, fontWeight: '800' },
  hint: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  hintText: { fontSize: 12 },
  emptyBox: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  name: { fontSize: 15 },
  meta: { fontSize: 13, marginTop: 4 },
});
