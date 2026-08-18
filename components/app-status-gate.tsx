import { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Smartphone, ShieldAlert, Wrench } from 'lucide-react-native';
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
  | { kind: 'checked'; reason: GateReason; status: AppStatus }
  | { kind: 'ok' };

/**
 * Écran de garde NON-BLOQUANT au-dessus de toute l'application :
 *  - mode maintenance      → « GoLivra est temporairement indisponible »
 *  - kill switch (app coupée) → « Application désactivée »
 *  - version minimale      → « Nouvelle version disponible »
 *
 * Performance : l'app se lance IMMÉDIATEMENT (les enfants sont rendus tout de
 * suite) et le statut serveur est vérifié en ARRIÈRE-PLAN. On ne bascule sur
 * l'écran de blocage que si le serveur répond vraiment « bloqué » (maintenance,
 * kill switch, version). En cas d'échec réseau, l'app reste utilisable.
 * Avant, cette vérification bloquait le démarrage (spinner) tant que l'API
 * n'avait pas répondu — parfois plus d'une minute sur une connexion lente.
 */
export function AppStatusGate({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useAppTheme();
  // Démarre déverrouillé : jamais d'attente réseau au lancement.
  const [state, setState] = useState<GateState>({ kind: 'ok' });
  const [refreshing, setRefreshing] = useState(false);

  const check = async (force = false) => {
    if (force) await fetchAppStatus({ force: true });
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
      await check(true);
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
              {reason === 'version' ? (
                <Smartphone size={40} color={colors.primary} />
              ) : reason === 'disabled' ? (
                <ShieldAlert size={40} color={colors.primary} />
              ) : (
                <Wrench size={40} color={colors.primary} />
              )}
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
