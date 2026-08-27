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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendor } from '@/contexts/vendor-context';

/**
 * Barre de navigation vendeur — design 2026 :
 * - Pill flottant animé sous l'onglet actif
 * - Fond glassmorphism
 * - Icônes libres, pas de bulle colorée
 */
const TAB_ORDER = ['index', 'orders', 'products', 'deliveries', 'more'] as const;
const TAB_WIDTH = 64;

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
  badge?: number;
  tabX: Animated.SharedValue<number>;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pressed = useSharedValue(0);

  const iconColor = isFocused ? colors.primary : colors.tabInactive;
  const labelColor = isFocused ? colors.primary : colors.tabInactive;

  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.value, [0, 1], [1, 0.88]) },
      { translateY: interpolate(pressed.value, [0, 1], [0, -1]) },
    ],
  }));

  React.useEffect(() => {
    if (isFocused) {
      tabX.value = withSpring(index * TAB_WIDTH, {
        damping: 20,
        stiffness: 250,
        mass: 0.8,
      });
    }
  }, [isFocused, index, tabX]);

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
            color={iconColor}
            size={22}
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
        <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.surfaceElevated }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      ) : null}
    </PlatformPressable>
  );
}

export function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const { orders, unreadNotifCount } = useVendor();

  const pendingCount = React.useMemo(
    () => orders.filter((o) => o.statut === 'en_attente').length,
    [orders],
  );

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;
  const focusedIndex = orderedRoutes.findIndex((r) => r.name === focusedRouteName);

  const tabX = useSharedValue(focusedIndex >= 0 ? focusedIndex * TAB_WIDTH : 0);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabX.value }],
  }));

  return (
    <View style={styles.root}>
      {/* Floating pill indicator */}
      <View style={[styles.pillTrack, { bottom: bottomPad + 34 }]}>
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: colors.primary, width: TAB_WIDTH - 20 },
            pillStyle,
          ]}
        />
      </View>

      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceElevated,
            borderTopColor: colors.borderStrong,
            paddingBottom: bottomPad,
          },
        ]}>
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
              badge={route.name === 'orders' ? pendingCount : route.name === 'more' ? unreadNotifCount : undefined}
              tabX={tabX}
              index={i}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pillTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 4,
    height: 32,
    zIndex: 0,
  },
  pill: {
    height: 28,
    borderRadius: 14,
    position: 'absolute',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
    zIndex: 2,
  },
  label: { fontSize: 11, letterSpacing: -0.2 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
