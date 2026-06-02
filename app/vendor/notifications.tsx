import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AlertCircle, Banknote, ShoppingBag, Star, Truck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
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

export default function VendorNotificationsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
              <ThemedText style={[styles.markAllText, { color: colors.primary }]}>Tout lire</ThemedText>
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 18, paddingTop: 8 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Aucune notification pour le moment.</ThemedText>
        ) : (
          items.map((n) => (
            <Pressable key={n.id} style={[styles.row, { borderBottomColor: colors.border }, !n.est_lue && { backgroundColor: colors.primarySoft }]} onPress={() => void handleOpen(n)}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                <NotifIcon kind={iconForType(n.type)} colors={colors} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.titre, { color: colors.text }]}>{n.titre}</ThemedText>
                {n.corps ? <ThemedText style={[styles.corps, { color: colors.textMuted }]}>{n.corps}</ThemedText> : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titre: { fontWeight: '700', fontSize: 15 },
  corps: { fontSize: 13, marginTop: 4 },
  markAllBtn: {
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
