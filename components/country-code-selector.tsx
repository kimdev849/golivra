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
import { COUNTRY_CONFIGS_LIST, type CountryPhoneConfig } from '@/lib/phone';

type Props = {
  value: string; // indicatif actuel (ex. '+242')
  onChange: (indicatif: string) => void;
  disabled?: boolean;
};

export function CountryCodeSelector({ value, onChange, disabled = false }: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = COUNTRY_CONFIGS_LIST.find((c) => c.indicatif === value) ?? COUNTRY_CONFIGS_LIST[0];

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
              {COUNTRY_CONFIGS_LIST.map((cfg) => (
                <Pressable
                  key={cfg.indicatif}
                  style={[
                    styles.option,
                    { borderBottomColor: colors.border },
                    value === cfg.indicatif && { backgroundColor: colors.successSoft },
                  ]}
                  onPress={() => {
                    onChange(cfg.indicatif);
                    setOpen(false);
                  }}>
                  <ThemedText style={[styles.optionText, { color: colors.text }]}>
                    {cfg.indicatif}
                  </ThemedText>
                  <ThemedText style={[styles.optionName, { color: colors.textMuted }]}>
                    {cfg.country}
                  </ThemedText>
                </Pressable>
              ))}
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
});
