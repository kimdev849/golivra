import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import {
  fetchIncidents,
  riskLevelColor,
  incidentLevelLabel,
  incidentLevelColor,
  type IncidentDelivery,
} from '@/lib/logistics-api';

type Filter = 'all' | 'niveau_1' | 'niveau_2' | 'niveau_3';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'niveau_1', label: '🟡 Léger' },
  { key: 'niveau_2', label: '🟠 Significatif' },
  { key: 'niveau_3', label: '🔴 Incident' },
];

export default function LogisticsIncidentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchData = useCallback(async () => {
    const t = token || await getSessionToken();
    if (!t) return;
    if (!token) setToken(t);
    try {
      const data = await fetchIncidents(t);
      setIncidents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchData(); } finally { setRefreshing(false); }
  };

  const filtered = filter === 'all' ? incidents : incidents.filter((i) => i.incident_level === filter);

  const bottom = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#2563EB" />}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom + 80 }]}>

        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>🚨 Centre d'Incidents</ThemedText>
          <ThemedText style={styles.sub}>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} actif{incidents.length !== 1 ? 's' : ''}
          </ThemedText>
        </View>

        {/* Filters */}
        <View style={[styles.filterBar, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === 'all' ? incidents.length : incidents.filter((i) => i.incident_level === f.key).length;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterBtn, active && { backgroundColor: '#DC2626' }]}
                onPress={() => setFilter(f.key)}>
                <ThemedText style={[styles.filterText, { color: active ? '#FFFFFF' : '#374151' }]}>
                  {f.label}
                </ThemedText>
                {count > 0 ? (
                  <View style={[styles.filterCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#FEE2E2' }]}>
                    <ThemedText style={[styles.filterCountText, { color: active ? '#FFFFFF' : '#DC2626' }]}>
                      {count}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {loading && incidents.length === 0 ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 28 }} />
        ) : error ? (
          <View style={[styles.bannerErr, { borderColor: '#EF4444' }]}>
            <ThemedText style={[styles.bannerErrText, { color: '#EF4444' }]}>{error}</ThemedText>
          </View>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <ThemedText style={styles.empty}>Aucun incident pour ce filtre.</ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                onPress={() => router.push({ pathname: '/logistics/incident/[id]', params: { id: inc.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function IncidentCard({ incident, onPress }: { incident: IncidentDelivery; onPress: () => void }) {
  const riskColor = riskLevelColor(incident.risk_level);
  const levelColor = incident.incident_level ? incidentLevelColor(incident.incident_level) : '#6B7280';

  return (
    <Pressable
      style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: riskColor + '30' }]}
      onPress={onPress}
      android_ripple={{ color: '#FEE2E2' }}>
      <View style={[styles.cardAccent, { backgroundColor: riskColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <ThemedText style={styles.cardRef} numberOfLines={1}>
            #{incident.id.slice(0, 8)}
          </ThemedText>
          <View style={[styles.cardPill, { backgroundColor: levelColor + '18' }]}>
            <ThemedText style={[styles.cardPillText, { color: levelColor }]}>
              +{incident.delay_label}
            </ThemedText>
          </View>
        </View>

        {incident.livreur && (
          <ThemedText style={styles.cardInfo} numberOfLines={1}>
            🚚 {incident.livreur.nom}
            {incident.livreur.type_vehicule ? ` · ${incident.livreur.type_vehicule}` : ''}
          </ThemedText>
        )}
        {incident.commerce?.nom && (
          <ThemedText style={styles.cardInfo} numberOfLines={1}>
            🏪 {incident.commerce.nom}
          </ThemedText>
        )}
        {incident.adresse_livraison ? (
          <ThemedText style={styles.cardAddr} numberOfLines={1}>
            📍 {incident.adresse_livraison}
          </ThemedText>
        ) : null}

        {incident.delay_reason && (
          <ThemedText style={styles.cardReason}>
            Motif : {incident.delay_reason}
          </ThemedText>
        )}

        <View style={styles.cardFooter}>
          <ThemedText style={[styles.cardRisk, { color: riskColor }]}>
            {incident.risk_info.emoji} {incident.risk_info.label}
          </ThemedText>
          {incident.last_activity_ago != null && (
            <ThemedText style={styles.cardActivity}>
              Activité il y a {incident.last_activity_ago} min
            </ThemedText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, color: '#111827' },
  sub: { marginTop: 2, fontSize: 13, fontWeight: '500', color: '#6B7280' },

  bannerErr: { borderRadius: 14, padding: 12, borderWidth: 1 },
  bannerErrText: { fontSize: 13, fontWeight: '600' },

  // ── Filters ──
  filterBar: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  filterText: { fontSize: 11, fontWeight: '700' },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, fontWeight: '900' },

  list: { gap: 10 },
  emptyBox: { borderRadius: 16, padding: 18, borderWidth: 1, alignItems: 'center' },
  empty: { fontSize: 13, fontWeight: '500', color: '#6B7280' },

  // ── Card ──
  card: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 14, paddingLeft: 12, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRef: { fontWeight: '800', fontSize: 14, flex: 1, marginRight: 8, color: '#111827' },
  cardPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardPillText: { fontSize: 10, fontWeight: '800' },
  cardInfo: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cardAddr: { fontSize: 12, fontWeight: '500', color: '#6B7280', lineHeight: 17 },
  cardReason: { fontSize: 11, fontWeight: '600', color: '#F59E0B', marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardRisk: { fontSize: 11, fontWeight: '800' },
  cardActivity: { fontSize: 10, fontWeight: '500', color: '#9CA3AF' },
});
