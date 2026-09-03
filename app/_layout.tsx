import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View } from 'react-native';
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
import { useAppColors } from '@/hooks/use-app-colors';
import { useIsOffline } from '@/hooks/use-network-status';
import { useWebNotifications } from '@/hooks/use-web-notifications';
import { prefetchClientCatalog } from '@/lib/client-data';
import { stackAuthOptions, stackScreenOptions } from '@/lib/app-navigation';
import { syncSystemBars } from '@/lib/system-ui';
import { startServerWarmup } from '@/lib/server-warmup';
import { startUpdateChecker } from '@/lib/update-checker';
import { installGlobalErrorReporting } from '@/lib/error-reporting';
import {
  initializeNotifications,
  setupNotificationListeners,
  handleInitialNotification,
  resyncNotificationsOnForeground,
} from '@/lib/notifications-service';


// PAS d'anchor : la route initiale du stack racine doit être `index` (le
// landing / bootstrap). Un `anchor: '(tabs)'` faisait démarrer l'app
// directement sur les onglets (redirigés vers /auth sans session), si bien
// que l'écran d'introduction (image + slogan + Se connecter) n'apparaissait
// JAMAIS au premier lancement. `index` décide ensuite lui-même de la route
// (intro → /auth → accueil) via resolveBootstrapTarget().

function RootNavigation() {
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    installGlobalErrorReporting();
  }, []);

  // Mises à jour OTA : vérifie au lancement + au retour au premier plan, et
  // télécharge les nouvelles versions (elles s'appliquent au prochain lancement).
  useEffect(() => {
    startUpdateChecker();
  }, []);

  // Warm-up du serveur API : ping /health au lancement puis toutes les 4 min
  // pour éviter le cold start Render (le panier/les commandes restent rapides).
  useEffect(() => {
    startServerWarmup();
  }, []);

  // Barre de navigation système transparente + boutons adaptés au thème
  // (edge-to-edge propre : plus de bande blanche ni d'écran coupé en bas).
  useEffect(() => {
    void syncSystemBars(isDark);
  }, [isDark]);

  // ── Notifications web (Navigation API navigateur + son, polling léger) ──
  useWebNotifications();

  // ── Initialisation des notifications push au démarrage (natif uniquement) ──
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Premier lancement (jamais connecté) : on DIFFÈRE la demande de permission
    // push — le dialogue système ne doit pas apparaître sur le landing / la
    // connexion avant que l'utilisateur n'ait vu l'app. initializeNotifications()
    // (canal Android + permission + token) n'est lancé qu'avec une session
    // active ; après connexion, persistAuthSession() le fait déjà via
    // ensurePushTokenRegistered().
    let alive = true;
    void (async () => {
      const { getSessionToken } = await import('@/lib/auth');
      const token = await getSessionToken();
      if (!alive || !token) return;
      void initializeNotifications();
    })();

    void handleInitialNotification();

    const cleanup = setupNotificationListeners(
      (_notification) => {},
      (_response) => {},
    );

    // Au retour au premier plan : recrée le canal Android (certains fabricants
    // le purgent en économie d'énergie) et ré-enregistre le token si la
    // permission a été accordée entre-temps → les push « app fermée » arrivent
    // enfin, avec son et vibration.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void resyncNotificationsOnForeground();
      }
    });

    return () => {
      alive = false;
      cleanup();
      appStateSub.remove();
    };
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
        <Stack.Screen name="auth" options={stackAuthOptions(colors)} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup" options={stackAuthOptions(colors)} />
        <Stack.Screen name="signup/choose" options={stackAuthOptions(colors)} />
        <Stack.Screen name="signup/client" options={stackAuthOptions(colors)} />
        <Stack.Screen name="signup/restaurant" options={stackAuthOptions(colors)} />
        <Stack.Screen name="signup/boutique" options={stackAuthOptions(colors)} />
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


/**
 * Conteneur racine avec fond dynamique (clair/sombre).
 *
 * Sans ce composant, les vues racines (`GestureHandlerRootView` + `View`
 * imbriqué) n'ont pas de `backgroundColor`. En edge-to-edge, la barre
 * de navigation système est transparente : la fenêtre Android (blanche par
 * défaut) transparaît en bas de l'écran — surtout visible en mode sombre
 * sous forme de bande blanche au-dessus des boutons de navigation.
 */
function ThemedRootContainer({ children }: { children: React.ReactNode }) {
  const colors = useAppColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </View>
  );
}

export const queryClient = new QueryClient({
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

function ThemedGestureRoot({ children }: { children: React.ReactNode }) {
  const { isDark } = useAppTheme();
  const bg = isDark ? '#0B0C0E' : '#FFFFFF';
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
      {children}
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    // Empêche l'auto-hide du splash natif et le garde-awake résiduel d'une
    // session précédente. Sans cet appel, expo-splash-screen garde l'écran
    // allumé indéfiniment et toute réactivation successive échoue avec
    // "Unable to activate keep awake".
    SplashScreen.preventAutoHideAsync().catch(() => {});
  }, []);

  // warmAppCaches est géré par resolveBootstrapTarget() dans app/index.tsx

  useSilentReconnectRefresh();

  // Le splash JS gère lui-même l'attente du bootstrap (le fade-out final est
  // retardé jusqu'à `bootstrapSettled`, max 2 s) : à ce stade onAnimationComplete
  // n'est appelé qu'une fois l'app prête. Ici on démonte juste le composant.
  const handleSplashDone = useCallback(() => {
    setSplashVisible(false);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <TextScaleProvider>
          <ThemedGestureRoot>
            <BiometricAppGate>
              <AppStatusGate>
                <ThemedRootContainer>
                  {splashVisible && (
                    <CustomSplashScreen onAnimationComplete={handleSplashDone} />
                  )}
                  <OfflineBanner />
                  <AnnouncementBanner />
                  <RootNavigation />
                  {splashVisible && <StatusBar style="light" />}
                  <AppToastHost />
                </ThemedRootContainer>
              </AppStatusGate>
            </BiometricAppGate>
          </ThemedGestureRoot>
        </TextScaleProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

export default RootLayout;

