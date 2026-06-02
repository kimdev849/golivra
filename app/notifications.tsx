import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Bell, ChevronLeft, Package } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications-api';
import { navigateFromNotification } from '@/lib/notification-navigation';

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bottomPad = Math.max(insets.bottom, 16) + 12;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getSessionToken();
      if (!token) { setItems([]); setUnreadCount(0); return; }
      const res = await fetchNotifications(token, { limit: 80 });
      setItems(res.items ?? []); setUnreadCount(res.unread_count ?? 0);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de charger les notifications.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleOpen = async (n: AppNotification) => {
    const token = await getSessionToken();
    if (token && !n.est_lue) {
      try { await markNotificationRead(token, n.id); setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, est_lue: true } : x))); setUnreadCount((c) => Math.max(0, c - 1)); } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.primaryDeep }]}>Notifications</ThemedText>
        {unreadCount > 0 ? (
          <Pressable style={styles.markAllBtn} onPress={() => void handleMarkAllRead()}>
            <ThemedText style={[styles.markAllText, { color: colors.primary }]}>Tout lire</ThemedText>
          </Pressable>
        ) : <View style={styles.headerSpacer} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          Vos alertes commandes, paiements et livraisons GoLivra.{unreadCount > 0 ? ` (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})` : ''}
        </ThemedText>

        {loading ? (
          <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /><ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement…</ThemedText></View>
        ) : error ? (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.errorSoft }]}>
            <ThemedText style={[styles.errText, { color: colors.error }]}>{error}</ThemedText>
            <Pressable style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => void load()}>
              <ThemedText style={styles.retryText}>Réessayer</ThemedText>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
              <Bell size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.primaryDeep }]}>Aucune notification</ThemedText>
            <ThemedText style={[styles.cardBody, { color: colors.textMuted }]}>Vous serez informé ici des événements importants sur vos commandes.</ThemedText>
            <Pressable style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/marketplace')}>
              <ThemedText style={styles.retryText}>Parcourir le marketplace</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {items.map((n) => (
              <Pressable key={n.id} style={({ pressed }) => [styles.row, { borderColor: !n.est_lue ? colors.successSoft : colors.border, backgroundColor: !n.est_lue ? colors.successSoft : colors.surface }, pressed && styles.rowPressed]} onPress={() => void handleOpen(n)} android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                  <Package size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <ThemedText type="defaultSemiBold" style={[styles.rowTitle, { color: colors.text }]}>{n.titre}</ThemedText>
                  {n.corps ? <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{n.corps}</ThemedText> : null}
                  {n.created_at ? <ThemedText style={[styles.when, { color: colors.textMuted }]}>{formatWhen(n.created_at)}</ThemedText> : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 72 },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  markAllText: { fontWeight: '800', fontSize: 13 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 14, lineHeight: 21, opacity: 0.92, marginBottom: 18 },
  loader: { marginTop: 32, alignItems: 'center', gap: 12 },
  muted: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 12, alignItems: 'center', elevation: 4 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  errText: { fontWeight: '700', textAlign: 'center' },
  retry: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderWidth: 1, borderRadius: 20, padding: 16, elevation: 4 },
  rowPressed: { opacity: 0.96 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowTitle: { fontSize: 16 },
  body: { fontSize: 14, lineHeight: 20 },
  when: { fontSize: 12 },
});
