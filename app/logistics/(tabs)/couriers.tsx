import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getSessionToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

export default function LogisticsCouriersScreen() {
  const insets = useSafeAreaInsets();
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const t = await getSessionToken();
    if (!t) return;
    try {
      const data = await apiFetch<any[]>('/api/logistics/livreurs', { token: t });
      setCouriers(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void fetchData(); }, [fetchData]));

  const bottom = Math.max(insets.bottom, 12) + 60;

  return (
    <View style={[styles.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} tintColor="#2563EB" />}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>
        <ThemedText style={styles.title}>Mes livreurs</ThemedText>
        <ThemedText style={styles.sub}>{couriers.length} livreur(s)</ThemedText>
        {loading ? <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} /> : null}
        {couriers.map((c: any) => (
          <View key={c.id} style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <View style={[styles.dot, { backgroundColor: c.est_disponible ? '#22C55E' : '#9CA3AF' }]} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.name}>{c.utilisateur?.nom || '—'}</ThemedText>
              <ThemedText style={styles.info}>{c.type_vehicule || '—'} · {c.nb_livraisons_total || 0} courses</ThemedText>
            </View>
            <ThemedText style={[styles.status, { color: c.est_disponible ? '#22C55E' : '#9CA3AF' }]}>
              {c.est_disponible ? 'En ligne' : 'Hors ligne'}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 14, fontWeight: '800', color: '#111827' },
  info: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  status: { fontSize: 11, fontWeight: '800' },
});
