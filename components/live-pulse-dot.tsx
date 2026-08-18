import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  color: string;
  size?: number;
  /** false → pastille statique (état terminal, ex. livrée). */
  active?: boolean;
};

/**
 * Pastille « live » : un point coloré entouré d'un halo qui pulse en continu.
 * Utilisé sur le suivi de commande / livraison pour signaler un état en cours.
 */
export function LivePulseDot({ color, size = 10, active = true }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      progress.value = 0;
    };
  }, [active, progress]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 1.7 }],
  }));

  const haloSize = size + 12;

  return (
    <View style={[styles.wrap, { width: haloSize, height: haloSize }]}>
      {active ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: color, borderRadius: haloSize / 2 },
            haloStyle,
          ]}
        />
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
