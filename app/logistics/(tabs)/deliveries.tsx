import { useFocusEffect } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MapPin, ChevronRight, Truck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import {
  fetchActiveDeliveries,
  riskLevelColor,
  type IncidentDelivery,
} from '@/lib/logistics-api';

export default function LogisticsDeliveriesScreen() {
  const insets = useSafeAreaInsets();
  const [deliveries, setDeliveries] = useState<IncidentDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const t = await getSessionToken();
    if (!t) return;
    try {
      const data = await fetchActiveDeliveries(t);
      setDeliveries(data);
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
        <ThemedText style={styles.title}>Courses actives</ThemedText>
        <ThemedText style={styles.sub}>{deliveries.length} livraison(s) en cours</ThemedText>
        {loading ? <ActivityIndicator color="#2563EB" style={{ marginTop: 20 }} /> : null}
        {deliveries.map((d) => (
          <View key={d.id} style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <View style={[styles.accent, { backgroundColor: riskLevelColor(d.risk_level) }]} />
            <View style={styles.cardBody}>
              <ThemedText style={styles.cardRef}>#{d.id.slice(0, 8)}</ThemedText>
              <ThemedText style={styles.cardInfo}>{d.livreur?.nom || '—'} · {d.delay_label ? `+${d.delay_label}` : '—'}</ThemedText>
              <ThemedText style={styles.cardAddr} numberOfLines={1}>📍 {d.adresse_livraison || '—'}</ThemedText>
            </View>
          </View>
        ))}
        {!loading && deliveries.length === 0 ? (
          <ThemedText style={styles.empty}>Aucune livraison active.</ThemedText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  card: { borderRadius: 16, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  accent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 4 },
  cardRef: { fontWeight: '800', fontSize: 14, color: '#111827' },
  cardInfo: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cardAddr: { fontSize: 12, color: '#6B7280' },
  empty: { textAlign: 'center', marginTop: 40, color: '#6B7280', fontSize: 13 },
});
