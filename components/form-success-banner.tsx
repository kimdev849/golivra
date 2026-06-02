import { CheckCircle2, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';

type SuccessColors = Pick<AppPalette, 'success' | 'successSoft'>;

type Props = {
  message?: string | null;
  title?: string;
  colors: SuccessColors;
  onDismiss?: () => void;
};

const DEFAULT_TITLE = 'Tout est bon';

/**
 * Banner de succès premium — cohérent visuellement avec FormErrorBanner.
 * Utilisé pour confirmer une action réussie (profil mis à jour, etc.).
 */
export function FormSuccessBanner({ message, title, colors, onDismiss }: Props) {
  if (!message) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.successSoft, borderColor: colors.success }]}
      accessibilityRole="alert"
    >
      <View style={styles.iconWrap}>
        <CheckCircle2 size={22} color={colors.success} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.title, { color: colors.success }]}>
          {title ?? DEFAULT_TITLE}
        </ThemedText>
        <ThemedText style={[styles.text, { color: colors.success }]}>{message}</ThemedText>
      </View>
      {onDismiss ? (
        <Pressable hitSlop={10} onPress={onDismiss} style={styles.dismiss}>
          <X size={18} color={colors.success} strokeWidth={LUCIDE_STROKE} />
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
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  dismiss: { padding: 4, marginTop: -2 },
});
