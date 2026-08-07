import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/contexts/app-theme-context';
import { VendorProvider } from '@/contexts/vendor-context';
import { stackModalOptions, stackScreenOptions, stackTabRootOptions } from '@/lib/app-navigation';

export default function VendorRootLayout() {
  const { colors } = useAppTheme();

  return (
    <VendorProvider>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          ...stackScreenOptions(colors),
          contentStyle: { backgroundColor: colors.backgroundAlt },
        }}>
        <Stack.Screen name="(tabs)" options={stackTabRootOptions()} />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="preparation/[id]" />
        <Stack.Screen name="add-product" options={stackModalOptions(colors)} />
        <Stack.Screen name="stock/[id]" />
        <Stack.Screen name="statistics" />
        <Stack.Screen name="delivery" />
        <Stack.Screen name="create-external-delivery" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="shop-info" />
        <Stack.Screen name="horaires" />
        <Stack.Screen name="shop-addresses" />
        <Stack.Screen name="shop-payments" />
        <Stack.Screen name="shop-settings" />
        <Stack.Screen name="help-center" />
      </Stack>
    </VendorProvider>
  );
}
