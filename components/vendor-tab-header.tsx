import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

/** En-tête pour les onglets vendeur (sans flèche retour). */
export function VendorTabHeader({ title, subtitle, right }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useVendorTheme();
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: Math.max(insets.top, 10),
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}>
      <View style={styles.titleWrap}>
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: palette.primaryDeep }]} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWrap: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  right: { minWidth: 44, alignItems: 'flex-end' },
});
