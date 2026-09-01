import { useFocusEffect } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChevronRight,
  MapPin,
  Package,
  Target,
  CheckCircle2,
  Navigation,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { useFeatureEnabled } from '@/hooks/use-feature-enabled';
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
  const deliveryEnabled = useFeatureEnabled('delivery');
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
      setErrorLocal(e instanceof Error ? e.message : 'Erreur disponibilite.');
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.primary} />
        }
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── Hero section ── */}
        <LinearGradient
          colors={[palette.primary, palette.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.heroGreeting}>Bonjour,</ThemedText>
              <ThemedText style={styles.heroName} numberOfLines={1}>
                {profile?.utilisateur?.nom || 'Livreur'}
              </ThemedText>
              <ThemedText style={styles.heroSub}>
                {disponible
                  ? 'En ligne — pret pour les courses'
                  : 'Hors ligne'}
              </ThemedText>
            </View>
            <Pressable
              style={styles.heroNotifBtn}
              onPress={() => router.push('/courier/notifications')}
              hitSlop={10}>
              <Bell size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              {unreadCount > 0 ? (
                <View style={styles.heroNotifBadge}>
                  <ThemedText style={styles.heroNotifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
                </View>
              ) : null}
            </Pressable>
          </View>
        </LinearGradient>

        {displayError ? (
          <View style={[styles.bannerErr, { borderColor: palette.danger }]}>
            <ThemedText style={[styles.bannerErrText, { color: palette.danger }]}>{displayError}</ThemedText>
          </View>
        ) : null}

        {/* ── Disponibilite ── */}
        <View style={[styles.dispoCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.dispoRow}>
            <View style={[styles.dispoDot, { backgroundColor: disponible ? '#22C55E' : palette.muted }]} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.dispoTitle, { color: palette.primaryDeep }]}>
                {disponible ? 'En ligne' : 'Hors ligne'}
              </ThemedText>
              <ThemedText style={[styles.dispoHint, { color: palette.muted }]}>
                {disponible
                  ? 'GoLivra peut vous envoyer des livraisons.'
                  : 'Activez pour recevoir des courses.'}
              </ThemedText>
            </View>
            <Switch
              value={disponible}
              disabled={acting || !deliveryEnabled}
              onValueChange={(v) => void toggleDispo(v)}
              trackColor={{ false: palette.trackStroke, true: palette.primary }}
              thumbColor={disponible ? '#FFFFFF' : '#F9FAFB'}
            />
          </View>
          {!deliveryEnabled ? (
            <View style={[styles.bannerErr, { borderColor: palette.danger }]}>
              <ThemedText style={[styles.bannerErrText, { color: palette.danger }]}>
                Les livraisons sont temporairement desactivees par l&apos;administrateur.
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* ── Stats (3 colonnes) ── */}
        <View style={[styles.statsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Kpi
            label="En cours"
            value={profile?.resume?.missions_actives ?? 0}
            palette={palette}
            icon={<Navigation size={16} color="#FFFFFF" strokeWidth={2.4} />}
            color="#3B82F6"
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <Kpi
            label="Aujourd'hui"
            value={profile?.resume?.missions_aujourdhui ?? 0}
            palette={palette}
            icon={<Target size={16} color="#FFFFFF" strokeWidth={2.4} />}
            color="#F59E0B"
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <Kpi
            label="Reussies"
            value={profile?.resume?.reussies_historique ?? 0}
            palette={palette}
            icon={<CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.4} />}
            color="#22C55E"
          />
        </View>

        {/* ── Courses disponibles ── */}
        {disponible && openMissions.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadLeft}>
                <View style={[styles.sectionDot, { backgroundColor: '#F59E0B' }]} />
                <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>
                  Nouvelles courses
                </ThemedText>
              </View>
              <View style={[styles.sectionCount, { backgroundColor: '#FEF3C7' }]}>
                <ThemedText style={[styles.sectionCountText, { color: '#92400E' }]}>{openMissions.length}</ThemedText>
              </View>
            </View>
            <View style={styles.missionList}>
              {openMissions.slice(0, 3).map((m) => (
                <Pressable
                  key={m.id}
                  style={[styles.missionCard, { borderColor: '#F59E0B', backgroundColor: palette.card }]}
                  onPress={() => router.push(hrefCourierMission(m.id))}>
                  <View style={[styles.missionAccentBar, { backgroundColor: '#F59E0B' }]} />
                  <View style={styles.missionCardContent}>
                    <View style={styles.missionTop}>
                      <ThemedText style={[styles.missionRef, { color: palette.text }]} numberOfLines={1}>
                        {m.commerce_nom || m.commande?.numero || m.id.slice(0, 8).toUpperCase()}
                      </ThemedText>
                      <View style={[styles.missionPill, { backgroundColor: '#FEF3C7' }]}>
                        <Zap size={10} color="#92400E" strokeWidth={2.4} />
                        <ThemedText style={[styles.missionPillText, { color: '#92400E' }]}>Nouvelle</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.missionAddr, { color: palette.textSecondary }]} numberOfLines={2}>
                      {m.adresse_retrait || 'Retrait'} {'\u2192'} {m.adresse_livraison || 'Client'}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Courses en cours ── */}
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadLeft}>
            <View style={[styles.sectionDot, { backgroundColor: palette.primary }]} />
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Courses en cours</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/courier/missions')} hitSlop={8}>
            <ThemedText style={[styles.sectionLink, { color: palette.primary }]}>Tout voir</ThemedText>
          </Pressable>
        </View>

        <View style={styles.missionList}>
          {activeMissions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: palette.primarySoft }]}>
                <Package size={24} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: palette.primaryDeep }]}>Aucune course active</ThemedText>
              <ThemedText style={[styles.emptyText, { color: palette.muted }]}>
                Restez disponible, GoLivra vous enverra les prochaines courses.
              </ThemedText>
            </View>
          ) : (
            activeMissions.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.missionCard, { backgroundColor: palette.card, borderColor: palette.border }]}
                onPress={() => router.push(hrefCourierMission(m.id))}
                android_ripple={{ color: palette.primarySoft }}>
                <View style={[styles.missionAccentBar, { backgroundColor: palette.primary }]} />
                <View style={styles.missionCardContent}>
                  <View style={styles.missionTop}>
                    <ThemedText style={[styles.missionRef, { color: palette.text }]} numberOfLines={1}>
                      {m.commerce_nom || m.commande?.numero || m.id.slice(0, 8).toUpperCase()}
                    </ThemedText>
                    <View style={[styles.missionPill, { backgroundColor: palette.primarySoft }]}>
                      <ThemedText style={[styles.missionPillText, { color: palette.primary }]}>
                        {missionStatutLabel(m.statut)}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.addrRow}>
                    <MapPin size={13} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.missionAddr, { color: palette.textSecondary }]} numberOfLines={2}>
                      {m.adresse_livraison || 'Adresse client'}
                    </ThemedText>
                  </View>
                </View>
                <ChevronRight size={16} color={palette.muted} style={styles.chev} />
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
  color,
}: {
  label: string;
  value: number;
  palette: ReturnType<typeof useCourierPalette>;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <View style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: color }]}>{icon}</View>
      <ThemedText style={[styles.kpiVal, { color: palette.primaryDeep }]}>{value}</ThemedText>
      <ThemedText style={[styles.kpiLbl, { color: palette.muted }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, gap: 14 },

  // ── Hero ──
  hero: {
    borderRadius: 20,
    padding: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGreeting: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  heroNotifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroNotifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  heroNotifBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },

  bannerErr: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  bannerErrText: { fontSize: 13, fontWeight: '600' },

  // ── Dispo card ──
  dispoCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  dispoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dispoDot: { width: 10, height: 10, borderRadius: 5 },
  dispoTitle: { fontSize: 15, fontWeight: '800', marginBottom: 1 },
  dispoHint: { fontSize: 12, fontWeight: '500', lineHeight: 17 },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 38 },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kpiVal: { fontSize: 20, fontWeight: '900' },
  kpiLbl: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // ── Sections ──
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionLink: { fontSize: 13, fontWeight: '700' },
  sectionCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: { fontSize: 12, fontWeight: '900' },

  // ── Mission cards ──
  missionList: { gap: 10 },
  missionCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  missionAccentBar: {
    width: 4,
  },
  missionCardContent: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    gap: 6,
  },
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  missionRef: { fontSize: 14, fontWeight: '800', flex: 1, marginRight: 8 },
  missionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  missionPillText: { fontSize: 11, fontWeight: '800' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missionAddr: { fontSize: 13, fontWeight: '500', lineHeight: 18, flex: 1 },
  chev: { alignSelf: 'center', marginRight: 12 },

  // ── Empty ──
  emptyCard: {
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  emptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, opacity: 0.8 },
});
