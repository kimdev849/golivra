import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { MapPin, Store } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { missionStatutLabel } from '@/lib/courier-api';
import { useCourierPalette } from '@/lib/courier-theme';
import { hrefCourierMission } from '@/lib/courier-nav';

export default function CourierMissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { missions, loading, error, refresh } = useCourier();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const active = missions.filter((m) => m.statut !== 'livree' && m.statut !== 'annulee');
  const done = missions.filter((m) => m.statut === 'livree' || m.statut === 'annulee');
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

        <View style={styles.header}>
          <ThemedText type="title" style={[styles.title, { color: palette.primaryDeep }]}>
            Mes courses
          </ThemedText>
          <ThemedText style={[styles.sub, { color: palette.muted }]}>
            Les courses proposées par GoLivra
          </ThemedText>
        </View>

        {loading && missions.length === 0 ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 28 }} />
        ) : error ? (
          <View style={[styles.bannerErr, { borderColor: palette.border }]}>
            <ThemedText style={[styles.bannerErrText, { color: palette.danger }]}>{error}</ThemedText>
          </View>
        ) : null}

        <Section title={`En cours (${active.length})`} palette={palette} />
        {active.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ThemedText style={[styles.empty, { color: palette.muted }]}>
              Aucune course active pour le moment.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {active.map((m) => (
              <MissionCard key={m.id} mission={m} onPress={() => router.push(hrefCourierMission(m.id))} palette={palette} />
            ))}
          </View>
        )}

        <Section title={`Historique (${done.length})`} palette={palette} />
        {done.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ThemedText style={[styles.empty, { color: palette.muted }]}>
              Pas encore d’historique.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {done.slice(0, 20).map((m) => (
              <MissionCard key={m.id} mission={m} muted onPress={() => router.push(hrefCourierMission(m.id))} palette={palette} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, palette }: { title: string; palette: ReturnType<typeof useCourierPalette> }) {
  return <ThemedText style={[styles.section, { color: palette.primaryDeep }]}>{title}</ThemedText>;
}

function MissionCard({
  mission,
  muted,
  onPress,
  palette,
}: {
  mission: import('@/lib/courier-api').CourierMission;
  muted?: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useCourierPalette>;
}) {
  const zone = (mission.adresse_livraison || '').split(',').slice(-1)[0]?.trim() || '—';
  const date = new Date(mission.livree_at ?? mission.created_at);
  const dateLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  if (muted) {
    return (
      <Pressable
        style={[styles.card, styles.cardMuted, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={onPress}>
        <View style={styles.cardTop}>
          <ThemedText style={[styles.ref, { color: palette.muted }]}>
            {mission.commande?.numero || mission.id.slice(0, 8).toUpperCase()}
          </ThemedText>
          <ThemedText style={[styles.statut, { color: palette.muted }]}>
            {missionStatutLabel(mission.statut)}
          </ThemedText>
        </View>
        <View style={styles.line}>
          <MapPin size={14} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.lineText, { color: palette.muted }]} numberOfLines={1}>
            {zone}
          </ThemedText>
          <ThemedText style={[styles.dateLabel, { color: palette.muted }]}>{dateLabel}</ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <ThemedText style={[styles.ref, { color: palette.text }]}>
          {mission.commerce_nom || mission.commande?.numero || mission.id.slice(0, 8).toUpperCase()}
        </ThemedText>
        <ThemedText style={[styles.statut, { color: palette.primary }]}>
          {missionStatutLabel(mission.statut)}
        </ThemedText>
      </View>
      {mission.adresse_retrait ? (
        <View style={styles.line}>
          <Store size={14} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.lineText, { color: palette.textSecondary }]} numberOfLines={1}>
            {mission.adresse_retrait}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.line}>
        <MapPin size={14} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.lineText, { color: palette.textSecondary }]} numberOfLines={2}>
          {mission.adresse_livraison || '—'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  header: { marginBottom: 8 },
  title: { fontSize: 26, letterSpacing: -0.4 },
  sub: { marginTop: 2, fontSize: 13 },
  bannerErr: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  bannerErrText: { fontSize: 13 },
  section: { fontSize: 15, fontWeight: '900', marginTop: 14, marginBottom: 2 },
  list: { gap: 10 },
  emptyBox: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  empty: { fontSize: 13 },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
  },
  cardMuted: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontWeight: '800', fontSize: 15 },
  statut: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { flex: 1, fontSize: 13, lineHeight: 18 },
  dateLabel: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
});
