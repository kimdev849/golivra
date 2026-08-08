import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { CourierProvider } from '@/contexts/courier-context';
import { useAppTheme } from '@/contexts/app-theme-context';
import { stackScreenOptions, stackTabRootOptions } from '@/lib/app-navigation';

export default function CourierRootLayout() {
  const { colors } = useAppTheme();

  return (
    <CourierProvider>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          ...stackScreenOptions(colors),
          contentStyle: { backgroundColor: colors.backgroundAlt },
        }}>
        <Stack.Screen name="(tabs)" options={stackTabRootOptions()} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="mission/[id]" />
      </Stack>
    </CourierProvider>
  );
}
