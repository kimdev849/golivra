import { useFocusEffect } from '@react-navigation/native';
import { Tabs, useRouter } from 'expo-router';
import { ClipboardList, Heart, Home, ShoppingBag, UserRound } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';

import { GolivraTabBar } from '@/components/golivra-tab-bar';
import { CartProvider } from '@/contexts/cart-context';
import { LUCIDE_STROKE } from '@/constants/icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isAuthErrorMessage } from '@/lib/app-bootstrap';
import { hydrateSessionToken } from '@/lib/auth';
import { fetchAuthMe, prefetchClientCatalog } from '@/lib/client-data';
import { isMerchantRole } from '@/lib/roles';
import { VENDOR_HREF } from '@/lib/vendor-nav';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [sessionOk, setSessionOk] = useState(true);

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
          router.replace('/auth');
          setSessionOk(false);
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
        setSessionOk(false);
        router.replace('/auth');
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
        if (!token) {
          router.replace('/auth');
          return;
        }
        void verifySessionInBackground(token);
      });
    }, [router, verifySessionInBackground]),
  );

  if (!sessionOk) return null;

  return (
    <CartProvider>
      <Tabs
        tabBar={(props) => <GolivraTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            position: 'absolute',
            borderTopWidth: 0,
            elevation: 0,
            backgroundColor: 'transparent',
          },
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
              <ShoppingBag size={21} color={color} strokeWidth={focused ? 2.4 : LUCIDE_STROKE} />
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
