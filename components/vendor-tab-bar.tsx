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
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendor } from '@/contexts/vendor-context';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

/**
 * Barre de navigation vendeur — style pro 2026 :
 * - Pill vert derrière l'onglet actif
 * - Icône active blanche sur fond vert
 * - Icônes grises inactives
 * - Badge rouge commandes + notifs
 * - Fixe en bas, bordure fine supérieure
 */
const TAB_ORDER = ['index', 'orders', 'products', 'deliveries', 'more'] as const;
const TAB_COUNT = TAB_ORDER.length;

function triggerTabHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function TabItem({
  route,
  isFocused,
  Icon,
  title,
  colors,
  badge,
  tabWidth,
  onPress,
  onLongPress,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  Icon?: (props: { focused: boolean; color: string; size: number; strokeWidth?: number }) => React.ReactNode;
  title: string;
  colors: ReturnType<typeof useAppColors>;
  badge?: number;
  tabWidth: number;
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

  // Badge animation
  const badgeScale = useSharedValue(0);
  React.useEffect(() => {
    if (badge && badge > 0) {
      badgeScale.value = 0;
      badgeScale.value = withSpring(1, { damping: 11, stiffness: 340, mass: 0.4 });
    }
  }, [badge, badgeScale]);
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
      style={[styles.tab, { width: tabWidth }]}
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
      {badge != null && badge > 0 ? (
        <Animated.View style={[styles.badge, { borderColor: colors.surface }, badgeAnim]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </Animated.View>
      ) : null}
    </PlatformPressable>
  );
}

export function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const { orders, unreadNotifCount } = useVendor();

  const visible = shouldShowTabBar(state);
  const visibility = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, visibility]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 90 }],
  }));

  const pendingCount = React.useMemo(
    () => orders.filter((o) => o.statut === 'en_attente').length,
    [orders],
  );

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;
  const focusedIndex = orderedRoutes.findIndex((r) => r.name === focusedRouteName);

  // Tab width is flexible (1 / TAB_COUNT of the bar)
  const tabWidth = 100 / TAB_COUNT;

  // Animated pill X position based on percentage
  const tabX = useSharedValue(focusedIndex >= 0 ? focusedIndex * tabWidth : 0);

  const pillStyle = useAnimatedStyle(() => ({
    left: `${tabX.value}%`,
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
        <Animated.View
          style={[styles.pill, { backgroundColor: colors.primary }, pillStyle]}
        />

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

            // Move pill to pressed tab
            tabX.value = withSpring(i * tabWidth, {
              damping: 18,
              stiffness: 220,
              mass: 0.7,
            });
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const badge =
            route.name === 'orders'
              ? pendingCount
              : route.name === 'more'
                ? unreadNotifCount
                : undefined;

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              Icon={Icon}
              title={title}
              colors={colors}
              badge={badge}
              tabWidth={`${tabWidth}%` as unknown as number}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  pill: {
    position: 'absolute',
    top: 4,
    height: 36,
    width: '18%',
    borderRadius: 18,
    zIndex: 0,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 2,
    paddingBottom: 2,
    zIndex: 1,
  },
  label: { fontSize: 10, letterSpacing: -0.2 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
