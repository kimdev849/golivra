import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/contexts/app-theme-context';
import {
  debugApiOrigin,
  fetchAppStatus,
  getAppVersion,
  resolveAppGate,
  type AppStatus,
} from '@/lib/app-status';

type GateReason = 'maintenance' | 'disabled' | 'version';

type GateState =
  | { kind: 'loading' }
  | { kind: 'checked'; reason: GateReason; status: AppStatus }
  | { kind: 'ok' };

/**
 * Écran de garde au-dessus de toute l'application :
 *  - mode maintenance      → « GoLivra est temporairement indisponible »
 *  - kill switch (app coupée) → « Application désactivée »
 *  - version minimale      → « Nouvelle version disponible »
 *
 * Tant que le statut serveur n'est pas connu, un splash léger est affiché.
 * En cas d'échec réseau, l'app reste utilisable (jamais bloquée hors-ligne).
 */
export function AppStatusGate({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useAppTheme();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const check = async () => {
    const gate = await resolveAppGate();
    if (!gate.blocked) {
      setState({ kind: 'ok' });
      return;
    }
    setState({ kind: 'checked', reason: gate.reason, status: gate.status });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const gate = await resolveAppGate();
      if (!mounted) return;
      if (!gate.blocked) setState({ kind: 'ok' });
      else setState({ kind: 'checked', reason: gate.reason, status: gate.status });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (state.kind === 'ok') {
    return <>{children}</>;
  }

  const { reason, status } = state;

  const title =
    reason === 'version'
      ? 'Nouvelle version disponible'
      : reason === 'disabled'
        ? 'Application désactivée'
        : 'Maintenance en cours';

  const message =
    reason === 'version'
      ? `Une nouvelle version de GoLivra est disponible. Installez la version ${status.min_app_version} ou plus récente pour continuer.`
      : reason === 'disabled'
        ? "GoLivra a été temporairement désactivé par l'administrateur. Réessayez plus tard."
        : 'GoLivra est temporairement indisponible pour maintenance. Nous revenons très vite !';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAppStatus({ force: true });
      await check();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ['#0f172a', '#1e293b'] : ['#e0f2fe', '#ffffff']}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.iconEmoji, { color: colors.primary }]}>
              {reason === 'version' ? '📲' : reason === 'disabled' ? '⛔' : '🛠️'}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.buttonText}>Vérifier à nouveau</Text>
          </Pressable>

          <Text style={[styles.debug, { color: colors.textMuted }]}>
            v{getAppVersion()} · {debugApiOrigin().replace('https://', '')}
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', maxWidth: 420, width: '100%' },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 40 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  debug: { marginTop: 18, fontSize: 11, opacity: 0.6, textAlign: 'center' },
});
