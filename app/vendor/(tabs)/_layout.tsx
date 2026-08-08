import { useFocusEffect } from '@react-navigation/native';
import { Tabs, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ClipboardList, Home, LayoutGrid, Package, Truck, UtensilsCrossed } from 'lucide-react-native';

import { VendorTabBar } from '@/components/vendor-tab-bar';
import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { Colors } from '@/constants/theme';
import { useVendor } from '@/contexts/vendor-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSessionToken } from '@/lib/auth';
import { homeHrefForRole, isMerchantRole } from '@/lib/roles';
import { apiFetch } from '@/lib/api';
import { vendorPalette } from '@/lib/vendor-theme';

type Me = { role?: string | null; roleId?: string | number; role_id?: string | number };

export default function VendorTabsLayout() {
  const colorScheme = useColorScheme();
  const colors = useAppColors();
  const router = useRouter();
  const { shop, pendingModeration, loading: vendorLoading } = useVendor();
  const [ok, setOk] = useState(false);
  const commerceType = shop?.type === 'restaurant' ? 'restaurant' : 'boutique';
  const palette = vendorPalette(commerceType);

  const verifySession = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) {
      setOk(false);
      router.replace('/auth');
      return;
    }
    try {
      const me = await apiFetch<Me>('/api/auth/me', { method: 'GET', token });
      if (!isMerchantRole(me.role)) {
        setOk(false);
        router.replace(homeHrefForRole(me.role));
        return;
      }
      setOk(true);
      // Filet de sécurité : garantit que le token push de l'appareil est
      // (ré)enregistré quand le vendeur ouvre son espace, même si la
      // connexion a eu lieu après le démarrage de l'app.
      void import('@/lib/notifications-service')
        .then((m) => m.ensurePushTokenRegistered?.())
        .catch(() => undefined);
    } catch {
      setOk(false);
      router.replace('/auth');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void verifySession();
    }, [verifySession]),
  );

  if (!ok || vendorLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {pendingModeration ? (
        <View style={[styles.moderationBanner, { backgroundColor: colors.warningSoft, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.moderationTitle, { color: colors.warning }]}>Compte en attente</ThemedText>
          <ThemedText style={[styles.moderationText, { color: colors.textSecondary }]}>
            Votre commerce n’est pas encore visible. L’équipe GoLivra vérifie votre inscription. Vous pouvez déjà
            préparer votre menu ou vos produits.
          </ThemedText>
        </View>
      ) : null}
      <Tabs
        tabBar={(p) => <VendorTabBar {...p} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
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
            tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Commandes',
            tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: commerceType === 'restaurant' ? 'Menu' : 'Produits',
            tabBarIcon: ({ color }) =>
              commerceType === 'restaurant' ? (
                <UtensilsCrossed size={22} color={color} strokeWidth={LUCIDE_STROKE} />
              ) : (
                <Package size={22} color={color} strokeWidth={LUCIDE_STROKE} />
              ),
          }}
        />
        <Tabs.Screen
          name="deliveries"
          options={{
            title: 'Livraisons',
            tabBarIcon: ({ color }) => <Truck size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Plus',
            tabBarIcon: ({ color }) => <LayoutGrid size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  moderationBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  moderationTitle: {
    fontWeight: '800',
    fontSize: 14,
  },
  moderationText: {
    fontSize: 12,
    lineHeight: 17,
  },
});

