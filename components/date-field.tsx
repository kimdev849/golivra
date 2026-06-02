import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';

const LOCALE_FR = 'fr-FR';

type ColorSet = {
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  placeholder: string;
  primary: string;
  onPrimary: string;
};

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  accent?: string;
  colors: ColorSet;
  disabled?: boolean;
};

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFrench(d: Date): string {
  try {
    return d.toLocaleDateString(LOCALE_FR, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return toDateString(d);
  }
}

/**
 * Champ de date qui ouvre un calendrier natif (iOS compact/inline, Android modal).
 * Toujours stocké en YYYY-MM-DD (string) pour rester ISO-safe côté backend.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  minimumDate,
  maximumDate,
  accent,
  colors,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseDate(value) ?? new Date());
  const displayDate = parseDate(value);
  const accentColor = accent ?? colors.primary;

  const handleOpen = () => {
    if (disabled) return;
    setDraft(parseDate(value) ?? new Date());
    setOpen(true);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) {
        onChange(toDateString(selected));
      }
      return;
    }
    if (selected) setDraft(selected);
  };

  const handleConfirm = () => {
    onChange(toDateString(draft));
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  const handleClear = () => {
    if (disabled) return;
    onChange(null);
  };

  return (
    <View>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={displayDate ? formatFrench(displayDate) : placeholder}
          onPress={handleOpen}
          disabled={disabled}
          style={({ pressed }) => [styles.field, pressed && !disabled && { opacity: 0.7 }]}>
          <CalendarDays size={18} color={displayDate ? accentColor : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <Text
            style={[
              styles.txt,
              { color: displayDate ? colors.text : colors.placeholder },
            ]}
            numberOfLines={1}>
            {displayDate ? formatFrench(displayDate) : placeholder}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Effacer la date"
            onPress={handleClear}
            hitSlop={10}
            disabled={disabled}
            style={styles.clear}>
            <X size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={handleCancel}>
          <Pressable style={styles.overlay} onPress={handleCancel}>
            <Pressable
              style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => undefined}>
              <View style={styles.sheetHeader}>
                <ThemedText type="defaultSemiBold" style={{ color: colors.text, fontSize: 16 }}>
                  Choisir une date
                </ThemedText>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                locale={LOCALE_FR}
                accentColor={accentColor}
                themeVariant={undefined}
              />
              <View style={styles.actions}>
                <Pressable onPress={handleCancel} style={[styles.actionBtn, { borderColor: colors.border }]}>
                  <ThemedText style={{ color: colors.textSecondary, fontWeight: '700' }}>Annuler</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  style={[styles.actionBtn, { backgroundColor: accentColor, borderColor: accentColor }]}>
                  <ThemedText style={{ color: colors.onPrimary, fontWeight: '700' }}>Valider</ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 8,
    minHeight: 48,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  txt: { fontSize: 15, flex: 1 },
  clear: { padding: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
