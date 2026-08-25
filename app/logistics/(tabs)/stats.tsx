import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getSessionToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

export default function LogisticsStatsScreen() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const t = await getSessionToken();
    if (!t) return;
    try {
      const data = await apiFetch<any>('/api/logistics/stats', { token: t });
      setStats(data);
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
        <ThemedText style={styles.title}>Statistiques</ThemedText>
        {loading ? <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} /> : null}
        {stats ? (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <StatLine label="Livreurs total" value={String(stats.livreurs_total ?? 0)} />
            <StatLine label="Livreurs disponibles" value={String(stats.livreurs_disponibles ?? 0)} />
            <StatLine label="Livraisons aujourd'hui" value={String(stats.livraisons_aujourdhui ?? 0)} />
            <StatLine label="En cours" value={String(stats.livraisons_en_cours ?? 0)} />
            <StatLine label="En retard" value={String(stats.livraisons_en_retard ?? 0)} color="#EF4444" />
            <StatLine label="Livrées aujourd'hui" value={String(stats.livraisons_livrees_aujourdhui ?? 0)} />
            {stats.delai_moyen_minutes ? (
              <StatLine label="Délai moyen" value={`${stats.delai_moyen_minutes} min`} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={statStyles.row}>
      <ThemedText style={statStyles.label}>{label}</ThemedText>
      <ThemedText style={[statStyles.value, color ? { color } : null]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
});

const statStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '500', color: '#374151' },
  value: { fontSize: 14, fontWeight: '800', color: '#111827' },
});
