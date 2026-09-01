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
import { MapPin, Store, Clock, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { missionStatutLabel } from '@/lib/courier-api';
import { useCourierPalette } from '@/lib/courier-theme';
import { hrefCourierMission } from '@/lib/courier-nav';

type Filter = 'all' | 'active' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'done', label: 'Terminees' },
];

export default function CourierMissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { missions, loading, error, refresh } = useCourier();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const active = missions.filter((m) => m.statut !== 'livree' && m.statut !== 'annulee');
  const done = missions.filter((m) => m.statut === 'livree' || m.statut === 'annulee');

  const filtered =
    filter === 'active' ? active : filter === 'done' ? done : missions;

  const bottom = Math.max(insets.bottom, 12) + COURIER_TAB_BAR_PADDING_BOTTOM;

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refresh();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: palette.primaryDeep }]}>Mes courses</ThemedText>
          <ThemedText style={[styles.sub, { color: palette.muted }]}>
            Toutes vos livraisons GoLivra
          </ThemedText>
        </View>

        {/* ── Filtres ── */}
        <View style={[styles.filterBar, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {FILTERS.map((f) => {
            const activeFilter = filter === f.key;
            const count =
              f.key === 'active' ? active.length : f.key === 'done' ? done.length : missions.length;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterBtn, activeFilter && { backgroundColor: palette.primary }]}
                onPress={() => setFilter(f.key)}>
                <ThemedText
                  style={[
                    styles.filterText,
                    { color: activeFilter ? '#FFFFFF' : palette.textSecondary },
                  ]}>
                  {f.label}
                </ThemedText>
                {count > 0 ? (
                  <View
                    style={[
                      styles.filterCount,
                      { backgroundColor: activeFilter ? 'rgba(255,255,255,0.25)' : palette.primarySoft },
                    ]}>
                    <ThemedText
                      style={[
                        styles.filterCountText,
                        { color: activeFilter ? '#FFFFFF' : palette.primary },
                      ]}>
                      {count}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {loading && missions.length === 0 ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 28 }} />
        ) : error ? (
          <View style={[styles.bannerErr, { borderColor: palette.danger }]}>
            <ThemedText style={[styles.bannerErrText, { color: palette.danger }]}>{error}</ThemedText>
          </View>
        ) : null}

        {/* ── Liste ── */}
        {filtered.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ThemedText style={[styles.empty, { color: palette.muted }]}>
              {filter === 'active'
                ? 'Aucune course en cours.'
                : filter === 'done'
                  ? "Pas encore d'historique."
                  : 'Aucune course pour le moment.'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.slice(0, 30).map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                palette={palette}
                onPress={() => router.push(hrefCourierMission(m.id))}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function MissionCard({
  mission,
  palette,
  onPress,
}: {
  mission: import('@/lib/courier-api').CourierMission;
  palette: ReturnType<typeof useCourierPalette>;
  onPress: () => void;
}) {
  const isDone = mission.statut === 'livree' || mission.statut === 'annulee';
  const isCancelled = mission.statut === 'annulee';
  const date = new Date(mission.livree_at ?? mission.created_at);
  const dateLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const statusColor = isCancelled
    ? '#EF4444'
    : isDone
      ? '#22C55E'
      : palette.primary;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}
      onPress={onPress}
      android_ripple={{ color: palette.primarySoft }}>
      <View style={[styles.cardLeft, { backgroundColor: statusColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <ThemedText style={[styles.ref, { color: palette.text }]} numberOfLines={1}>
            {mission.commerce_nom || mission.commande?.numero || mission.id.slice(0, 8).toUpperCase()}
          </ThemedText>
          <View style={[styles.pill, { backgroundColor: statusColor + '18' }]}>
            <ThemedText style={[styles.pillText, { color: statusColor }]}>
              {missionStatutLabel(mission.statut)}
            </ThemedText>
          </View>
        </View>

        {mission.adresse_retrait ? (
          <View style={styles.addrLine}>
            <Store size={12} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.addrText, { color: palette.muted }]} numberOfLines={1}>
              {mission.adresse_retrait}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.addrLine}>
          <MapPin size={12} color={statusColor} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.addrText, { color: palette.textSecondary }]} numberOfLines={1}>
            {mission.adresse_livraison || '—'}
          </ThemedText>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dateRow}>
            <Clock size={11} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.dateText, { color: palette.muted }]}>{dateLabel}</ThemedText>
          </View>
          <ChevronRight size={14} color={palette.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sub: { marginTop: 2, fontSize: 13, fontWeight: '500' },

  bannerErr: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  bannerErrText: { fontSize: 13, fontWeight: '600' },

  // ── Filtres ──
  filterBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterCountText: { fontSize: 11, fontWeight: '900' },

  list: { gap: 10 },
  emptyBox: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  empty: { fontSize: 13, fontWeight: '500' },

  // ── Carte mission ──
  card: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardLeft: { width: 4 },
  cardContent: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontWeight: '800', fontSize: 14, flex: 1, marginRight: 8 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  addrLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrText: { flex: 1, fontSize: 12, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11, fontWeight: '600' },
});
