import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from '@/hooks/use-safe-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Bell, AlertTriangle, Truck, Users, BellOff, CheckCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { getSessionToken } from '@/lib/auth';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications-api';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function iconFor(type: string) {
  if (type.includes('retard') || type.includes('incident') || type.includes('anomalie') || type.includes('bloquee')) return AlertTriangle;
  if (type.includes('livraison') || type.includes('sans_livreur')) return Truck;
  if (type.includes('livreur')) return Users;
  return Bell;
}

function iconColor(type: string) {
  if (type.includes('retard') || type.includes('incident') || type.includes('anomalie') || type.includes('bloquee')) return '#F97316';
  if (type.includes('livraison') || type.includes('sans_livreur')) return '#2563EB';
  return '#6B7280';
}

export default function LogisticsNotificationsScreen() {
  const router = useRouter();
  const guarded = useGuardedCallback();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const bottomPad = Math.max(insets.bottom, 16) + 12;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) { setItems([]); setUnreadCount(0); return; }
      const res = await fetchNotifications(token, { limit: 80 });
      setItems(res.items ?? []);
      setUnreadCount(res.unread_count ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleOpen = async (n: AppNotification) => {
    const token = await getSessionToken();
    if (token && !n.est_lue) {
      try {
        await markNotificationRead(token, n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, est_lue: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    const token = await getSessionToken();
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((x) => ({ ...x, est_lue: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.primaryDeep }]}>Notifications</ThemedText>
        {unreadCount > 0 ? (
          <Pressable style={styles.markAllBtn} onPress={() => guarded(() => void handleMarkAllRead())}>
            <CheckCheck size={14} color={colors.primary} strokeWidth={2.4} />
            <ThemedText style={[styles.markAllText, { color: colors.primary }]}>Tout lire</ThemedText>
          </Pressable>
        ) : <View style={{ width: 72 }} />}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <BellOff size={28} color={colors.textMuted} strokeWidth={1.8} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Aucune notification</ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.textMuted }]}>
                Les alertes de livraison et incidents apparaîtront ici.
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item: n }) => {
          const Icon = iconFor(n.type);
          const col = iconColor(n.type);
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                {
                  borderColor: !n.est_lue ? colors.primaryMuted : colors.border,
                  backgroundColor: !n.est_lue ? colors.primarySoft : colors.surface,
                },
                pressed && { opacity: 0.96 },
              ]}
              onPress={() => guarded(() => void handleOpen(n))}>
              <View style={[styles.rowIcon, { backgroundColor: col + '15', borderColor: colors.border }]}>
                <Icon size={18} color={col} strokeWidth={LUCIDE_STROKE} />
              </View>
              <View style={styles.rowBody}>
                <ThemedText type="defaultSemiBold" style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                  {n.titre}
                </ThemedText>
                {n.corps ? (
                  <ThemedText style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
                    {n.corps}
                  </ThemedText>
                ) : null}
                {n.created_at ? (
                  <ThemedText style={[styles.when, { color: colors.textMuted }]}>{formatWhen(n.created_at)}</ThemedText>
                ) : null}
              </View>
              {!n.est_lue && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#2563EB' },
  markAllText: { fontWeight: '800', fontSize: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  loader: { marginTop: 32, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, gap: 12, alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, lineHeight: 20 },
  body: { fontSize: 13, lineHeight: 18 },
  when: { fontSize: 11.5, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
