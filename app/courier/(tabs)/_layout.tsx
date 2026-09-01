import { useFocusEffect } from '@react-navigation/native';
import { Tabs } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Bike, ClipboardList, User } from 'lucide-react-native';

import { CourierTabBar } from '@/components/courier/courier-tab-bar';
import { LUCIDE_STROKE } from '@/constants/icons';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { useCourierPalette } from '@/lib/courier-theme';
import { homeHrefForRole, isCourierRole } from '@/lib/roles';

type Me = { role?: string | null };

export default function CourierTabsLayout() {
  const router = useRouter();
  const palette = useCourierPalette();
  const [ok, setOk] = useState(false);

  const verifySession = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) {
      setOk(false);
      router.replace('/auth');
      return;
    }
    try {
      const me = await apiFetch<Me>('/api/auth/me', { method: 'GET', token });
      if (!isCourierRole(me.role)) {
        setOk(false);
        router.replace(homeHrefForRole(me.role));
        return;
      }
      setOk(true);
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

  if (!ok) {
    return (
      <View style={[styles.loader, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <CourierTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.tabBarInactive,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Bike size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
