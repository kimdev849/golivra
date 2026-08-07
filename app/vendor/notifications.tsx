import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Banknote, BellOff, CheckCheck, ShoppingBag, Star, Truck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { formatDateTimeFr } from '@/lib/datetime';
import { getSessionToken } from '@/lib/auth';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '@/lib/notifications-api';
import { navigateFromNotification } from '@/lib/notification-navigation';

type NotifIconKind = 'bag' | 'truck' | 'dollar' | 'alert' | 'star';

function iconForType(type: string): NotifIconKind {
  if (type.includes('livraison')) return 'truck';
  if (type.includes('paiement') || type.includes('wallet')) return 'dollar';
  if (type.includes('avis') || type.includes('review')) return 'star';
  if (type.includes('stock') || type.includes('alert')) return 'alert';
  return 'bag';
}

function NotifIcon({ kind, colors }: { kind: NotifIconKind; colors: ReturnType<typeof useAppColors> }) {
  switch (kind) {
    case 'bag':
      return <ShoppingBag size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />;
    case 'truck':
      return <Truck size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />;
    case 'dollar':
      return <Banknote size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />;
    case 'alert':
      return <AlertCircle size={20} color={colors.error} strokeWidth={LUCIDE_STROKE} />;
    case 'star':
      return <Star size={20} color={colors.warning} strokeWidth={LUCIDE_STROKE} />;
    default:
      return <Banknote size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />;
  }
}

/** Horodatage relatif en français (« il y a 5 min », « il y a 2 h »…). */
function timeAgoFr(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return formatDateTimeFr(iso);
}

type FilterKey = 'all' | 'unread';

export default function VendorNotificationsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setItems([]);
        setUnreadCount(0);
        return;
      }
      const res = await fetchNotifications(token, { limit: 60 });
      setItems(res.items ?? []);
      setUnreadCount(res.unread_count ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.est_lue) : items),
    [items, filter],
  );

  /** Non lues parmi les notifications réellement affichées (cohérent avec la liste). */
  const localUnread = useMemo(() => items.filter((n) => !n.est_lue).length, [items]);

  const handleOpen = async (n: AppNotification) => {
    const token = await getSessionToken();
    if (token && !n.est_lue) {
      try {
        await markNotificationRead(token, n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, est_lue: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    navigateFromNotification(router, n);
  };

  const handleMarkAllRead = async () => {
    const token = await getSessionToken();
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((x) => ({ ...x, est_lue: true })));
      setUnreadCount(0);
      try {
        const { loadExpoNotifications } = await import('@/lib/expo-notifications-module');
        const Notifications = await loadExpoNotifications();
        if (Notifications) await Notifications.setBadgeCountAsync(0);
      } catch { /* ignore */ }
    } catch {
      /* ignore */
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader
        title="NOTIFICATIONS"
        right={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => void handleMarkAllRead()}
              hitSlop={8}
              style={[styles.markAllBtn, { borderColor: colors.primary }]}>
              <CheckCheck size={14} color={colors.primary} strokeWidth={2.4} />
              <ThemedText style={[styles.markAllText, { color: colors.primary }]}>Tout lire</ThemedText>
            </Pressable>
          ) : null
        }
      />

      {/* ── Filtre Toutes / Non lues ── */}
      {items.length > 0 ? (
        <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
          {(
            [
              { key: 'all', label: 'Toutes' },
              { key: 'unread', label: `Non lues${localUnread > 0 ? ` (${localUnread})` : ''}` },
            ] as const
          ).map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                hitSlop={6}
                style={[styles.filterTab, on && { borderBottomColor: colors.primary }]}>
                <ThemedText style={[styles.filterText, { color: on ? colors.primary : colors.textMuted, fontWeight: on ? '800' : '600' }]}>
                  {f.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 18, paddingTop: 12 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <BellOff size={30} color={colors.textMuted} strokeWidth={1.8} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'unread' ? 'Tout est lu' : 'Aucune notification'}
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>
              {filter === 'unread'
                ? 'Vous n’avez pas de notification non lue.'
                : 'Nouvelles commandes, livraisons et paiements s’afficheront ici.'}
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {visible.map((n) => {
              const unread = !n.est_lue;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => void handleOpen(n)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: unread ? colors.primarySoft : colors.surface,
                      borderColor: unread ? colors.primaryMuted : colors.border,
                    },
                  ]}>
                  {unread ? <View style={[styles.unreadBar, { backgroundColor: colors.primary }]} /> : null}
                  <View style={[styles.iconWrap, { backgroundColor: unread ? colors.surface : colors.surfaceMuted }]}>
                    <NotifIcon kind={iconForType(n.type)} colors={colors} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <ThemedText style={[styles.titre, { color: colors.text, fontWeight: unread ? '800' : '700' }]}>
                        {n.titre}
                      </ThemedText>
                      {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                    </View>
                    {n.corps ? (
                      <ThemedText style={[styles.corps, { color: unread ? colors.textSecondary : colors.textMuted }]}>
                        {n.corps}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={[styles.time, { color: colors.textMuted }]}>{timeAgoFr(n.created_at)}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterText: { fontSize: 13.5 },
  empty: { alignItems: 'center', marginTop: 48, gap: 6, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titre: { fontSize: 15, flexShrink: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  corps: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11.5, fontWeight: '600', marginTop: 6, opacity: 0.75 },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
