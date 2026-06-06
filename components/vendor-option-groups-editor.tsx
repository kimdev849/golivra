import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { emptyOptionGroup, type ProductOptionGroup } from '@/lib/vendor-product-types';

export function OptionGroupsEditor({
  groups,
  onChange,
  accent,
  groupLabel = 'variantes',
  colors,
}: {
  groups: ProductOptionGroup[];
  onChange: (g: ProductOptionGroup[]) => void;
  accent: string;
  groupLabel?: string;
  colors: { border: string; surface: string; surfaceMuted: string; text: string; textSecondary: string; textMuted: string; borderStrong: string; success: string; onPrimary: string; error: string; placeholder: string };
}) {
  const updateGroup = (idx: number, patch: Partial<ProductOptionGroup>) => {
    onChange(groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  };

  const updateChoice = (gIdx: number, cIdx: number, label: string, prix_sup?: string) => {
    const g = groups[gIdx];
    const choix = g.choix.map((c, i) =>
      i === cIdx ? { ...c, label, prix_sup: prix_sup !== undefined ? Number(prix_sup) || 0 : c.prix_sup } : c,
    );
    updateGroup(gIdx, { choix });
  };

  return (
    <View style={styles.variantBlock}>
      {groups.length === 0 ? (
        <ThemedText style={[styles.hint, { color: colors.textMuted }]}>
          Facultatif — taille, cuisson, suppléments…
        </ThemedText>
      ) : null}
      {groups.map((g, gi) => (
        <View key={gi} style={[styles.variantCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.variantHead}>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Nom du groupe (ex. Taille)"
              placeholderTextColor={colors.placeholder}
              value={g.nom}
              onChangeText={(t) => updateGroup(gi, { nom: t })}
            />
            <Pressable onPress={() => onChange(groups.filter((_, i) => i !== gi))} hitSlop={8}>
              <Trash2 size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={[styles.switchLabel, { color: colors.text }]}>Choix obligatoire</ThemedText>
            <Switch
              value={g.requis !== false}
              onValueChange={(v) => updateGroup(gi, { requis: v })}
              trackColor={{ false: colors.borderStrong, true: colors.success }}
              thumbColor={g.requis !== false ? accent : colors.surfaceMuted}
            />
          </View>
          {g.choix.map((c, ci) => (
            <View key={ci} style={styles.choiceRow}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Libellé (ex. Moyen)"
                placeholderTextColor={colors.placeholder}
                value={c.label}
                onChangeText={(t) => updateChoice(gi, ci, t)}
              />
              <TextInput
                style={[styles.input, styles.choicePrice, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="+0"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                value={String(c.prix_sup ?? 0)}
                onChangeText={(t) => updateChoice(gi, ci, c.label, t)}
              />
              {g.choix.length > 1 ? (
                <Pressable onPress={() => updateGroup(gi, { choix: g.choix.filter((_, i) => i !== ci) })}>
                  <X size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            style={styles.linkBtn}
            onPress={() => updateGroup(gi, { choix: [...g.choix, { label: '', prix_sup: 0 }] })}>
            <ThemedText style={[styles.linkTxt, { color: accent }]}>+ Choix</ThemedText>
          </Pressable>
        </View>
      ))}
      <Pressable
        style={[styles.outlineBtn, { borderColor: accent }]}
        onPress={() => onChange([...groups, emptyOptionGroup()])}>
        <Plus size={18} color={accent} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.outlineTxt, { color: accent }]}>
          {"Groupe d'"}{groupLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  variantBlock: { gap: 12 },
  variantCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  switchLabel: { fontSize: 13, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choicePrice: { width: 72 },
  linkBtn: { alignSelf: 'flex-start' },
  linkTxt: { fontWeight: '700', fontSize: 13 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  outlineTxt: { fontWeight: '800', fontSize: 14 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
