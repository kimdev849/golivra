import { CheckCircle2, Info, XCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useToastStore, type ToastVariant } from '@/lib/app-toast';

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

/**
 * Hôte du toast global NON-BLOQUANT.
 *
 * À monter UNE seule fois en haut de l'arbre (app/_layout.tsx), en dessous
 * de la navigation mais au-dessus des écrans. Il s'affiche en bas d'écran
 * au-dessus de la tab bar, sans jamais capturer les taps hors de son
 * rectangle (pointerEvents='box-none').
 *
 * Comportement : slide-up + fade-in, attente, puis slide-down + fade-out.
 * Un nouveau toast remplace le précédent (pas de pile).
 */
export function AppToastHost() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { visible, message, variant, action, duration, token, hide } = useToastStore();

  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    const d = duration ?? 1800;

    translateY.value = withSequence(
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(
        d,
        withTiming(
          80,
          { duration: 220, easing: Easing.in(Easing.cubic) },
          () => runOnJS(hide)(),
        ),
      ),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 180 }),
      withDelay(d, withTiming(0, { duration: 200 })),
    );

    return () => {
      translateY.value = 80;
      opacity.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible || !message) return null;

  const Icon = ICONS[variant ?? 'success'];
  const accent =
    variant === 'error' ? colors.error : variant === 'info' ? colors.primary : colors.success;

  // La barre de tab étant flottante et absolue (~56px + safe area), on
  // se cale au-dessus : safe area + hauteur tab bar + marge.
  const bottom = Math.max(insets.bottom, 12) + 84;

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.surface, borderColor: colors.border, bottom },
          animStyle,
        ]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.successSoft }]}>
          <Icon size={18} color={accent} strokeWidth={LUCIDE_STROKE + 0.4} />
        </View>
        <ThemedText style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {message}
        </ThemedText>
        {action ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              hide();
              action.onPress();
            }}
            style={styles.actionBtn}>
            <ThemedText style={[styles.actionLabel, { color: colors.primary }]}>
              {action.label}
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  toast: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
});
