import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';
import type { EnterpriseCategory } from '@/lib/enterprise';

type Props = {
  visible: boolean;
  title: string;
  categories: EnterpriseCategory[];
  selectedId: string | null;
  onSelect: (category: EnterpriseCategory) => void;
  onClose: () => void;
  /** Chargement en cours (affiche un indicateur à la place de la liste). */
  loading?: boolean;
  /** Le chargement a échoué : on propose de réessayer au lieu d'une liste vide muette. */
  error?: string | null;
  onRetry?: () => void;
};

export function CategoryPicker({
  visible,
  title,
  categories,
  selectedId,
  onSelect,
  onClose,
  loading = false,
  error = null,
  onRetry,
}: Props) {
  const colors = useAppColors();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]}>
            {title}
          </ThemedText>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.primary} />
              <ThemedText style={[styles.stateText, { color: colors.textMuted }]}>
                Chargement des catégories…
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <MaterialIcons name="error-outline" size={26} color={colors.error} />
              <ThemedText style={[styles.stateText, { color: colors.text }]}>
                Impossible de charger les catégories.
              </ThemedText>
              <ThemedText style={[styles.stateHint, { color: colors.textMuted }]}>{error}</ThemedText>
              {onRetry ? (
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={onRetry}>
                  <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.retryTxt}>Réessayer</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.stateBox}>
              <MaterialIcons name="category" size={26} color={colors.textMuted} />
              <ThemedText style={[styles.stateText, { color: colors.text }]}>
                Aucune catégorie disponible pour le moment.
              </ThemedText>
              <ThemedText style={[styles.stateHint, { color: colors.textMuted }]}>
                Les catégories sont définies par GoLivra. Réessayez dans un instant.
              </ThemedText>
              {onRetry ? (
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={onRetry}>
                  <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.retryTxt}>Réessayer</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <ScrollView style={[styles.list, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled">
              {categories.map((c) => {
                const selected = c.id === selectedId;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.row, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.successSoft : colors.surfaceMuted }]}
                    onPress={() => { onSelect(c); onClose(); }}>
                    <ThemedText style={[styles.rowText, { color: selected ? colors.primary : colors.text }, selected && styles.rowTextSelected]}>{c.nom}</ThemedText>
                    {selected ? <MaterialIcons name="check" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingBottom: 24, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 17, marginBottom: 12 },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rowText: { fontSize: 15, flex: 1 },
  rowTextSelected: { fontWeight: '800' },
  stateBox: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 12 },
  stateText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  stateHint: { fontSize: 12.5, textAlign: 'center', lineHeight: 18, opacity: 0.8 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  retryTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
