import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendor } from '@/contexts/vendor-context';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

const TAB_ORDER = ['index', 'orders', 'products', 'deliveries', 'more'] as const;

function triggerTabHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function TabItem({
  isFocused,
  Icon,
  title,
  colors,
  badge,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  Icon?: (props: { focused: boolean; color: string; size: number; strokeWidth?: number }) => React.ReactNode;
  title: string;
  colors: ReturnType<typeof useAppColors>;
  badge?: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const bgOpacity = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    bgOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused, bgOpacity]);

  const bgAnim = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  return (
    <PlatformPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={title}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      {/* Green capsule behind icon — fades in/out */}
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: colors.primary },
          bgAnim,
        ]}
      />
      <View style={styles.iconWrap}>
        {Icon ? (
          <Icon
            focused={isFocused}
            color={isFocused ? '#FFFFFF' : colors.tabInactive}
            size={22}
            strokeWidth={isFocused ? 2.5 : LUCIDE_STROKE}
          />
        ) : null}
        {badge != null && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[
          styles.label,
          { color: isFocused ? colors.primary : colors.tabInactive },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
    </PlatformPressable>
  );
}

export function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { orders, unreadNotifCount } = useVendor();

  const visible = shouldShowTabBar(state);
  const visibility = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible, visibility]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 80 }],
  }));

  const pendingCount = React.useMemo(
    () => orders.filter((o) => o.statut === 'en_attente').length,
    [orders],
  );

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;

  return (
    <Animated.View style={[styles.root, barAnimStyle]} pointerEvents={visible ? 'auto' : 'none'}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
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

          const badge =
            route.name === 'orders'
              ? pendingCount
              : route.name === 'more'
                ? unreadNotifCount
                : undefined;

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              Icon={Icon}
              title={title}
              colors={colors}
              badge={badge}
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
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
    paddingBottom: 4,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 0,
    width: 52,
    height: 32,
    borderRadius: 16,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, letterSpacing: -0.2, fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});
