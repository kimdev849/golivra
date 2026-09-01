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
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  Clock,
  Truck,
  Users,
  Package,
  ChevronRight,
  BarChart3,
  Bell,
  Shield,
  TrendingUp,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import {
  fetchIncidents,
  fetchIncidentStats,
  riskLevelColor,
  type IncidentDelivery,
  type IncidentStats,
} from '@/lib/logistics-api';

export default function LogisticsHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentDelivery[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const t = token || await getSessionToken();
    if (!t) return;
    if (!token) setToken(t);
    try {
      const [inc, st] = await Promise.all([
        fetchIncidents(t),
        fetchIncidentStats(t),
      ]);
      setIncidents(inc);
      setStats(st);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
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
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !stats) {
    return (
      <View style={[styles.loader, { backgroundColor: '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const bottom = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#2563EB" />
        }
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom + 80 }]}>

        {/* ── Hero section ── */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.heroGreeting}>Centre Opérationnel</ThemedText>
              <ThemedText style={styles.heroName}>GoLivra</ThemedText>
              <ThemedText style={styles.heroSub}>
                {incidents.length > 0
                  ? `${incidents.length} incident${incidents.length > 1 ? 's' : ''} actif${incidents.length > 1 ? 's' : ''}`
                  : 'Tout est sous contrôle'}
              </ThemedText>
            </View>
          </View>
        </LinearGradient>

        {error ? (
          <View style={[styles.bannerErr, { borderColor: '#EF4444' }]}>
            <ThemedText style={[styles.bannerErrText, { color: '#EF4444' }]}>{error}</ThemedText>
          </View>
        ) : null}

        {/* ── Alert banner ── */}
        {incidents.length > 0 && (
          <Pressable
            style={styles.alertBanner}
            onPress={() => router.push('/logistics/incidents')}>
            <View style={styles.alertIconWrap}>
              <AlertTriangle size={20} color="#DC2626" strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.alertTitle}>
                🚨 {incidents.length} incident{incidents.length > 1 ? 's' : ''} nécessitant intervention
              </ThemedText>
              <ThemedText style={styles.alertSub}>Appuyez pour ouvrir le centre d'incidents</ThemedText>
            </View>
            <ChevronRight size={16} color="#DC2626" strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        )}

        {/* ── Stats cards ── */}
        {stats && (
          <View style={styles.statsCard}>
            <Kpi
              label="En cours"
              value={stats.total_active}
              icon={<Truck size={16} color="#FFFFFF" strokeWidth={2.4} />}
              color="#3B82F6"
            />
            <View style={styles.statDivider} />
            <Kpi
              label="Incidents"
              value={stats.total_incidents}
              icon={<AlertTriangle size={16} color="#FFFFFF" strokeWidth={2.4} />}
              color="#EF4444"
            />
            <View style={styles.statDivider} />
            <Kpi
              label="Critiques"
              value={stats.niveau_3}
              icon={<Shield size={16} color="#FFFFFF" strokeWidth={2.4} />}
              color="#DC2626"
            />
          </View>
        )}

        {/* ── Risk breakdown ── */}
        {stats && stats.total_active > 0 && (
          <View style={[styles.riskBar, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <ThemedText style={styles.riskBarTitle}>RÉPARTITION DES RISQUES</ThemedText>
            <View style={styles.riskBarRow}>
              {(['NORMAL', 'A_SURVEILLER', 'RETARD', 'INCIDENT', 'CRITIQUE'] as const).map((level) => {
                const count = stats.risk_breakdown[level] || 0;
                if (count === 0) return null;
                return (
                  <View key={level} style={[styles.riskPill, { backgroundColor: riskLevelColor(level) + '20' }]}>
                    <View style={[styles.riskDot, { backgroundColor: riskLevelColor(level) }]} />
                    <ThemedText style={[styles.riskPillText, { color: riskLevelColor(level) }]}>
                      {count}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.actionsGrid}>
          <Pressable
            style={[styles.actionCard, { borderColor: '#FEE2E2' }]}
            onPress={() => router.push('/logistics/incidents')}>
            <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
              <AlertTriangle size={20} color="#DC2626" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.actionTitle}>Incidents</ThemedText>
            <ThemedText style={styles.actionSub}>Détection → Intervention</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { borderColor: '#DBEAFE' }]}
            onPress={() => router.push('/logistics/deliveries')}>
            <View style={[styles.actionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Truck size={20} color="#2563EB" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.actionTitle}>Courses</ThemedText>
            <ThemedText style={styles.actionSub}>{stats?.total_active || 0} actives</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { borderColor: '#D1FAE5' }]}
            onPress={() => router.push('/logistics/couriers')}>
            <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Users size={20} color="#059669" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.actionTitle}>Livreurs</ThemedText>
            <ThemedText style={styles.actionSub}>Gestion équipe</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { borderColor: '#E9D5FF' }]}
            onPress={() => router.push('/logistics/stats')}>
            <View style={[styles.actionIcon, { backgroundColor: '#E9D5FF' }]}>
              <BarChart3 size={20} color="#7C3AED" strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={styles.actionTitle}>Stats</ThemedText>
            <ThemedText style={styles.actionSub}>Performance</ThemedText>
          </Pressable>
        </View>

        {/* ── Recent incidents ── */}
        {incidents.length > 0 && (
          <View>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadLeft}>
                <View style={[styles.sectionDot, { backgroundColor: '#EF4444' }]} />
                <ThemedText style={styles.sectionTitle}>Incidents récents</ThemedText>
              </View>
              <Pressable onPress={() => router.push('/logistics/incidents')} hitSlop={8}>
                <ThemedText style={styles.sectionLink}>Tout voir →</ThemedText>
              </Pressable>
            </View>
            <View style={styles.incidentList}>
              {incidents.slice(0, 5).map((inc) => (
                <IncidentCard key={inc.id} incident={inc} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: color }]}>{icon}</View>
      <ThemedText style={styles.kpiVal}>{value}</ThemedText>
      <ThemedText style={styles.kpiLbl}>{label}</ThemedText>
    </View>
  );
}

function IncidentCard({ incident }: { incident: IncidentDelivery }) {
  const router = useRouter();
  const riskColor = riskLevelColor(incident.risk_level);

  return (
    <Pressable
      style={[styles.incidentCard, { borderColor: riskColor + '30', backgroundColor: '#FFFFFF' }]}
      onPress={() => router.push({ pathname: '/logistics/incident/[id]', params: { id: incident.id } })}>
      <View style={[styles.incidentAccent, { backgroundColor: riskColor }]} />
      <View style={styles.incidentCardContent}>
        <View style={styles.incidentTop}>
          <ThemedText style={styles.incidentRef} numberOfLines={1}>
            #{incident.id.slice(0, 8)}
          </ThemedText>
          <View style={[styles.incidentPill, { backgroundColor: riskColor + '18' }]}>
            <ThemedText style={[styles.incidentPillText, { color: riskColor }]}>
              +{incident.delay_label}
            </ThemedText>
          </View>
        </View>
        {incident.livreur && (
          <ThemedText style={styles.incidentInfo} numberOfLines={1}>
            🚚 {incident.livreur.nom}
          </ThemedText>
        )}
        {incident.adresse_livraison ? (
          <ThemedText style={styles.incidentAddr} numberOfLines={1}>
            📍 {incident.adresse_livraison}
          </ThemedText>
        ) : null}
      </View>
      <ChevronRight size={14} color="#9CA3AF" style={{ alignSelf: 'center', marginRight: 8 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, gap: 14 },

  // ── Hero ──
  hero: { borderRadius: 20, padding: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroGreeting: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, marginTop: 2 },
  heroSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  bannerErr: { borderRadius: 14, padding: 12, borderWidth: 1 },
  bannerErrText: { fontSize: 13, fontWeight: '600' },

  // ── Alert banner ──
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  alertIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  alertSub: { fontSize: 11, fontWeight: '500', color: '#DC2626', marginTop: 2 },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 38, backgroundColor: '#E5E7EB' },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  kpiVal: { fontSize: 20, fontWeight: '900', color: '#111827' },
  kpiLbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, color: '#6B7280' },

  // ── Risk bar ──
  riskBar: { borderRadius: 16, padding: 14, borderWidth: 1 },
  riskBarTitle: { fontSize: 10, fontWeight: '800', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase' },
  riskBarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  riskPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskPillText: { fontSize: 11, fontWeight: '800' },

  // ── Actions ──
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  actionSub: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 2 },

  // ── Sections ──
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sectionLink: { fontSize: 13, fontWeight: '700', color: '#2563EB' },

  // ── Incident cards ──
  incidentList: { gap: 10 },
  incidentCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  incidentAccent: { width: 4 },
  incidentCardContent: { flex: 1, padding: 14, paddingLeft: 12, gap: 4 },
  incidentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  incidentRef: { fontSize: 14, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 },
  incidentPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  incidentPillText: { fontSize: 10, fontWeight: '800' },
  incidentInfo: { fontSize: 12, fontWeight: '600', color: '#374151' },
  incidentAddr: { fontSize: 12, fontWeight: '500', color: '#6B7280', lineHeight: 17 },
});
