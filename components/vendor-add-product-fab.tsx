import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { brandGradient3, GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

type Props = {
  bottom: number;
  onPress: () => void;
  accessibilityLabel?: string;
};

function triggerHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/** FAB + centré en bas de l'écran (onglet produits / menu). */
export function VendorAddProductFab({ bottom, onPress, accessibilityLabel = 'Ajouter' }: Props) {
  const colors = useAppColors();

  return (
    <View style={[styles.host, styles.boxPointer, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          triggerHaptic();
          onPress();
        }}
        style={({ pressed }) => [pressed && styles.pressPressed]}>
        <LinearGradient
          colors={brandGradient3(colors)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fab, { borderColor: colors.surface }]}>
          <Plus size={30} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const FAB_SIZE = 60;

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 18,
    zIndex: 30,
  },
  boxPointer: { pointerEvents: 'box-none' },
  pressPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 12,
  },
});
