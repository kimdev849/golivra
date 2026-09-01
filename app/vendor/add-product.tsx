import { useRouter } from '@/hooks/use-safe-router';
import { ActivityIndicator, View } from 'react-native';

import { VendorMenuItemFormWizard } from '@/components/vendor-menu-item-form-wizard';
import { VendorProductFormWizard } from '@/components/vendor-product-form-wizard';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedView } from '@/components/themed-view';
import { useVendor } from '@/contexts/vendor-context';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { VENDOR_HREF } from '@/lib/vendor-nav';

export default function VendorAddProductScreen() {
  const router = useRouter();
  const { shop, refresh, loading } = useVendor();
  const { palette } = useVendorTheme();
  const isRestaurant = shop?.type === 'restaurant';

  if (loading || !shop?.id) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <VendorScreenHeader title={isRestaurant ? 'Ajouter un plat' : 'Nouveau produit'} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </ThemedView>
    );
  }

  if (!isRestaurant) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <VendorScreenHeader title="Nouveau produit" />
        <VendorProductFormWizard
          enterpriseId={shop.id}
          palette={palette}
          mode="create"
          onCancel={() => router.back()}
          onSaved={async () => {
            router.replace(VENDOR_HREF.productsTab);
            void refresh();
          }}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <VendorScreenHeader title="Ajouter un plat" />
      <View style={{ flex: 1 }} key={`menu-wizard-${shop.id}`}>
        <VendorMenuItemFormWizard
          enterpriseId={shop.id}
          palette={palette}
          mode="create"
          onCancel={() => router.back()}
          onSaved={async () => {
            router.replace(VENDOR_HREF.productsTab);
            void refresh();
          }}
        />
      </View>
    </ThemedView>
  );
}
