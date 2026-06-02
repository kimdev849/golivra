import { AlertCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';

type Props = {
  message?: string | null;
  colors: AppPalette;
  showIcon?: boolean;
  marginTop?: number;
};

export function InlineFormError({ message, colors, showIcon = true, marginTop = 4 }: Props) {
  if (!message) return null;
  return (
    <View style={[styles.row, { marginTop }]}>
      {showIcon ? <AlertCircle size={14} color={colors.error} strokeWidth={LUCIDE_STROKE} /> : null}
      <ThemedText style={[styles.text, { color: colors.error }]}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
});
