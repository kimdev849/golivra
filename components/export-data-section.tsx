import * as Haptics from 'expo-haptics';
import { Download, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { exportMyDataRemote, getSessionToken } from '@/lib/auth';

/**
 * Export RGPD — portabilité des données personnelles (art. 20 RGPD).
 * Récupère `GET /api/auth/data-export` et affiche le JSON complet dans une
 * modale (aucun secret : le backend n'exporte jamais hash/tokens/IP).
 */
export function ExportDataSection() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const runExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous.');
      const data = await exportMyDataRemote({ token });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setPayload(data);
      setOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export impossible. Réessayez.';
      setError(message);
      Alert.alert('Export impossible', message);
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    if (loading) return;
    setOpen(false);
    setPayload(null);
    setError(null);
  };

  const json = payload ? JSON.stringify(payload, null, 2) : '';
  const count = payload && typeof payload === 'object' ? Object.keys(payload as object).length : 0;

  return (
    <>
      <Pressable
        style={[
          styles.exportBtn,
          { borderColor: colors.border, backgroundColor: colors.surface },
          loading && styles.btnDisabled,
        ]}
        onPress={() => void runExport()}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <Download size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        )}
        <ThemedText style={[styles.exportBtnText, { color: colors.text }]}>
          {loading ? 'Export en cours…' : 'Exporter mes données (RGPD)'}
        </ThemedText>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <ThemedText style={[styles.title, { color: colors.text }]}>
                  Mes données personnelles
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>
                  {count} sections — format JSON (portabilité RGPD)
                </ThemedText>
              </View>
              <Pressable onPress={close} hitSlop={10} style={styles.closeBtn}>
                <X size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            </View>

            <ScrollView style={styles.jsonScroll} contentContainerStyle={styles.jsonContent}>
              <Text selectable style={[styles.jsonText, { color: colors.text }]}>
                {json}
              </Text>
            </ScrollView>

            <Pressable
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={close}>
              <ThemedText style={[styles.doneBtnText, { color: colors.onPrimary }]}>Fermer</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.6 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  jsonScroll: {
    flexGrow: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.25)',
    marginBottom: 12,
  },
  jsonContent: { padding: 12 },
  jsonText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
  },
  doneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '700' },
});
