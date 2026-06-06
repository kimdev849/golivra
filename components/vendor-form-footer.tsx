import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';

type Props = {
  step: number;
  totalSteps: number;
  mode: 'create' | 'edit';
  saving: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  colors: AppPalette;
  accent: string;
  accentDeep: string;
  bottomInset: number;
};

/** Pied de formulaire vendeur — deux boutons plats, sans flèches. */
export function VendorFormFooter({
  step,
  totalSteps,
  mode,
  saving,
  onCancel,
  onBack,
  onNext,
  colors,
  accent,
  accentDeep,
  bottomInset,
}: Props) {
  const isFirst = step === 0;
  const isReview = step === totalSteps - 1;
  const leftLabel = isFirst ? 'Annuler' : 'Retour';
  const rightLabel = isReview ? (mode === 'edit' ? 'Enregistrer' : 'Publier') : 'Continuer';

  const onLeft = isFirst ? onCancel : onBack;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(bottomInset, 12),
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}>
      <Pressable
        style={[styles.btn, styles.btnGhost, { borderColor: colors.border }]}
        onPress={onLeft}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={leftLabel}>
        <ThemedText style={[styles.btnGhostTxt, { color: colors.text }]}>{leftLabel}</ThemedText>
      </Pressable>
      <Pressable
        style={[
          styles.btn,
          styles.btnPrimary,
          { backgroundColor: isReview ? accentDeep : accent, opacity: saving ? 0.65 : 1 },
        ]}
        onPress={onNext}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={rightLabel}>
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <ThemedText style={[styles.btnPrimaryTxt, { color: colors.onPrimary }]}>{rightLabel}</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 15,
    minHeight: 50,
  },
  btnGhost: {
    borderWidth: 1,
  },
  btnGhostTxt: {
    fontWeight: '700',
    fontSize: 15,
  },
  btnPrimary: {},
  btnPrimaryTxt: {
    fontWeight: '800',
    fontSize: 15,
  },
});
