import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { shouldShowTabBar } from '@/lib/tab-bar-visibility';

const IS_WEB = Platform.OS === 'web';
const TAB_ORDER = ['index', 'explore', 'cart', 'favorites', 'profile'] as const;

function triggerTabHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function TabItem({
  isFocused,
  Icon,
  title,
  colors,
  cartCount,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  Icon?: (props: { focused: boolean; color: string; size: number; strokeWidth?: number }) => React.ReactNode;
  title: string;
  colors: ReturnType<typeof useAppColors>;
  cartCount: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const dotScale = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    dotScale.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [isFocused, dotScale]);

  const dotAnim = useAnimatedStyle(() => ({
    transform: [{ scaleX: dotScale.value }],
    opacity: dotScale.value,
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
      <View style={styles.iconArea}>
        {Icon ? (
          <Icon
            focused={isFocused}
            color={isFocused ? colors.primary : colors.tabInactive}
            size={22}
            strokeWidth={isFocused ? 2.5 : LUCIDE_STROKE}
          />
        ) : null}
        {title === 'Panier' && cartCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : String(cartCount)}</Text>
          </View>
        ) : null}
      </View>
      {/* Small green dot indicator under active icon */}
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dotAnim]} />
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

/**
 * Wrapper component qui utilise Animated.View (natif) ou View simple (web)
 * pour éviter les problèmes de position:absolute + reanimated sur mobile web.
 */
function AnimatedOrPlainView({ style, pointerEvents, children }: {
  style?: any;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-none' | undefined;
  children: React.ReactNode;
}) {
  // Sur web : View simple avec zIndex garanti (pas de reanimated pour le root)
  if (IS_WEB) {
    return <View style={style} pointerEvents={pointerEvents}>{children}</View>;
  }
  // Sur natif : Animated.View avec animation slide-up
  return <Animated.View style={style} pointerEvents={pointerEvents}>{children}</Animated.View>;
}

export function GolivraTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  const visible = shouldShowTabBar(state);
  const visibility = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible, visibility]);

  const barAnimStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: (1 - visibility.value) * 80 }],
  }));

  // Sur web, on masque complètement le tab bar quand il n'est pas visible
  // (pas d'animation reanimated sur le root pour éviter les bugs mobile web).
  if (IS_WEB && !visible) return null;

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;

  // Sur web : style simple sans animation. Sur natif : animation slide-up.
  const rootStyle: any[] = IS_WEB
    ? [styles.root, styles.rootWeb]
    : [styles.root, barAnimStyle];

  return (
    <AnimatedOrPlainView style={rootStyle} pointerEvents={visible ? 'auto' : 'none'}>
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

          return (
            <TabItem
              key={route.key}
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
      </View>
    </AnimatedOrPlainView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  rootWeb: {
    // Sur web, z-index élevé pour passer au-dessus du contenu
    // même avec overflow:hidden sur le conteneur parent.
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  iconArea: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
  label: { fontSize: 10, letterSpacing: -0.2, fontWeight: '500', marginTop: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});
