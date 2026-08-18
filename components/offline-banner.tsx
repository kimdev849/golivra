import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useIsOffline } from '@/hooks/use-network-status';

type Props = {
  /** Décalage sous la barre de statut (0 = auto safe area). */
  topInset?: number;
};

/** Bandeau discret quand le réseau est indisponible. */
export function OfflineBanner({ topInset }: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

  if (!offline) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          top: topInset ?? insets.top,
          backgroundColor: colors.warningSoft,
          borderColor: colors.border,
        },
      ]}>
      <WifiOff size={14} color={colors.warning} strokeWidth={LUCIDE_STROKE} />
      <ThemedText style={[styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
        Connexion indisponible
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
