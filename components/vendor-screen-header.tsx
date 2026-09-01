import * as Haptics from 'expo-haptics';
import { useRouter } from '@/hooks/use-safe-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
};

export function VendorScreenHeader({ title, subtitle, right, onBack }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useVendorTheme();
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: Math.max(insets.top, 10) + 12,
          paddingBottom: 14,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}>
      <Pressable
        style={[styles.backBtn, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          (onBack ?? (() => router.back()))();
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Retour">
        <ChevronLeft size={26} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
      </Pressable>
      <View style={styles.titleWrap}>
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.rightSlot}>{right ?? <View style={styles.backSpacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backSpacer: {
    width: 44,
    height: 44,
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rightSlot: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
