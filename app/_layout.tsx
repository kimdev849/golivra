import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import 'react-native-reanimated';

import { BiometricAppGate } from '@/components/biometric-app-gate';
import { OfflineBanner } from '@/components/offline-banner';
import { CustomSplashScreen } from '@/components/splash-screen';
import { AppThemeProvider, useAppTheme } from '@/contexts/app-theme-context';
import { useIsOffline } from '@/hooks/use-network-status';
import { warmAppCaches } from '@/lib/app-bootstrap';
import { prefetchClientCatalog } from '@/lib/client-data';
import { stackAuthOptions, stackScreenOptions } from '@/lib/app-navigation';
import { installGlobalErrorReporting } from '@/lib/error-reporting';
import {
  initializeNotifications,
  setupNotificationListeners,
  handleInitialNotification,
} from '@/lib/notifications-service';

const sentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ||
  String((Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? '').trim();

Sentry.init({
  dsn: sentryDsn || undefined,
  tracesSampleRate: 1.0,
  enabled: Boolean(sentryDsn) && !__DEV__,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigation({ onReady }: { onReady: () => void }) {
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    installGlobalErrorReporting();
  }, []);

  // ── Initialisation des notifications push au démarrage (natif uniquement) ──
  useEffect(() => {
    if (Platform.OS === 'web') return;

    void initializeNotifications();
    void handleInitialNotification();

    const cleanup = setupNotificationListeners(
      (_notification) => {},
      (_response) => {},
    );

    return cleanup;
  }, []);

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [isDark, colors],
  );

  return (
    <NavThemeProvider value={navTheme}>
      <Stack 
        screenOptions={stackScreenOptions(colors)}
        onLayout={onReady}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" options={stackAuthOptions()} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup" options={stackAuthOptions()} />
        <Stack.Screen name="signup/choose" options={stackAuthOptions()} />
        <Stack.Screen name="signup/client" options={stackAuthOptions()} />
        <Stack.Screen name="signup/restaurant" options={stackAuthOptions()} />
        <Stack.Screen name="signup/boutique" options={stackAuthOptions()} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="vendor" options={{ animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="courier" options={{ animation: 'fade', animationDuration: 200 }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="account-settings" />
        <Stack.Screen name="my-addresses" />
        <Stack.Screen name="payment-methods" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="how-multi-delivery" />
        <Stack.Screen name="order-deliveries-summary" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <StatusBar style={colors.statusBar} />
    </NavThemeProvider>
  );
}


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
  },
});

function useSilentReconnectRefresh() {
  const offline = useIsOffline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      prefetchClientCatalog();
      void queryClient.invalidateQueries();
    }
  }, [offline]);
}

function RootLayout() {
  const [appReady, setAppReady] = (require('react') as any).useState(false);
  const [splashVisible, setSplashVisible] = (require('react') as any).useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await warmAppCaches();
      } finally {
        setAppReady(true);
      }
    };
    void init();
  }, []);

  useSilentReconnectRefresh();

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <BiometricAppGate>
          <View style={{ flex: 1 }}>
            {splashVisible && (
              <CustomSplashScreen onAnimationComplete={() => setSplashVisible(false)} />
            )}
            <OfflineBanner />
            <RootNavigation onReady={() => {}} />
          </View>
        </BiometricAppGate>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);

