import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { QUARTIERS_BRAZZAVILLE } from '@/constants/quartiers-brazzaville';
import { useAppColors } from '@/hooks/use-app-colors';
import type { DeliveryAddressFields } from '@/lib/format-address';

export type DeliveryAddressFormValue = DeliveryAddressFields;

/** Suggestions rapides pour le nom de l'adresse. */
const ADDRESS_LABEL_CHIPS = ['Maison', 'Travail', 'Bureau'] as const;

type Props = {
  value: DeliveryAddressFormValue;
  onChange: (next: DeliveryAddressFormValue) => void;
  accentColor?: string;
  compact?: boolean;
  /** Si false : les champs (arrondissement + adresse détaillée) sont facultatifs (boutiques e-commerce). */
  required?: boolean;
  /** Masque le champ « Nom de l'adresse » (géré dans « Mes adresses »). */
  hideLibelle?: boolean;
};

export function DeliveryAddressForm({ value, onChange, accentColor, compact = false, required = true, hideLibelle = false }: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const accent = accentColor ?? colors.primary;
  const accentDeep = accentColor ?? colors.primaryDeep;
  const [quartierOpen, setQuartierOpen] = useState(false);
  const [quartierSearch, setQuartierSearch] = useState('');
  const [showOptional, setShowOptional] = useState(!compact);
  const reqMark = required ? ' *' : '';

  const patch = useCallback(
    (part: Partial<DeliveryAddressFormValue>) => {
      onChange({ ...value, ...part });
    },
    [onChange, value],
  );

  const step = (n: number, title: string) =>
    compact ? (
      <ThemedText style={styles.stepTitle}>
        <ThemedText style={[styles.stepNum, { color: accent }]}>{n}. </ThemedText>
        {title}
      </ThemedText>
    ) : (
      <ThemedText style={[styles.blockTitle, { color: accentDeep }]}>{title}</ThemedText>
    );

  return (
    <View style={styles.wrap}>
      {/* ── Nom de l'adresse (optionnel, masqué quand hideLibelle) ── */}
      {!hideLibelle ? (
        <>
          <ThemedText style={compact ? [styles.optionalLabel, { color: colors.textMuted }] : [styles.blockTitle, { color: accentDeep }]}>
            Nom de l&apos;adresse
          </ThemedText>
          <View style={styles.chipsRow}>
            {ADDRESS_LABEL_CHIPS.map((chip) => {
              const on = (value.libelle ?? '').trim() === chip;
              return (
                <Pressable
                  key={chip}
                  onPress={() => patch({ libelle: on ? '' : chip })}
                  style={[
                    styles.chip,
                    { borderColor: on ? accent : colors.border, backgroundColor: on ? accent : colors.surface },
                  ]}>
                  <ThemedText style={[styles.chipText, { color: on ? '#FFFFFF' : colors.textMuted }]}>{chip}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={value.libelle ?? ''}
            onChangeText={(libelle) => patch({ libelle })}
            placeholder="Ex. Chez maman, Résidence…"
            placeholderTextColor={colors.placeholder}
            maxLength={50}
          />
        </>
      ) : null}

      {step(1, `Arrondissement${reqMark}`)}
      {!compact ? (
        <ThemedText style={[styles.hint, { color: colors.textMuted }]}>
          {"Choisissez votre quartier (arrondissement), puis précisez l'adresse en texte libre."}
        </ThemedText>
      ) : null}
      <Pressable style={[styles.select, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setQuartierOpen(true)}>
        <ThemedText style={value.quartier ? [styles.selectValue, { color: colors.text }] : [styles.selectPlaceholder, { color: colors.placeholder }]}>
          {value.quartier || 'Choisir un arrondissement'}
        </ThemedText>
      </Pressable>

      {step(2, `Adresse détaillée${reqMark}`)}
      {!compact ? (
        <ThemedText style={[styles.hint, { color: colors.textMuted }]}>Rue, repère, couleur du portail, immeuble…</ThemedText>
      ) : null}
      <TextInput
        style={[styles.input, compact ? styles.areaCompact : styles.area, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        value={value.ligne1}
        onChangeText={(ligne1) => patch({ ligne1 })}
        placeholder="Ex. Après Total, immeuble bleu, portail vert"
        placeholderTextColor={colors.placeholder}
        multiline
        textAlignVertical="top"
      />

      {compact && !showOptional ? (
        <Pressable onPress={() => setShowOptional(true)} hitSlop={8}>
          <ThemedText style={[styles.moreLink, { color: accent }]}>
            + Repère et instructions (recommandé)
          </ThemedText>
        </Pressable>
      ) : null}

      {showOptional || !compact ? (
        <>
          <ThemedText style={compact ? [styles.optionalLabel, { color: colors.textMuted }] : [styles.blockTitle, { color: accentDeep }]}>
            Point de repère (optionnel)
          </ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={value.point_reperes ?? ''}
            onChangeText={(point_reperes) => patch({ point_reperes })}
            placeholder="Ex. Face station Puma, près école…"
            placeholderTextColor={colors.placeholder}
          />
          <ThemedText style={compact ? [styles.optionalLabel, { color: colors.textMuted }] : [styles.blockTitle, { color: accentDeep }]}>
            Instructions livreur (optionnel)
          </ThemedText>
          <TextInput
            style={[styles.input, styles.areaSmall, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={value.instructions ?? ''}
            onChangeText={(instructions) => patch({ instructions })}
            placeholder="Ex. Sonner 2 fois"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />
        </>
      ) : null}

      <Modal visible={quartierOpen} transparent animationType="slide" onRequestClose={() => setQuartierOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQuartierOpen(false)}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) },
            ]}>
            <ThemedText type="defaultSemiBold" style={[styles.modalTitle, { color: colors.text }]}>
              Arrondissement / quartier
            </ThemedText>
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <TextInput
                placeholder="Rechercher..."
                placeholderTextColor={colors.textMuted}
                value={quartierSearch}
                onChangeText={setQuartierSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
            <ScrollView>
              {QUARTIERS_BRAZZAVILLE.filter((q) => !quartierSearch || q.toLowerCase().includes(quartierSearch.toLowerCase())).map((q) => (
                <Pressable
                  key={q}
                  style={[styles.quartierRow, { borderBottomColor: colors.border }, value.quartier === q && { backgroundColor: colors.successSoft }]}
                  onPress={() => {
                    patch({ quartier: q });
                    setQuartierSearch('');
                    setQuartierOpen(false);
                  }}>
                  <ThemedText style={[styles.quartierTxt, { color: colors.text }]}>{q}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  blockTitle: { fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  stepTitle: { fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  stepNum: { fontWeight: '900' },
  optionalLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 6, lineHeight: 17 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  moreLink: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  select: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectValue: { fontSize: 15, fontWeight: '600' },
  selectPlaceholder: { fontSize: 15 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 88 },
  areaCompact: { minHeight: 72 },
  areaSmall: { minHeight: 56 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, marginBottom: 12 },
  searchBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  searchInput: { fontSize: 14, padding: 0 },
  quartierRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  quartierTxt: { fontSize: 16 },
});
