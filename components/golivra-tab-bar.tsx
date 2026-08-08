import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { glassProps } from '@/constants/ui-styles';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

/**
 * Barre de navigation pleine largeur ancrée en bas : onglet actif en cercle
 * pleine couleur avec ressort (spring), micro-interactions à l'appui,
 * badge panier, et séparée du contenu par une fine bordure supérieure.
 */
const TAB_ORDER = ['index', 'explore', 'cart', 'favorites', 'profile'] as const;

function triggerTabHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function TabItem({
  route,
  isFocused,
  Icon,
  title,
  colors,
  cartCount,
  onPress,
  onLongPress,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  Icon?: (props: {
    focused: boolean;
    color: string;
    size: number;
    strokeWidth?: number;
  }) => React.ReactNode;
  title: string;
  colors: ReturnType<typeof useAppColors>;
  cartCount: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const active = useSharedValue(isFocused ? 1 : 0);
  const pressed = useSharedValue(0);

  React.useEffect(() => {
    active.value = withSpring(isFocused ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
  }, [isFocused, active]);

  const circleAnim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      active.value,
      [0, 1],
      [colors.surfaceElevated, colors.primary],
    ),
    transform: [
      {
        scale:
          (0.86 + 0.14 * active.value) *
          (1 - 0.05 * pressed.value),
      },
    ],
  }));

  const isCart = route.name === 'cart';
  const contentColor = isFocused ? colors.onPrimary : colors.tabInactive;
  const labelColor = isFocused ? colors.primary : colors.tabInactive;

  // Le badge panier « pop » avec un ressort à chaque changement de quantité,
  // pour bien mettre le panier en avant dès qu'il contient quelque chose.
  const badgeScale = useSharedValue(0);
  React.useEffect(() => {
    if (cartCount > 0) {
      badgeScale.value = 0;
      badgeScale.value = withSpring(1, { damping: 11, stiffness: 340, mass: 0.4 });
    }
  }, [cartCount, badgeScale]);
  const badgeAnim = useAnimatedStyle(() => ({
    opacity: badgeScale.value,
    transform: [{ scale: 0.5 + 0.5 * badgeScale.value }],
  }));

  return (
    <PlatformPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={styles.tab}
      hitSlop={{ top: 6, bottom: 10, left: 4, right: 4 }}>
      <Animated.View style={[styles.iconWrap, circleAnim]}>
        {Icon ? (
          <Icon
            focused={isFocused}
            color={contentColor}
            size={21}
            strokeWidth={isFocused ? 2.4 : LUCIDE_STROKE}
          />
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.label,
          { color: labelColor, fontWeight: isFocused ? '500' : '400' },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
      {isCart && cartCount > 0 ? (
        <Animated.View
          style={[styles.cartBadge, { borderColor: colors.surfaceElevated }, badgeAnim]}>
          <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
        </Animated.View>
      ) : null}
    </PlatformPressable>
  );
}

export function GolivraTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const colors = useAppColors();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  const visible = shouldShowTabBar(state);
  const visibility = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, visibility]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 90 }],
  }));

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;

  return (
    <Animated.View style={[styles.root, barAnimStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Verre dépoli : le contenu qui passe sous la barre est flouté. */}
      <BlurView
        {...glassProps(isDark)}
        style={[
          styles.bar,
          {
            borderTopColor: colors.borderStrong,
            paddingBottom: bottomPad,
          },
        ]}>
        {orderedRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = focusedRouteName === route.name;
          const title =
            typeof options.title === 'string'
              ? options.title
              : typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : route.name;
          const Icon = options.tabBarIcon;

          const onPress = () => {
            triggerTabHaptic();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (event.defaultPrevented) return;
            if (!isFocused) navigation.navigate(route.name as never);
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              Icon={Icon}
              title={title}
              colors={colors}
              cartCount={itemCount}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Barre pleine largeur ancrée en bas — pas de pastille flottante,
  // pas d'espace à gauche/droite. Séparée du contenu par une fine bordure.
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, letterSpacing: -0.2, textTransform: 'lowercase' },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 11,
  },
});
