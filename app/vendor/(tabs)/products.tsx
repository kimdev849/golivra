import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorTabHeader } from '@/components/vendor-tab-header';
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
import { vendorStockLabel } from '@/lib/product-stock';
import { resolveRemoteImageUrl } from '@/lib/images';
import { deleteVendorProduct, updateVendorProduct } from '@/lib/vendor-api';
import { hrefVendorStock, VENDOR_HREF } from '@/lib/vendor-nav';

function triggerHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

export default function VendorProductsTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showError, showSuccess, FeedbackOverlay } = useActionFeedback();
  const { shop, products, setProducts, refresh } = useVendor();
  const { palette, labels, commerceType } = useVendorTheme();
  const [tab, setTab] = useState<'all' | 'on' | 'off'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const tabBarHeight = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;
  const fabClearance = tabBarHeight + 20;

  const filtered = useMemo(() => {
    if (tab === 'on') return products.filter((p) => p.enLigne);
    if (tab === 'off') return products.filter((p) => !p.enLigne);
    return products;
  }, [products, tab]);

  const allCount = products.length;
  const onCount = products.filter((p) => p.enLigne).length;
  const offCount = products.filter((p) => !p.enLigne).length;

  const pillDefs = labels.productTabs.map((def) => {
    const n = def.key === 'all' ? allCount : def.key === 'on' ? onCount : offCount;
    return { ...def, label: `${def.label} (${n})` };
  });

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
      <VendorTabHeader
        title={labels.productsHeader}
        right={
          <Pressable
            onPress={() => router.push(VENDOR_HREF.addProduct)}
            style={({ pressed }) => [
              styles.headerAddBtn,
              { backgroundColor: palette.primary, opacity: pressed ? 0.8 : 1 }
            ]}>
            <Plus size={22} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: fabClearance }]}>
        <View style={styles.pillRow}>
          {pillDefs.map((p) => {
            const on = tab === p.key;
            return (
              <Pressable
                key={p.key}
                style={[styles.pill, on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]}
                onPress={() => setTab(p.key)}>
                <ThemedText style={[styles.pillText, on ? { color: colors.onPrimary } : { color: colors.textSecondary }]}>{p.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun produit</ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>
              Ajoutez votre premier {commerceType === 'restaurant' ? 'plat' : 'produit'} pour commencer.
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((p) => {
              const img = resolveRemoteImageUrl(p.imageUrl);
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
                    <ThemedText type="defaultSemiBold" style={[styles.name, { color: colors.text }]}>
                      {p.nom}
                    </ThemedText>
                    <ThemedText style={[styles.meta, { color: colors.textMuted }]}>
                      {formatFcfa(p.prix)} · {commerceType === 'restaurant' ? 'Dispo.' : 'Stock'}:{' '}
                      {commerceType === 'restaurant' ? (p.enLigne ? 'Oui' : 'Non') : vendorStockLabel(p, { enterpriseType: 'boutique' })}
                    </ThemedText>
                  </View>
                  {busyId === p.id ? (
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '800' },
  emptyBox: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
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
