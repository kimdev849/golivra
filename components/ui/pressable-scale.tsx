import { forwardRef, useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type StyleFn = (state: PressableStateCallbackType) => StyleProp<ViewStyle>;

type Props = PressableProps & {
  /** Facteur d'échelle pendant l'appui (0.96 = léger enfoncement premium). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | StyleFn;
};

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/** Propriétés de layout portées par le conteneur animé (dimensions, flex, marges…). */
const LAYOUT_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'aspectRatio',
]);

/**
 * Pressable avec effet d'appui animé (scale élastique, pilote natif → aucune
 * jank). Remplace un simple changement d'opacité par un vrai ressenti tactile
 * « premium » sur les boutons et cartes clés.
 *
 * Accepte un style objet OU une fonction `({ pressed }) => style` (même API
 * que `Pressable`) : le layout part au conteneur animé, le visuel (fond, coins,
 * ombre, opacité pressed) reste sur le Pressable interne.
 */
export const PressableScale = forwardRef<typeof Pressable, Props>(
  function PressableScale({ scaleTo = 0.96, style, onPressIn, onPressOut, ...rest }, ref) {
    const scale = useSharedValue(1);

    // Sépare le style en deux : le layout vit sur le conteneur animé (le scale
    // doit s'appliquer au bloc dimensionné), le visuel reste sur le Pressable.
    const { containerStyle, visualStyle } = useMemo(() => {
      const base =
        typeof style === 'function'
          ? (style({ pressed: false, hovered: false, focused: false } as PressableStateCallbackType) as
              | ViewStyle
              | undefined)
          : style;
      const flat = StyleSheet.flatten(base) as ViewStyle | undefined;
      if (!flat) return { containerStyle: undefined, visualStyle: undefined };
      const container: ViewStyle = {};
      const visual: ViewStyle = {};
      for (const [k, v] of Object.entries(flat)) {
        if (LAYOUT_KEYS.has(k)) (container as Record<string, unknown>)[k] = v;
        else (visual as Record<string, unknown>)[k] = v;
      }
      return { containerStyle: container, visualStyle: visual };
    }, [style]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(
      (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
        scale.value = withSpring(scaleTo, SPRING);
        onPressIn?.(e);
      },
      [onPressIn, scale, scaleTo],
    );

    const handlePressOut = useCallback(
      (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      },
      [onPressOut, scale],
    );

    // Conserve le comportement de style-fonction du Pressable d'origine.
    // Pas d'opacité intégrée : les cartes gèrent déjà leur propre feedback
    // d'appui ({ pressed }) — une opacité en plus composerait (0.93 × 0.9 ≈
    // 0.84) et assombrirait trop. Le scale suffit comme feedback.
    const pressableStyle = useCallback(
      (state: PressableStateCallbackType) => [
        visualStyle,
        typeof style === 'function' ? style(state) : null,
        { flex: 1 },
      ] as StyleProp<ViewStyle>,
      [style, visualStyle],
    );

    return (
      <Animated.View style={[containerStyle, animatedStyle]}>
        <Pressable
          ref={ref as never}
          style={pressableStyle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          {...rest}
        />
      </Animated.View>
    );
  },
);
