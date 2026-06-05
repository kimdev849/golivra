import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBag } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brandGradient3, GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

const TAB_ORDER = ['index', 'explore', 'marketplace', 'profile'] as const;

function triggerTabHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function SideTab({
  isFocused,
  color,
  inactiveColor,
  Icon,
  title,
  onPress,
}: {
  isFocused: boolean;
  color: string;
  inactiveColor: string;
  Icon: React.ComponentType<{ focused: boolean; color: string; size: number; strokeWidth?: number }> | undefined;
  title: string;
  onPress: () => void;
}) {
  const labelColor = isFocused ? color : inactiveColor;

  return (
    <PlatformPressable
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.sideTap}
      hitSlop={{ top: 8, bottom: 12, left: 6, right: 6 }}>
      <View style={styles.iconWrap}>
        {Icon ? (
          <Icon focused={isFocused} color={labelColor} size={23} strokeWidth={LUCIDE_STROKE} />
        ) : null}
      </View>
      <Text style={[styles.sideLabel, { color: labelColor, fontWeight: isFocused ? '800' : '600' }]} numberOfLines={1}>
        {title}
      </Text>
    </PlatformPressable>
  );
}

export function GolivraTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8);

  const visible = shouldShowTabBar(state);
  const visibility = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 280 });
  }, [visible, visibility]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 100 }],
  }));

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const leftTabs = orderedRoutes.filter((r) => r.name === 'index' || r.name === 'explore');
  const rightTabs = orderedRoutes.filter((r) => r.name === 'marketplace' || r.name === 'profile');
  const cartRoute = state.routes.find((r) => r.name === 'cart');
  const focusedRouteName = state.routes[state.index]?.name;
  const cartFocused = cartRoute ? focusedRouteName === cartRoute.name : false;

  const trackBg = colors.tabBarBg;
  const trackBorder = colors.tabBarBorder;
  const fabRingColor = isDark ? colors.backgroundAlt : colors.background;

  const renderSideTab = (route: (typeof state.routes)[number]) => {
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

    return (
      <SideTab
        key={route.key}
        isFocused={isFocused}
        color={colors.primary}
        inactiveColor={colors.tabInactive}
        Icon={Icon}
        title={title}
        onPress={onPress}
      />
    );
  };

  const onCartPress = () => {
    if (!cartRoute) return;
    triggerTabHaptic();
    const event = navigation.emit({
      type: 'tabPress',
      target: cartRoute.key,
      canPreventDefault: true,
    });
    if (!cartFocused && !event.defaultPrevented) {
      navigation.navigate('cart' as never);
    }
  };

  return (
    <Animated.View
      style={[styles.root, styles.rootPointer, barAnimStyle, { paddingBottom: bottomPad }]}
      pointerEvents={visible ? 'auto' : 'none'}>
      <View style={[styles.barArea, styles.boxPointer]}>
        <View style={styles.track}>
          <View
            style={[
              styles.trackInner,
              {
                backgroundColor: trackBg,
                borderColor: trackBorder,
                shadowColor: isDark ? '#000000' : colors.primaryDeep,
              },
              Platform.OS === 'ios' ? styles.trackShadowIos : styles.trackShadowAndroid,
            ]}>
            <View style={styles.row}>
              <View style={styles.sideCluster}>{leftTabs.map(renderSideTab)}</View>
              <View style={styles.cartGap} />
              <View style={styles.sideCluster}>{rightTabs.map(renderSideTab)}</View>
            </View>
          </View>

          <View style={[styles.fabSlot, styles.boxPointer]}>
            <PlatformPressable
              accessibilityRole="button"
              accessibilityLabel="Panier"
              accessibilityState={{ selected: cartFocused }}
              onPress={onCartPress}
              onLongPress={() => {
                if (!cartRoute) return;
                navigation.emit({ type: 'tabLongPress', target: cartRoute.key });
              }}
              style={styles.fabPress}
              hitSlop={{ top: 16, bottom: 8, left: 16, right: 16 }}>
              <View style={[styles.fabGlow, cartFocused && styles.fabGlowActive]} />
              <LinearGradient
                colors={brandGradient3(colors)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.fab,
                  cartFocused ? styles.fabFocused : styles.fabIdle,
                  { borderColor: fabRingColor },
                ]}>
                <ShoppingBag size={24} color={colors.onPrimary} strokeWidth={2.2} />
                {itemCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{itemCount > 99 ? '99+' : String(itemCount)}</Text>
                  </View>
                ) : null}
              </LinearGradient>
            </PlatformPressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 6, overflow: 'visible', position: 'relative' },
  rootPointer: { pointerEvents: 'box-none' },
  boxPointer: { pointerEvents: 'box-none' },
  barArea: { paddingHorizontal: 16, alignItems: 'center', overflow: 'visible' },
  track: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'flex-end',
  },
  trackInner: {
    width: '100%',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    justifyContent: 'center',
  },
  trackShadowIos: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  trackShadowAndroid: {
    elevation: 8,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  sideCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  cartGap: { width: 76 },
  sideTap: {
    flex: 1,
    maxWidth: '50%',
    alignItems: 'center',
    gap: 0,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sideLabel: { fontSize: 10, marginTop: 1, letterSpacing: -0.2 },
  fabSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fabPress: { borderRadius: 36 },
  fabGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(11, 107, 69, 0.0)',
  },
  fabGlowActive: { backgroundColor: 'rgba(11, 107, 69, 0.08)' },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
  },
  fabIdle: {
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 16,
  },
  fabFocused: {
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 20,
    transform: [{ scale: 1.05 }],
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#E53935',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
