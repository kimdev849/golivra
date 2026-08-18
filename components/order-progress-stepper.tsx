import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Check, type LucideIcon } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';

export type OrderStep = {
  key: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  steps: OrderStep[];
  /** Nombre d'étapes entièrement terminées. */
  done: number;
  /** Index de l'étape en cours (-1 si aucune). */
  active: number;
  colors: {
    primary: string;
    primarySoft: string;
    success: string;
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
  };
};

/** Segment de liaison entre deux étapes, avec remplissage animé si actif. */
function Segment({ filled, active, color, trackColor }: { filled: boolean; active: boolean; color: string; trackColor: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = filled ? 1 : 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      progress.value = filled ? 1 : 0;
    };
  }, [active, filled, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progress.value * 100)}%`,
  }));

  return (
    <View style={[styles.segment, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: color }, fillStyle]} />
    </View>
  );
}

/**
 * Stepper de progression façon app de livraison : icônes + ligne animée.
 * Chaque étape est un cercle (terminée ✓ / en cours / à venir) relié par des
 * segments qui se remplissent progressivement pendant l'étape active.
 */
export function OrderProgressStepper({ steps, done, active, colors }: Props) {
  return (
    <View style={styles.wrap}>
      {steps.map((step, i) => {
        const isDone = i < done;
        const isActive = i === active;
        const Icon = step.icon;
        const isLast = i === steps.length - 1;

        return (
          <Animated.View key={step.key} style={styles.item} entering={FadeInDown.delay(i * 90).duration(300)}>
            <View style={styles.track}>
              {i > 0 ? (
                <Segment
                  filled={isDone || i <= done}
                  active={i === active + 1}
                  color={colors.success}
                  trackColor={colors.surfaceMuted}
                />
              ) : null}
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isDone
                      ? colors.success
                      : isActive
                        ? colors.primary
                        : colors.surfaceMuted,
                    borderColor: isDone || isActive ? 'transparent' : colors.border,
                  },
                ]}>
                {isDone ? (
                  <Check size={15} color="#FFFFFF" strokeWidth={3.2} />
                ) : (
                  <Icon
                    size={15}
                    color={isActive ? '#FFFFFF' : colors.textMuted}
                    strokeWidth={LUCIDE_STROKE + 0.4}
                  />
                )}
              </View>
              {!isLast ? (
                <Segment
                  filled={i + 1 < done}
                  active={isActive}
                  color={colors.success}
                  trackColor={colors.surfaceMuted}
                />
              ) : null}
            </View>
            <ThemedText
              numberOfLines={2}
              style={[
                styles.label,
                { color: isDone || isActive ? colors.text : colors.textMuted },
              ]}>
              {step.label}
            </ThemedText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  item: { flex: 1, alignItems: 'center' },
  track: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  segment: { height: 4, flex: 1, borderRadius: 2, overflow: 'hidden', marginHorizontal: -2 },
  segmentFill: { height: '100%', borderRadius: 2 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: { fontSize: 11, fontWeight: '700', marginTop: 8, textAlign: 'center', paddingHorizontal: 4, lineHeight: 14 },
});
