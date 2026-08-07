import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';

type Props = {
  /** Libellés des étapes, dans l'ordre. */
  steps: string[];
  /** Étape courante, 1-based. */
  current: number;
  colors: AppPalette;
};

/**
 * Stepper de progression — pastilles numérotées reliées par une ligne.
 * Étape courante + étapes passées : vert. Suivantes : gris.
 * La ligne est verte dès que l'étape qu'elle précède est atteinte.
 */
export function FormStepper({ steps, current, colors }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const colored = idx <= current;
        // Ligne située après l'étape i : verte si cette étape est atteinte/passée.
        const lineColored = i > 0 && i <= current;
        return (
          <Fragment key={label}>
            {i > 0 ? (
              <View
                style={[
                  styles.line,
                  { backgroundColor: lineColored ? colors.primary : colors.border },
                ]}
              />
            ) : null}
            <View style={styles.step}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: colored ? colors.primary : colors.surfaceElevated,
                    borderColor: colored ? colors.primary : colors.borderStrong,
                  },
                ]}
              >
                {idx < current ? (
                  <Check size={13} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <ThemedText
                    style={[styles.number, { color: colored ? '#FFFFFF' : colors.textMuted }]}
                  >
                    {idx}
                  </ThemedText>
                )}
              </View>
              <ThemedText
                style={[
                  styles.label,
                  { color: colored ? colors.primary : colors.textMuted },
                ]}
              >
                {label}
              </ThemedText>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 12,
    fontWeight: '900',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  line: {
    width: 30,
    height: 2,
    borderRadius: 2,
    marginHorizontal: 6,
  },
});
