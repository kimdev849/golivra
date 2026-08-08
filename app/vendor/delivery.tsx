import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorDeliveryPanel } from '@/components/vendor-delivery-panel';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedView } from '@/components/themed-view';

export default function VendorDeliveryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={{ flex: 1 }}>
      <VendorScreenHeader title="LIVRAISONS" />
      <VendorDeliveryPanel />
      <ThemedView style={{ height: insets.bottom }} lightColor="transparent" darkColor="transparent" />
    </ThemedView>
  );
}
