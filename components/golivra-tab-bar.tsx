import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

/**
 * Barre de navigation client — style pro, simple et épuré :
 * - Icônes grises en arc, pill vert derrière l'onglet actif
 * - L'icône active est blanche sur fond vert arrondi
 * - Badge panier rouge
 * - Légende sous l'icône
 * - Fixe en bas, bordure fine supérieure
 */
const TAB_ORDER = ['index', 'explore', 'cart', 'favorites', 'profile'] as const;
const ICON_SIZE = 44; // taille du conteneur d'icône (pill vert inclus)
const PILL_SIZE = 40; // taille du pill vert

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
  tabX,
  index,
  onPress,
  onLongPress,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  Icon?: (props: { focused: boolean; color: string; size: number; strokeWidth?: number }) => React.ReactNode;
  title: string;
  colors: ReturnType<typeof useAppColors>;
  cartCount: number;
  tabX: Animated.SharedValue<number>;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pressed = useSharedValue(0);

  const labelColor = isFocused ? colors.primary : colors.tabInactive;

  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, 0.85]) },
    ],
  }));

  // Move pill to active tab
  React.useEffect(() => {
    if (isFocused) {
      tabX.value = withSpring(index * ICON_SIZE, {
        damping: 18,
        stiffness: 220,
        mass: 0.7,
      });
    }
  }, [isFocused, index, tabX]);

  const isCart = route.name === 'cart';

  // Badge animation
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
      onPressIn={() => { pressed.value = 1; }}
      onPressOut={() => { pressed.value = 0; }}
      style={styles.tab}
      hitSlop={{ top: 6, bottom: 10, left: 4, right: 4 }}>
      <Animated.View style={iconAnim}>
        {Icon ? (
          <Icon
            focused={isFocused}
            color={isFocused ? '#FFFFFF' : colors.tabInactive}
            size={21}
            strokeWidth={isFocused ? 2.4 : LUCIDE_STROKE}
          />
        ) : null}
      </Animated.View>
      <Text
        style={[styles.label, { color: labelColor, fontWeight: isFocused ? '700' : '500' }]}
        numberOfLines={1}>
        {title}
      </Text>
      {isCart && cartCount > 0 ? (
        <Animated.View style={[styles.cartBadge, { borderColor: colors.surface }, badgeAnim]}>
          <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
        </Animated.View>
      ) : null}
    </PlatformPressable>
  );
}

export function GolivraTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const colors = useAppColors();
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
  const focusedIndex = orderedRoutes.findIndex((r) => r.name === focusedRouteName);

  // Animated pill X position
  const tabX = useSharedValue(focusedIndex >= 0 ? focusedIndex * ICON_SIZE : 0);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabX.value }],
  }));

  return (
    <Animated.View style={[styles.root, barAnimStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderStrong,
            paddingBottom: bottomPad,
          },
        ]}>
        {/* Animated green pill */}
        <View style={[styles.pillTrack, { paddingBottom: bottomPad }]}>
          <Animated.View
            style={[styles.pill, { backgroundColor: colors.primary }, pillStyle]}
          />
        </View>

        {orderedRoutes.map((route, i) => {
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
              tabX={tabX}
              index={i}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  pillTrack: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: 20,
    position: 'absolute',
    left: (ICON_SIZE - PILL_SIZE) / 2,
  },
  tab: {
    width: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
    paddingBottom: 2,
  },
  label: { fontSize: 10, letterSpacing: -0.2 },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
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
