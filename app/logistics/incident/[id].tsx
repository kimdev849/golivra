import { useLocalSearchParams } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  Truck,
  Package,
  User,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  XCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import {
  fetchIncidentDetail,
  resolveIncident,
  cancelDelivery,
  addIncidentNote,
  escalateIncident,
  riskLevelColor,
  incidentLevelLabel,
  incidentLevelColor,
  type IncidentDelivery,
} from '@/lib/logistics-api';

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const guarded = useGuardedCallback();
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const t = token || await getSessionToken();
      if (!t) { setError('Connexion requise'); setLoading(false); return; }
      if (!token) setToken(t);
      try {
        const data = await fetchIncidentDetail(t, id);
        setIncident(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id, token]);

  const handleResolve = useCallback(() => {
    if (!token || !id) return;
    Alert.prompt('Résolution', 'Raison de la résolution ?', async (raison) => {
      if (!raison) return;
      setActing('resolve');
      try {
        await resolveIncident(token, id, raison);
        Alert.alert('✅', 'Incident résolu');
        router.back();
      } catch { Alert.alert('Erreur', 'Impossible de résoudre'); }
      finally { setActing(null); }
    });
  }, [token, id, router]);

  const handleCancel = useCallback(() => {
    if (!token || !id) return;
    Alert.alert('Annuler la livraison', 'Êtes-vous sûr ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: 'destructive',
        onPress: () => {
          Alert.prompt('Raison', 'Raison de l\'annulation ?', async (raison) => {
            if (!raison) return;
            setActing('cancel');
            try {
              await cancelDelivery(token, id, raison);
              Alert.alert('✅', 'Livraison annulée');
              router.back();
            } catch { Alert.alert('Erreur', 'Impossible d\'annuler'); }
            finally { setActing(null); }
          });
        },
      },
    ]);
  }, [token, id, router]);

  const handleEscalate = useCallback(async () => {
    if (!token || !id) return;
    setActing('escalate');
    try {
      await escalateIncident(token, id);
      Alert.alert('✅', 'Incident escaladé');
      // Refresh
      const updated = await fetchIncidentDetail(token, id);
      setIncident(updated);
    } catch { Alert.alert('Erreur', 'Impossible d\'escalader'); }
    finally { setActing(null); }
  }, [token, id]);

  const handleAddNote = useCallback(() => {
    if (!token || !id) return;
    Alert.prompt('Note', 'Note à ajouter ?', async (note) => {
      if (!note) return;
      setActing('note');
      try {
        await addIncidentNote(token, id, note);
        Alert.alert('✅', 'Note ajoutée');
        const updated = await fetchIncidentDetail(token, id);
        setIncident(updated);
      } catch { Alert.alert('Erreur'); }
      finally { setActing(null); }
    });
  }, [token, id]);

  if (!token) {
    return (
      <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
        <ThemedText style={styles.err}>Connexion requise</ThemedText>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <ThemedText style={[styles.hint, { marginTop: 12 }]}>Chargement de l'incident…</ThemedText>
      </View>
    );
  }

  if (error || !incident) {
    return (
      <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
        <ThemedText style={styles.err}>{error || 'Incident introuvable'}</ThemedText>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <ThemedText style={styles.link}>← Retour</ThemedText>
        </Pressable>
      </View>
    );
  }

  const riskColor = riskLevelColor(incident.risk_level);
  const levelColor = incidentLevelColor(incident.incident_level);

  return (
    <View style={[styles.screen, { backgroundColor: '#F8FAFC' }]}>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8), backgroundColor: '#FFFFFF', borderBottomColor: '#E5E7EB' }]}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
          <ArrowLeft size={20} color="#111827" strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={styles.topTitle}>Détail incident</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* ── Header hero ── */}
        <LinearGradient
          colors={[riskColor, riskColor + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <ThemedText style={styles.heroRef}>
            🚨 #{incident.id.slice(0, 8)}
          </ThemedText>
          {incident.incident_level && (
            <View style={styles.heroPill}>
              <ThemedText style={styles.heroPillText}>
                {incidentLevelLabel(incident.incident_level)}
              </ThemedText>
            </View>
          )}
        </LinearGradient>

        {/* ── Key metrics ── */}
        <View style={[styles.metricsRow, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>Retard</ThemedText>
            <ThemedText style={[styles.metricValue, { color: '#DC2626' }]}>+{incident.delay_label}</ThemedText>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: '#E5E7EB' }]} />
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>Statut</ThemedText>
            <ThemedText style={styles.metricValue}>{incident.statut}</ThemedText>
          </View>
          <View style={[styles.metricDivider, { backgroundColor: '#E5E7EB' }]} />
          <View style={styles.metricItem}>
            <ThemedText style={styles.metricLabel}>Risque</ThemedText>
            <ThemedText style={[styles.metricValue, { color: riskColor, fontSize: 13 }]}>
              {incident.risk_info.emoji} {incident.risk_info.label}
            </ThemedText>
          </View>
        </View>

        {/* ── Livreur ── */}
        {incident.livreur && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#DBEAFE' }]}>
                <Truck size={16} color="#2563EB" strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={styles.cardTitle}>LIVREUR</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>{incident.livreur.nom}</ThemedText>
            {incident.livreur.type_vehicule && (
              <ThemedText style={styles.cardHint}>Véhicule : {incident.livreur.type_vehicule}</ThemedText>
            )}
            {incident.last_activity_ago != null && (
              <ThemedText style={styles.cardHint}>
                Dernière activité : il y a {incident.last_activity_ago} min
              </ThemedText>
            )}
            {incident.livreur.telephone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${incident.livreur!.telephone}`)}
                style={[styles.phoneBtn, { backgroundColor: '#DBEAFE', borderColor: '#2563EB' }]}
                hitSlop={8}>
                <Phone size={14} color="#2563EB" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.phoneBtnText, { color: '#2563EB' }]}>
                  {incident.livreur.telephone}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Client ── */}
        {incident.client?.nom && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#E9D5FF' }]}>
                <User size={16} color="#7C3AED" strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={styles.cardTitle}>CLIENT</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>{incident.client.nom}</ThemedText>
            {incident.client.telephone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${incident.client!.telephone}`)}
                style={[styles.phoneBtn, { backgroundColor: '#E9D5FF', borderColor: '#7C3AED' }]}
                hitSlop={8}>
                <Phone size={14} color="#7C3AED" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.phoneBtnText, { color: '#7C3AED' }]}>
                  {incident.client.telephone}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Commerce ── */}
        {incident.commerce?.nom && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#FED7AA' }]}>
                <Package size={16} color="#EA580C" strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={styles.cardTitle}>COMMERCE</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>{incident.commerce.nom}</ThemedText>
            {incident.commerce.telephone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${incident.commerce!.telephone}`)}
                style={[styles.phoneBtn, { backgroundColor: '#FED7AA', borderColor: '#EA580C' }]}
                hitSlop={8}>
                <Phone size={14} color="#EA580C" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.phoneBtnText, { color: '#EA580C' }]}>
                  {incident.commerce.telephone}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Adresses ── */}
        <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
          {incident.adresse_retrait ? (
            <View style={{ marginBottom: 8 }}>
              <ThemedText style={styles.cardHint}>📍 Adresse de retrait</ThemedText>
              <ThemedText style={styles.cardText}>{incident.adresse_retrait}</ThemedText>
            </View>
          ) : null}
          {incident.adresse_livraison ? (
            <View>
              <ThemedText style={styles.cardHint}>📍 Adresse de livraison</ThemedText>
              <ThemedText style={styles.cardText}>{incident.adresse_livraison}</ThemedText>
            </View>
          ) : null}
        </View>

        {/* ── Motif ── */}
        {incident.delay_reason && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <ThemedText style={styles.cardTitle}>📋 Motif signalé</ThemedText>
            <ThemedText style={styles.cardText}>{incident.delay_reason}</ThemedText>
          </View>
        )}

        {/* ── Timeline ── */}
        {incident.timeline.length > 0 && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <ThemedText style={[styles.cardTitle, { marginBottom: 8 }]}>📅 Timeline</ThemedText>
            {incident.timeline.map((event, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor:
                          event.type === 'alerte'
                            ? '#EF4444'
                            : event.type === 'fait'
                              ? '#22C55E'
                              : '#3B82F6',
                      },
                    ]}
                  />
                  {idx < incident.timeline.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <ThemedText style={styles.timelineTitle}>{event.titre}</ThemedText>
                  <ThemedText style={styles.timelineDate}>{event.date_label}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Operator actions ── */}
        {incident.operator_actions.length > 0 && (
          <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            <ThemedText style={[styles.cardTitle, { marginBottom: 8 }]}>📝 Actions opérateur</ThemedText>
            {incident.operator_actions.map((action) => (
              <View key={action.id} style={styles.actionRow}>
                <ThemedText style={styles.actionDate}>{action.created_at_label}</ThemedText>
                <ThemedText style={styles.actionLabel}>{action.action_label}</ThemedText>
                {action.details && <ThemedText style={styles.actionDetails}>— {action.details}</ThemedText>}
              </View>
            ))}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actionsContainer}>
          {incident.livreur?.telephone && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => Linking.openURL(`tel:${incident.livreur!.telephone}`)}>
              <Phone size={18} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.actionBtnText}>Contacter livreur</ThemedText>
            </Pressable>
          )}
          {incident.client?.telephone && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => Linking.openURL(`tel:${incident.client!.telephone}`)}>
              <Phone size={18} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.actionBtnText}>Contacter client</ThemedText>
            </Pressable>
          )}
          {incident.commerce?.telephone && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#EA580C' }]}
              onPress={() => Linking.openURL(`tel:${incident.commerce!.telephone}`)}>
              <Phone size={18} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.actionBtnText}>Contacter commerce</ThemedText>
            </Pressable>
          )}
          <Pressable
            style={[styles.actionBtnOutline, { borderColor: '#F59E0B' }]}
            onPress={() => guarded(() => void handleEscalate())}
            disabled={acting !== null}>
            <TrendingUp size={18} color="#F59E0B" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.actionBtnOutlineText, { color: '#F59E0B' }]}>Escalader</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionBtnOutline, { borderColor: '#6B7280' }]}
            onPress={() => guarded(() => void handleAddNote())}
            disabled={acting !== null}>
            <MessageSquare size={18} color="#6B7280" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.actionBtnOutlineText, { color: '#6B7280' }]}>Ajouter note</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionBtnDanger, { borderColor: '#EF4444' }]}
            onPress={() => guarded(() => void handleCancel())}
            disabled={acting !== null}>
            <XCircle size={18} color="#EF4444" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.actionBtnDangerText, { color: '#EF4444' }]}>Annuler la livraison</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontWeight: '800', fontSize: 17, color: '#111827' },
  scroll: { padding: 16, gap: 14 },

  hero: { borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroRef: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', flex: 1, marginRight: 12 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  heroPillText: { fontWeight: '800', fontSize: 11, color: '#FFFFFF', textTransform: 'uppercase' },

  // ── Metrics ──
  metricsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricItem: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: 1, height: 32 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  metricValue: { fontSize: 16, fontWeight: '900', color: '#111827' },

  // ── Cards ──
  card: { borderRadius: 16, padding: 16, gap: 8, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '800', fontSize: 13, color: '#111827' },
  cardText: { fontSize: 14, lineHeight: 20, color: '#374151' },
  cardHint: { fontSize: 12, fontWeight: '500', color: '#6B7280' },

  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  phoneBtnText: { fontSize: 14, fontWeight: '800' },

  // ── Timeline ──
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: '#E5E7EB', marginTop: 4, marginBottom: 4 },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  timelineDate: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 2 },

  // ── Operator actions ──
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  actionDate: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },
  actionDetails: { fontSize: 11, color: '#6B7280' },

  // ── Actions ──
  actionsContainer: { gap: 10, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 2,
  },
  actionBtnOutlineText: { fontWeight: '800', fontSize: 15 },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 2,
    marginTop: 8,
  },
  actionBtnDangerText: { fontWeight: '800', fontSize: 15 },

  err: { fontWeight: '600', fontSize: 13, color: '#EF4444' },
  hint: { textAlign: 'center', fontSize: 13, color: '#6B7280' },
  link: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
});
