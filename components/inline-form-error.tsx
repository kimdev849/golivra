import { AlertCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';

type Props = {
  message?: string | null;
  colors: Pick<AppPalette, 'error' | 'errorSoft'>;
  showIcon?: boolean;
  marginTop?: number;
};

/**
 * Message d'erreur affiché directement sous le champ concerné.
 * Présentation douce et lisible : pastille d'icône + texte sur fond léger,
 * pour que l'utilisateur comprenne d'un coup d'œil quoi corriger.
 */
export function InlineFormError({ message, colors, showIcon = true, marginTop = 4 }: Props) {
  if (!message) return null;
  return (
    <View style={[styles.wrap, { marginTop, backgroundColor: colors.errorSoft, borderColor: colors.error }]}>
      {showIcon ? <AlertCircle size={14} color={colors.error} strokeWidth={LUCIDE_STROKE + 0.5} /> : null}
      <ThemedText style={[styles.text, { color: colors.error }]}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  text: { fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 17 },
});
