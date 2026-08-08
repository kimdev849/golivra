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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { glassProps } from '@/constants/ui-styles';
import { useCourierPalette } from '@/lib/courier-theme';

/**
 * Barre de navigation livreur — pleine largeur ancrée en bas, dans le même
 * esprit premium que la barre client : onglet actif en bulle pleine couleur
 * avec ressort (spring), micro-interactions à l'appui et fine bordure
 * supérieure séparant la barre du contenu. Toujours visible (fixe en bas).
 */
const TAB_ORDER = ['index', 'missions', 'profile'] as const;

function triggerTabHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function TabItem({
  route,
  isFocused,
  Icon,
  title,
  colors,
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
  onPress: () => void;
  onLongPress: () => void;
}) {
  const palette = useCourierPalette();
  const active = useSharedValue(isFocused ? 1 : 0);
  const pressed = useSharedValue(0);

  React.useEffect(() => {
    active.value = withSpring(isFocused ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
  }, [isFocused, active]);

  const bubbleAnim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      active.value,
      [0, 1],
      [colors.surfaceElevated, palette.primary],
    ),
    transform: [
      {
        scale: (0.86 + 0.14 * active.value) * (1 - 0.05 * pressed.value),
      },
    ],
  }));

  const contentColor = isFocused ? colors.onPrimary : palette.tabBarInactive;
  const labelColor = isFocused ? palette.primary : palette.tabBarInactive;

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
      <Animated.View style={[styles.iconWrap, bubbleAnim]}>
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
          { color: labelColor, fontWeight: isFocused ? '700' : '500' },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
    </PlatformPressable>
  );
}

export function CourierTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useAppColors();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedRouteName = state.routes[state.index]?.name;

  return (
    <Animated.View style={styles.root}>
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
  // Barre pleine largeur ancrée en bas — fixe, pas de pastille flottante.
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
  label: { fontSize: 11, letterSpacing: -0.2 },
});
