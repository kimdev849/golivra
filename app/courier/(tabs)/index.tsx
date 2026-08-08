import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  MapPin,
  Package,
  Target,
  CheckCircle2,
  Navigation,
  Bike,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { missionStatutLabel } from '@/lib/courier-api';
import { useCourierPalette } from '@/lib/courier-theme';
import { hrefCourierMission } from '@/lib/courier-nav';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';

export default function CourierHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { profile, missions, loading, error, refresh, setDisponible } = useCourier();
  const { unreadCount } = useUnreadNotifications();
  const [acting, setActing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setErrorLocal] = useState<string | null>(null);

  const disponible = Boolean(profile?.livreur?.est_disponible);
  const openMissions = missions.filter((m) => m.ouverte && m.statut === 'en_attente');
  const activeMissions = missions
    .filter((m) => m.statut !== 'livree' && m.statut !== 'annulee' && !m.ouverte)
    .slice(0, 4);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleDispo = async (value: boolean) => {
    setActing(true);
    try {
      await setDisponible(value);
    } catch (e) {
      setErrorLocal(e instanceof Error ? e.message : 'Erreur disponibilité.');
    } finally {
      setActing(false);
    }
  };

  const displayError = localError || error;

  if (loading && !profile) {
    return (
      <View style={[styles.loader, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const bottom = Math.max(insets.bottom, 12) + COURIER_TAB_BAR_PADDING_BOTTOM;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── En-tête : logo + Bonjour + cloche ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoBadge, { backgroundColor: palette.primary }]}>
              <Bike size={20} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.greeting, { color: palette.muted }]}>Bonjour,</ThemedText>
              <ThemedText style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                {profile?.utilisateur?.nom || 'Livreur'}
              </ThemedText>
            </View>
          </View>
          <Pressable
            style={[styles.notifBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/courier/notifications')}
            hitSlop={10}>
            <Bell size={22} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
            {unreadCount > 0 ? (
              <View style={[styles.notifBadge, { backgroundColor: palette.danger }]}>
                <ThemedText style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {displayError ? (
          <View style={[styles.bannerErr, { borderColor: palette.border }]}>
            <ThemedText style={[styles.bannerErrText, { color: palette.danger }]}>{displayError}</ThemedText>
          </View>
        ) : null}

        {/* ── Disponibilité ── */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.dispoRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Recevoir des courses</ThemedText>
              <ThemedText style={[styles.cardHint, { color: palette.muted }]}>
                {disponible
                  ? 'GoLivra peut vous attribuer des livraisons.'
                  : 'Activez pour signaler que vous êtes prêt.'}
              </ThemedText>
            </View>
            <Switch
              value={disponible}
              disabled={acting}
              onValueChange={(v) => void toggleDispo(v)}
              trackColor={{ false: palette.trackStroke, true: palette.primary }}
              thumbColor={disponible ? palette.primary : '#F9FAFB'}
            />
          </View>
        </View>

        {/* ── Statistiques (3 colonnes, comme le client) ── */}
        <View style={[styles.statsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Kpi
            label="En cours"
            value={profile?.resume?.missions_actives ?? 0}
            palette={palette}
            icon={<Navigation size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <Kpi
            label="Aujourd'hui"
            value={profile?.resume?.missions_aujourdhui ?? 0}
            palette={palette}
            icon={<Target size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <Kpi
            label="Réussies"
            value={profile?.resume?.reussies_historique ?? 0}
            palette={palette}
            icon={<CheckCircle2 size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
          />
        </View>

        {disponible && openMissions.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Courses disponibles</ThemedText>
              <ThemedText style={[styles.sectionLink, { color: palette.primary }]}>{openMissions.length} à accepter</ThemedText>
            </View>
            <View style={styles.missionList}>
              {openMissions.slice(0, 3).map((m) => (
                <Pressable
                  key={m.id}
                  style={[styles.missionCard, { borderColor: palette.warning, backgroundColor: palette.warningSoft }]}
                  onPress={() => router.push(hrefCourierMission(m.id))}>
                  <View style={styles.missionTop}>
                    <ThemedText style={[styles.missionRef, { color: palette.text }]}>
                      {m.commerce_nom || m.commande?.numero || m.id.slice(0, 8).toUpperCase()}
                    </ThemedText>
                    <View style={[styles.statutPill, { backgroundColor: '#FEF3C7' }]}>
                      <ThemedText style={[styles.statutText, { color: '#92400E' }]}>Nouvelle</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.missionAddr, { color: palette.textSecondary }]} numberOfLines={2}>
                    {m.adresse_retrait || 'Retrait'} → {m.adresse_livraison || 'Client'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.sectionHead}>
          <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Courses en cours</ThemedText>
          <Pressable onPress={() => router.push('/courier/missions')} hitSlop={8}>
            <ThemedText style={[styles.sectionLink, { color: palette.primary }]}>Tout voir</ThemedText>
          </Pressable>
        </View>

        <View style={styles.missionList}>
          {activeMissions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Package size={26} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.emptyTitle, { color: palette.primaryDeep }]}>Aucune course active</ThemedText>
              <ThemedText style={[styles.emptyText, { color: palette.muted }]}>
                Restez disponible : GoLivra vous attribuera les prochaines missions.
              </ThemedText>
            </View>
          ) : (
            activeMissions.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.missionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                onPress={() => router.push(hrefCourierMission(m.id))}
                android_ripple={{ color: palette.primarySoft }}>
                <View style={styles.missionTop}>
                  <ThemedText style={[styles.missionRef, { color: palette.text }]}>
                    {m.commerce_nom || m.commande?.numero || m.id.slice(0, 8).toUpperCase()}
                  </ThemedText>
                  <View style={[styles.statutPill, { backgroundColor: palette.primarySoft }]}>
                    <ThemedText style={[styles.statutText, { color: palette.primary }]}>{missionStatutLabel(m.statut)}</ThemedText>
                  </View>
                </View>
                <View style={styles.addrRow}>
                  <MapPin size={14} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.missionAddr, { color: palette.textSecondary }]} numberOfLines={2}>
                    {m.adresse_livraison || 'Adresse client'}
                  </ThemedText>
                </View>
                <ChevronRight size={18} color={palette.muted} style={styles.chev} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Kpi({
  label,
  value,
  palette,
  icon,
}: {
  label: string;
  value: number;
  palette: ReturnType<typeof useCourierPalette>;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: palette.primarySoft }]}>{icon}</View>
      <ThemedText style={[styles.kpiVal, { color: palette.primaryDeep }]}>{value}</ThemedText>
      <ThemedText style={[styles.kpiLbl, { color: palette.muted }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, gap: 14 },

  // ── En-tête ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 13, fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, marginTop: 1 },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  bannerErr: {
    borderRadius: 14,
    padding: 12,
  },
  bannerErrText: { fontSize: 13, fontWeight: '600' },

  // ── Carte disponibilité ──
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  dispoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardHint: { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // ── Stats (3 colonnes) ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34 },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiVal: { fontSize: 18, fontWeight: '900' },
  kpiLbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Sections ──
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionLink: { fontSize: 13, fontWeight: '700' },
  missionList: { gap: 10 },
  missionCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    position: 'relative',
  },
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  missionRef: { fontSize: 14, fontWeight: '800' },
  statutPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statutText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 24 },
  missionAddr: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  chev: { position: 'absolute', right: 12, top: '50%', marginTop: 2 },

  // ── État vide ──
  emptyCard: {
    borderRadius: 18,
    padding: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  emptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, opacity: 0.8 },
});
