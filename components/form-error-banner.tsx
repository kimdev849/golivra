import { AlertCircle, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';

type ErrorColors = Pick<AppPalette, 'error' | 'errorSoft'>;

type Props = {
  message?: string | null;
  title?: string;
  colors: ErrorColors;
  onDismiss?: () => void;
  variant?: 'inline' | 'centered' | 'compact';
};

const DEFAULT_TITLE = 'Action impossible';

/**
 * Banner d'erreur premium — affichage centré, lisible, pro.
 * Trois variantes :
 *   - centered (défaut) : card pleine largeur, titre + message, X pour fermer
 *   - inline : juste le message, utilisé entre des champs
 *   - compact : ligne unique pour les cas d'erreur en place
 */
export function FormErrorBanner({
  message,
  title,
  colors,
  onDismiss,
  variant = 'centered',
}: Props) {
  if (!message) return null;

  if (variant === 'compact') {
    return (
      <View style={styles.compactRow}>
        <AlertCircle size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.compactText, { color: colors.error }]}>{message}</ThemedText>
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <View
        style={[
          styles.inlineWrap,
          { backgroundColor: colors.errorSoft, borderColor: colors.error },
        ]}
      >
        <AlertCircle size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.inlineText, { color: colors.error }]}>{message}</ThemedText>
        {onDismiss ? (
          <Pressable hitSlop={10} onPress={onDismiss} style={styles.dismiss}>
            <X size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  // centered (défaut)
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.errorSoft, borderColor: colors.error },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.cardIconWrap}>
        <AlertCircle size={22} color={colors.error} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={styles.cardBody}>
        <ThemedText style={[styles.cardTitle, { color: colors.error }]}>
          {title ?? DEFAULT_TITLE}
        </ThemedText>
        <ThemedText style={[styles.cardMessage, { color: colors.error }]}>
          {message}
        </ThemedText>
      </View>
      {onDismiss ? (
        <Pressable hitSlop={10} onPress={onDismiss} style={styles.dismiss}>
          <X size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    width: '100%',
    maxWidth: 460,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  cardMessage: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  dismiss: { padding: 4, marginTop: -2 },
  inlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 460,
  },
  inlineText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    maxWidth: 460,
  },
  compactText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
});
