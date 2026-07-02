import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { usePaysList } from '@/lib/phone';

type Props = {
  value: string; // indicatif actuel (ex. '+242')
  onChange: (indicatif: string) => void;
  disabled?: boolean;
};

export function CountryCodeSelector({ value, onChange, disabled = false }: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const paysList = usePaysList();

  // Filtrer les pays valides (avec indicatif et phone_digits)
  const validCountries = paysList.filter((p) => p.indicatif && p.phone_digits);

  const selected = validCountries.find((p) => p.indicatif === value)
    ?? validCountries[0]
    ?? { indicatif: '+242', nom: 'Congo' };

  return (
    <>
      <Pressable
        disabled={disabled}
        style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => setOpen(true)}>
        <ThemedText style={[styles.pillText, { color: colors.text }]}>
          {selected.indicatif}
        </ThemedText>
        {!disabled && (
          <ChevronDown size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]}>
              Indicatif du pays
            </ThemedText>
            <ScrollView>
              {validCountries.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.option,
                    { borderBottomColor: colors.border },
                    value === p.indicatif && { backgroundColor: colors.successSoft },
                  ]}
                  onPress={() => {
                    if (p.indicatif) {
                      onChange(p.indicatif);
                    }
                    setOpen(false);
                  }}>
                  <ThemedText style={[styles.optionText, { color: colors.text }]}>
                    {p.indicatif}
                  </ThemedText>
                  <ThemedText style={[styles.optionName, { color: colors.textMuted }]}>
                    {p.nom}
                  </ThemedText>
                </Pressable>
              ))}
              {validCountries.length === 0 && (
                <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                  Chargement des pays…
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '70%',
  },
  title: { fontSize: 17, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 16, fontWeight: '700' },
  optionName: { fontSize: 14 },
  emptyText: { textAlign: 'center', marginVertical: 20, fontSize: 14 },
});
