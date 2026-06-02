import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorMenuItemFormWizard } from '@/components/vendor-menu-item-form-wizard';
import { VendorProductFormWizard } from '@/components/vendor-product-form-wizard';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVendor } from '@/contexts/vendor-context';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { menuItemToFormValues } from '@/lib/vendor-menu-item-form-init';
import { productToFormValues } from '@/lib/vendor-product-form-init';
import { deleteVendorProduct } from '@/lib/vendor-api';
import { VENDOR_HREF } from '@/lib/vendor-nav';

export default function VendorStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shop, products, setProducts, refresh } = useVendor();
  const { commerceType, palette } = useVendorTheme();
  const productId = typeof id === 'string' ? id : '';
  const existing = products.find((x) => x.id === productId);

  if (commerceType === 'boutique' && existing && shop?.id) {
    return (
      <BoutiqueProductEdit
        existing={existing}
        enterpriseId={shop.id}
        palette={palette}
        insets={insets}
        onSaved={async (updated) => {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          router.replace(VENDOR_HREF.productsTab);
          void refresh();
        }}
        onDelete={async (): Promise<void> => {
          const token = await getSessionToken();
          if (!token) throw new Error('Session expirée');
          await deleteVendorProduct(token, shop!.id, existing.id);
          setProducts((prev) => prev.filter((p) => p.id !== existing.id));
          router.replace(VENDOR_HREF.productsTab);
        }}
      />
    );
  }

  if (existing && shop?.id) {
    return (
      <RestaurantMenuItemEdit
        existing={existing}
        enterpriseId={shop.id}
        palette={palette}
        insets={insets}
        onSaved={async (updated) => {
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          router.replace(VENDOR_HREF.productsTab);
          void refresh();
        }}
        onDelete={async (): Promise<void> => {
          const token = await getSessionToken();
          if (!token) throw new Error('Session expirée');
          await deleteVendorProduct(token, shop!.id, existing.id);
          setProducts((prev) => prev.filter((p) => p.id !== existing.id));
          router.replace(VENDOR_HREF.productsTab);
        }}
      />
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Produit" />
      <ThemedText style={{ padding: 24 }}>Produit introuvable.</ThemedText>
    </ThemedView>
  );
}

function BoutiqueProductEdit({
  existing,
  enterpriseId,
  palette,
  insets,
  onSaved,
  onDelete,
}: {
  existing: NonNullable<ReturnType<typeof useVendor>['products'][number]>;
  enterpriseId: string;
  palette: { primary: string; primaryDeep: string };
  insets: { bottom: number };
  onSaved: (p: typeof existing) => void | Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const router = useRouter();
  const initialValues = useMemo(() => productToFormValues(existing), [existing]);

  const confirmDelete = () => {
    Alert.alert('Supprimer', `Supprimer « ${existing.nom} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void onDelete().catch((e: unknown) =>
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec'),
          );
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Modifier le produit" />
      <View style={{ flex: 1 }}>
        <VendorProductFormWizard
          enterpriseId={enterpriseId}
          palette={palette}
          mode="edit"
          productId={existing.id}
          initialValues={initialValues}
          onCancel={() => router.back()}
          onSaved={(p) => void onSaved(p)}
        />
      </View>
      <Pressable
        style={[styles.deleteBtn, { marginBottom: Math.max(insets.bottom, 8) }]}
        onPress={confirmDelete}>
        <ThemedText style={styles.deleteTxt}>Supprimer ce produit</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function RestaurantMenuItemEdit({
  existing,
  enterpriseId,
  palette,
  insets,
  onSaved,
  onDelete,
}: {
  existing: NonNullable<ReturnType<typeof useVendor>['products'][number]>;
  enterpriseId: string;
  palette: { primary: string; primaryDeep: string };
  insets: { bottom: number };
  onSaved: (p: typeof existing) => void | Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const router = useRouter();
  const initialValues = useMemo(() => menuItemToFormValues(existing), [existing]);

  const confirmDelete = () => {
    Alert.alert('Supprimer', `Supprimer « ${existing.nom} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          void onDelete().catch((e: unknown) =>
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Échec'),
          );
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Modifier le plat" />
      <View style={{ flex: 1 }}>
        <VendorMenuItemFormWizard
          enterpriseId={enterpriseId}
          palette={palette}
          mode="edit"
          productId={existing.id}
          initialValues={initialValues}
          onCancel={() => router.back()}
          onSaved={(p) => void onSaved(p)}
        />
      </View>
      <Pressable
        style={[styles.deleteBtn, { marginBottom: Math.max(insets.bottom, 8) }]}
        onPress={confirmDelete}>
        <ThemedText style={styles.deleteTxt}>Supprimer ce plat</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  deleteBtn: {
    marginHorizontal: 18,
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  deleteTxt: { color: '#B91C1C', fontWeight: '800', fontSize: 15 },
});
