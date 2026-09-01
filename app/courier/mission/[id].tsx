import { useLocalSearchParams } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Phone,
  Store,
  User,
  Navigation,
  Package,
  Route,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppContentWidth } from '@/components/app-content-width';
import { DeliveryProofModal } from '@/components/courier/delivery-proof-modal';
import { ReportProblemModal } from '@/components/courier/report-problem-modal';
import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import {
  acceptCourierMission,
  advanceCourierMission,
  reportCourierProblem,
  missionStatutLabel,
  type CourierMission,
} from '@/lib/courier-api';
import { getSessionToken } from '@/lib/auth';
import { AlertTriangle } from 'lucide-react-native';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { useCourierPalette } from '@/lib/courier-theme';

type StepKey = 'assigned' | 'pickup' | 'picked_up' | 'delivering' | 'done';

const STEP_META: Record<StepKey, { label: string; icon: typeof Store }> = {
  assigned: { label: 'Assignee', icon: Package },
  pickup: { label: 'En route vers le commerce', icon: Store },
  picked_up: { label: 'Commande recuperee', icon: CheckCircle2 },
  delivering: { label: 'En route vers le client', icon: Navigation },
  done: { label: 'Livree', icon: CheckCircle2 },
};

function missionToStep(statut: string): StepKey {
  switch (statut) {
    case 'attribuee':
      return 'assigned';
    case 'en_collecte':
      return 'pickup';
    case 'collectee':
      return 'picked_up';
    case 'en_route':
      return 'delivering';
    case 'livree':
      return 'done';
    default:
      return 'assigned';
  }
}

function StepProgress({ currentStep }: { currentStep: StepKey }) {
  const palette = useCourierPalette();
  const steps: StepKey[] = ['assigned', 'pickup', 'picked_up', 'delivering', 'done'];
  const currentIdx = steps.indexOf(currentStep);

  return (
    <View style={stepStyles.container}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isLast = idx === steps.length - 1;
        const meta = STEP_META[step];
        const Icon = meta.icon;

        return (
          <View key={step} style={stepStyles.stepWrap}>
            <View style={stepStyles.stepRow}>
              <View
                style={[
                  stepStyles.dot,
                  {
                    backgroundColor: isCompleted || isCurrent ? palette.primary : 'transparent',
                    borderColor: isCompleted || isCurrent ? palette.primary : palette.muted,
                  },
                ]}>
                {isCompleted ? (
                  <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Icon
                    size={12}
                    color={isCurrent ? '#FFFFFF' : palette.muted}
                    strokeWidth={2.4}
                  />
                )}
              </View>
              {!isLast ? (
                <View
                  style={[
                    stepStyles.line,
                    { backgroundColor: idx < currentIdx ? palette.primary : palette.border },
                  ]}
                />
              ) : null}
            </View>
            <ThemedText
              style={[
                stepStyles.label,
                {
                  color: isCompleted || isCurrent ? palette.primaryDeep : palette.muted,
                  fontWeight: isCurrent ? '800' : '500',
                },
              ]}>
              {meta.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

export default function CourierMissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const guarded = useGuardedCallback();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { missions, refreshMissions } = useCourier();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const [mission, setMission] = useState<CourierMission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const found = missions.find((m) => m.id === id) ?? null;
    setMission(found);
    if (!found) setError('Course introuvable.');
  }, [id, missions]);

  const isDone = mission?.statut === 'livree' || mission?.statut === 'annulee';
  const canAccept = mission?.ouverte === true && mission.statut === 'en_attente';
  const canAdvance =
    mission && !isDone && !canAccept && (mission.statut === 'attribuee' || mission.statut === 'en_collecte');
  const advanceLabel =
    mission?.statut === 'attribuee' ? 'Recuperer la commande' : 'En route vers le client';
  const canComplete =
    mission && !isDone && !canAccept && (mission.statut === 'en_route' || mission.statut === 'collectee');
  const canReportProblem =
    mission && !isDone && !canAccept && (mission.statut === 'en_collecte' || mission.statut === 'collectee' || mission.statut === 'en_route');

  const accept = async () => {
    if (!id) return;
    const previous = mission;
    setMission((m) => (m ? { ...m, ouverte: false, statut: 'attribuee' as const } : m));
    showSuccess('Course acceptee', 'Récupérez la commande chez le commerce.');
    setActing('accept');
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expiree');
      const updated = await acceptCourierMission(token, id);
      setMission({ ...updated, ouverte: false });
      void refreshMissions();
    } catch (e) {
      if (previous) setMission(previous);
      const msg = e instanceof Error ? e.message : "Impossible d'accepter la course.";
      setError(msg);
      showError('Acceptation impossible', msg);
    } finally {
      setActing(null);
    }
  };

  const advance = async () => {
    if (!id) return;
    const previous = mission;
    setMission((m) => (m ? { ...m, statut: 'en_collecte' as const } : m));
    showSuccess('Collecte enregistree', 'Recuperation confirmee chez le commerce.');
    setActing('advance');
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expiree');
      const updated = await advanceCourierMission(token, id);
      setMission(updated);
      void refreshMissions();
    } catch (e) {
      if (previous) setMission(previous);
      const msg = e instanceof Error ? e.message : 'Impossible de mettre a jour la course.';
      setError(msg);
      showError('Mise a jour impossible', msg);
    } finally {
      setActing(null);
    }
  };

  const handleReportProblem = async (reason: string, detail: string) => {
    if (!id) return;
    const token = await getSessionToken();
    if (!token) throw new Error('Session expiree');
    await reportCourierProblem(token, id, reason, detail);
    void refreshMissions();
    showSuccess('Problème signalé', 'Votre entreprise a été notifiée et prend en charge la situation.');
  };

  const handleProofDone = (updated: CourierMission) => {
    setProofOpen(false);
    setMission(updated);
    void refreshMissions();
    showSuccess('Livraison reussie', 'Merci pour votre travail ! Le colis est bien arrive chez le client.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <FeedbackOverlay />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8), backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: palette.primarySoft }]} hitSlop={12}>
          <ArrowLeft size={20} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.topTitle, { color: palette.primaryDeep }]}>Course</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {!mission ? (
        <View style={styles.center}>
          {error ? (
            <ThemedText style={[styles.err, { color: palette.danger }]}>{error}</ThemedText>
          ) : (
            <ActivityIndicator color={palette.primary} size="large" />
          )}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          <AppContentWidth phonePadding={0}>

            {/* ── Header hero ── */}
            <LinearGradient
              colors={[palette.primary, palette.primaryDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}>
              <ThemedText style={styles.heroRef}>
                {mission.type_livraison === 'externe'
                  ? 'Livraison externe'
                  : mission.commande?.numero || mission.id.slice(0, 8).toUpperCase()}
              </ThemedText>
              <View style={styles.heroPill}>
                <ThemedText style={styles.heroPillText}>{missionStatutLabel(mission.statut)}</ThemedText>
              </View>
            </LinearGradient>

            {/* ── Progression visuelle ── */}
            {!isDone && mission.statut !== 'en_attente' ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Progression</ThemedText>
                <StepProgress currentStep={missionToStep(mission.statut)} />
              </View>
            ) : null}

            {/* ── Point de retrait ── */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.cardHead}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#F59E0B20' }]}>
                  <Store size={16} color="#F59E0B" strokeWidth={LUCIDE_STROKE} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Point de retrait</ThemedText>
              </View>
              <ThemedText style={[styles.cardText, { color: palette.textSecondary }]}>
                {mission.adresse_retrait || '—'}
              </ThemedText>
            </View>

            {/* ── Client ── */}
            {mission.client_nom || mission.client_telephone ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.cardHead}>
                  <View style={[styles.cardIconWrap, { backgroundColor: palette.primarySoft }]}>
                    <User size={16} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Client</ThemedText>
                </View>
                {mission.client_nom ? (
                  <ThemedText style={[styles.cardText, { color: palette.text }]}>{mission.client_nom}</ThemedText>
                ) : null}
                {mission.client_telephone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${mission.client_telephone}`)}
                    style={[styles.phoneBtn, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}
                    hitSlop={8}>
                    <Phone size={14} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.phoneBtnText, { color: palette.primary }]}>
                      {mission.client_telephone}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* ── Adresse de livraison ── */}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.cardHead}>
                <View style={[styles.cardIconWrap, { backgroundColor: '#3B82F620' }]}>
                  <MapPin size={16} color="#3B82F6" strokeWidth={LUCIDE_STROKE} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Adresse de livraison</ThemedText>
              </View>
              <ThemedText style={[styles.cardText, { color: palette.textSecondary }]}>
                {mission.adresse_livraison || '—'}
              </ThemedText>
              {mission.note ? (
                <View style={[styles.noteBox, { backgroundColor: palette.pillOff }]}>
                  <ThemedText style={[styles.noteText, { color: palette.textSecondary }]}>
                    {mission.note}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {error ? (
              <View style={[styles.errBox, { borderColor: palette.danger }]}>
                <ThemedText style={[styles.err, { color: palette.danger }]}>{error}</ThemedText>
              </View>
            ) : null}

            {/* ── Actions ── */}
            {canAccept ? (
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: palette.primary }, acting !== null && styles.disabled]}
                disabled={acting !== null}
                onPress={() => guarded(() => void accept())}>
                {acting === 'accept' ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Package size={18} color="#FFF" strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={styles.btnPrimaryText}>Accepter cette course</ThemedText>
                  </>
                )}
              </Pressable>
            ) : null}

            {canAdvance ? (
              <Pressable
                style={[styles.btnSecondary, { borderColor: palette.primary }, acting !== null && styles.disabled]}
                disabled={acting !== null}
                onPress={() => guarded(() => void advance())}>
                {acting === 'advance' ? (
                  <ActivityIndicator color={palette.primary} size="small" />
                ) : (
                  <>
                    <Route size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.btnSecondaryText, { color: palette.primary }]}>{advanceLabel}</ThemedText>
                  </>
                )}
              </Pressable>
            ) : null}

            {canComplete ? (
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: palette.primary }]}
                onPress={() => setProofOpen(true)}>
                <CheckCircle2 size={18} color="#FFF" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={styles.btnPrimaryText}>Confirmer la livraison</ThemedText>
              </Pressable>
            ) : null}

            {canReportProblem ? (
              <Pressable
                style={[styles.btnDanger, { borderColor: '#F59E0B', backgroundColor: '#F59E0B10' }]}
                onPress={() => setProblemOpen(true)}>
                <AlertTriangle size={18} color="#F59E0B" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.btnDangerText, { color: '#F59E0B' }]}>Signaler un problème</ThemedText>
              </Pressable>
            ) : null}

            {isDone ? (
              <View style={[styles.doneBox, { backgroundColor: '#22C55E15', borderColor: '#22C55E30' }]}>
                <CheckCircle2 size={18} color="#22C55E" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.doneText, { color: '#22C55E' }]}>Course terminee</ThemedText>
              </View>
            ) : !canAccept ? (
              <ThemedText style={[styles.hint, { color: palette.muted }]}>
                Recuperez la commande puis confirmez la livraison.
              </ThemedText>
            ) : null}

          </AppContentWidth>
        </ScrollView>
      )}

      {proofOpen && mission ? (
        <DeliveryProofModal
          deliveryId={mission.id}
          reference={mission.commande?.numero || mission.id.slice(0, 8).toUpperCase()}
          onDone={handleProofDone}
          onClose={() => setProofOpen(false)}
        />
      ) : null}

      {problemOpen ? (
        <ReportProblemModal
          visible={problemOpen}
          onClose={() => setProblemOpen(false)}
          onSubmit={handleReportProblem}
        />
      ) : null}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: { gap: 0, paddingTop: 4, paddingBottom: 4 },
  stepWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepRow: { alignItems: 'center', width: 28 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, height: 20, marginLeft: 13, marginTop: 2, marginBottom: 2, borderRadius: 1 },
  label: { fontSize: 13, lineHeight: 28, flex: 1 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontWeight: '800', fontSize: 17 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, gap: 14 },

  // ── Hero ──
  hero: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroRef: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', flex: 1, marginRight: 12 },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroPillText: { fontWeight: '800', fontSize: 11, color: '#FFFFFF', textTransform: 'uppercase' },

  // ── Cards ──
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontWeight: '800', fontSize: 14 },
  cardText: { fontSize: 14, lineHeight: 20 },

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

  noteBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  noteText: { fontSize: 13, lineHeight: 18 },

  errBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  err: { fontWeight: '600', fontSize: 13 },

  // ── Buttons ──
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  btnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 2,
  },
  btnSecondaryText: { fontWeight: '800', fontSize: 15 },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
    borderWidth: 1.5,
  },
  btnDangerText: { fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },

  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
  },
  doneText: { fontWeight: '800', fontSize: 14 },

  hint: { textAlign: 'center', fontSize: 13, marginTop: 8, fontWeight: '500' },
});
