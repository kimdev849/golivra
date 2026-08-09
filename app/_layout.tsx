import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AnnouncementBanner } from '@/components/announcement-banner';
import { AppStatusGate } from '@/components/app-status-gate';
import { AppToastHost } from '@/components/app-toast-host';
import { BiometricAppGate } from '@/components/biometric-app-gate';
import { OfflineBanner } from '@/components/offline-banner';
import { CustomSplashScreen } from '@/components/splash-screen';
import { AppThemeProvider, useAppTheme } from '@/contexts/app-theme-context';
import { TextScaleProvider } from '@/contexts/text-scale-context';
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


export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigation() {
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
      <Stack screenOptions={stackScreenOptions(colors)}>
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
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="account-settings" />
        <Stack.Screen name="my-addresses" />
        <Stack.Screen name="payment-methods" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="discover-all" />
        <Stack.Screen name="help-center" />
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
  const [appReady, setAppReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    // Empêche l'auto-hide du splash natif et le garde-awake résiduel d'une
    // session précédente. Sans cet appel, expo-splash-screen garde l'écran
    // allumé indéfiniment et toute réactivation successive échoue avec
    // "Unable to activate keep awake".
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

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

  const handleSplashDone = useCallback(() => {
    setSplashVisible(false);
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!appReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TextScaleProvider>
        <AppThemeProvider>
          <BiometricAppGate>
            <AppStatusGate>
              <View style={{ flex: 1 }}>
                {splashVisible && (
                  <CustomSplashScreen onAnimationComplete={handleSplashDone} />
                )}
                <OfflineBanner />
                <AnnouncementBanner />
                <RootNavigation />
                <AppToastHost />
              </View>
            </AppStatusGate>
          </BiometricAppGate>
        </AppThemeProvider>
        </TextScaleProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

export default RootLayout;

