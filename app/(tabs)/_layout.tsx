import { useFocusEffect } from '@react-navigation/native';
import { Tabs } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { ClipboardList, Heart, Home, ShoppingCart, UserRound } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState, createContext, useContext } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { GolivraTabBar } from '@/components/golivra-tab-bar';
import { WebNavbar, NAVBAR_HEIGHT } from '@/components/web-navbar';
import { CartProvider } from '@/contexts/cart-context';
import { LUCIDE_STROKE } from '@/constants/icons';
import { Colors } from '@/constants/theme';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { isAuthErrorMessage } from '@/lib/app-bootstrap';
import { hydrateSessionToken } from '@/lib/auth';
import { fetchAuthMe, prefetchClientCatalog } from '@/lib/client-data';
import { isMerchantRole } from '@/lib/roles';
import { VENDOR_HREF } from '@/lib/vendor-nav';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const appColors = useAppColors();
  const router = useRouter();
  const [sessionOk, setSessionOk] = useState(true);
  const isDesktop = useIsWebDesktop();
  const [desktopSearch, setDesktopSearch] = useState('');
  const setSearchValue = useCallback((v: string) => setDesktopSearch(v), []);
  const searchCtx = useMemo(() => ({ searchValue: desktopSearch, setSearchValue }), [desktopSearch, setSearchValue]);

  const verifySessionInBackground = useCallback(
    async (token: string) => {
      prefetchClientCatalog();
      try {
        const me = await fetchAuthMe(token);
        if (isMerchantRole(me.role)) {
          router.replace(VENDOR_HREF.root);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (isAuthErrorMessage(msg)) {
          // ══════════════════════════════════════════════════════════
          // DA « zéro blocage » : token expire → on reste en mode
          // invité au lieu de rediriger vers /auth. L'utilisateur
          // continue à naviguer et sera redirigé quand il essaiera
          // une action personnelle.
          // ══════════════════════════════════════════════════════════
          console.log('[auth] Token expiré, mode invité activé');
          setSessionOk(true);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    let alive = true;
    void hydrateSessionToken().then((token) => {
      if (!alive) return;
      if (!token) {
        // ══════════════════════════════════════════════════════════
        // DA « zéro blocage » : pas de token → mode invité.
        // L'utilisateur découvre l'app librement.
        // L'auth n'est demandée que pour les actions personnelles.
        // ══════════════════════════════════════════════════════════
        setSessionOk(true);
        prefetchClientCatalog();
        return;
      }
      setSessionOk(true);
      void verifySessionInBackground(token);
    });
    return () => {
      alive = false;
    };
  }, [router, verifySessionInBackground]);

  useFocusEffect(
    useCallback(() => {
      void hydrateSessionToken().then((token) => {
        // DA « zéro blocage » : pas de token → on reste sur la page.
        if (token) {
          void verifySessionInBackground(token);
        }
      });
    }, [router, verifySessionInBackground]),
  );

  if (!sessionOk) return null;

  // ── Desktop : top navbar + tabs sans bottom bar ──────────────
  if (isDesktop) {
    return (
      <CartProvider>
        <DesktopSearchContext.Provider value={searchCtx}>
        <View style={styles.desktopRoot}>
          <WebNavbar searchValue={searchCtx.searchValue} onSearchChange={searchCtx.setSearchValue} />
          <View style={styles.desktopContent}>
            <Tabs
              tabBar={() => null}
              screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
                headerShown: false,
              }}>
              <Tabs.Screen
                name="index"
                options={{
                  title: 'Accueil',
                  tabBarIcon: ({ color, focused }) => (
                    <Home size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
                  ),
                }}
              />
              <Tabs.Screen
                name="explore"
                options={{
                  title: 'Commandes',
                  tabBarIcon: ({ color, focused }) => (
                    <ClipboardList size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
                  ),
                }}
              />
              <Tabs.Screen
                name="cart"
                options={{
                  title: 'Panier',
                  tabBarIcon: ({ color, focused }) => (
                    <ShoppingCart size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
                  ),
                }}
              />
              <Tabs.Screen
                name="favorites"
                options={{
                  title: 'Favoris',
                  tabBarIcon: ({ color, focused }) => (
                    <Heart
                      size={21}
                      color={color}
                      fill={focused ? color : 'transparent'}
                      strokeWidth={focused ? 2.4 : LUCIDE_STROKE}
                    />
                  ),
                }}
              />
              <Tabs.Screen
                name="profile"
                options={{
                  title: 'Compte',
                  tabBarIcon: ({ color, focused }) => (
                    <UserRound size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
                  ),
                }}
              />
            </Tabs>
          </View>
        </View>
        </DesktopSearchContext.Provider>
      </CartProvider>
    );
  }

  // ── Mobile : bottom tab bar classique ────────────────────────
  // Web & natif : position:absolute, bottom:0 pour que la tab bar
  // chevauche le contenu scrollable sans le pousser vers le haut.
  // Sur web : pas de position:absolute — la tab bar vit dans le flux
  // flex normal de BottomTabView (screen flex:1 + tab bar en bas).
  // Sur natif : position:absolute pour edge-to-edge.
  const mobileTabBarStyle = Platform.OS === 'web'
    ? { borderTopWidth: 0 as const, elevation: 0 as const, backgroundColor: appColors.surface }
    : { position: 'absolute' as const, borderTopWidth: 0, elevation: 0, backgroundColor: 'transparent' };

  return (
    <CartProvider>
      <Tabs
        tabBar={(props) => <GolivraTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: mobileTabBarStyle,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, focused }) => (
              <Home size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Commandes',
            tabBarIcon: ({ color, focused }) => (
              <ClipboardList size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: 'Panier',
            tabBarIcon: ({ color, focused }) => (
              <ShoppingCart size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favoris',
            tabBarIcon: ({ color, focused }) => (
              <Heart
                size={21}
                color={color}
                fill={focused ? color : 'transparent'}
                strokeWidth={focused ? 2.4 : LUCIDE_STROKE}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Compte',
            tabBarIcon: ({ color, focused }) => (
              <UserRound size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
            ),
          }}
        />
      </Tabs>
    </CartProvider>
  );
}

// ── Search context (lifted to share between WebNavbar and home screen) ──
export type DesktopSearchContextType = {
  searchValue: string;
  setSearchValue: (v: string) => void;
};

const DesktopSearchContext = createContext<DesktopSearchContextType>({
  searchValue: '',
  setSearchValue: () => {},
});

export function useDesktopSearch() {
  return useContext(DesktopSearchContext);
}

const styles = StyleSheet.create({
  desktopRoot: {
    flex: 1,
  },
  desktopContent: {
    flex: 1,
  },
});
