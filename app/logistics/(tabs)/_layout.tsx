import { useFocusEffect } from '@react-navigation/native';
import { Tabs } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AlertTriangle, Truck, Users, BarChart3, Home, Bell } from 'lucide-react-native';

import { LUCIDE_STROKE } from '@/constants/icons';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { isLogisticsRole, homeHrefForRole } from '@/lib/roles';

type Me = { role?: string | null };

export default function LogisticsTabLayout() {
  const router = useRouter();
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
      if (!isLogisticsRole(me.role)) {
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
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
          tabBarIcon: ({ color, size }) => <AlertTriangle size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertes',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="couriers"
        options={{
          title: 'Livreurs',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} strokeWidth={LUCIDE_STROKE} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
});
