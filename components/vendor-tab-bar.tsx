import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVendorTheme } from '@/hooks/use-vendor-theme';

const TAB_ORDER = ['index', 'orders', 'deliveries', 'products', 'more'] as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8);
  const { palette } = useVendorTheme();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const focusedName = state.routes[state.index]?.name;
  const trackBg = isDark ? colors.surfaceElevated : colors.surface;
  const trackBorder = isDark ? colors.border : 'rgba(13,82,55,0.08)';

  return (
    <View style={[styles.root, styles.boxPointer, { paddingBottom: bottomPad }]}>
      <View style={[styles.barArea, styles.boxPointer]}>
        <View
          style={[
            styles.track,
            Platform.OS === 'ios' ? styles.trackShadowIos : styles.trackShadowAndroid,
            {
              backgroundColor: trackBg,
              borderColor: trackBorder,
              shadowColor: palette.primaryDeep,
            },
          ]}>
          <View style={styles.row}>
            {orderedRoutes.map((route) => {
              const { options } = descriptors[route.key];
              const isFocused = focusedName === route.name;
              const title =
                typeof options.title === 'string'
                  ? options.title
                  : typeof options.tabBarLabel === 'string'
                    ? options.tabBarLabel
                    : route.name;
              const color = isFocused ? palette.primary : palette.tabBarInactive;
              const Icon = options.tabBarIcon;

              return (
                <PlatformPressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={typeof title === 'string' ? title : route.name}
                  onPress={() => {
                    haptic();
                    const e = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!isFocused && !e.defaultPrevented) {
                      navigation.navigate(route.name as never);
                    }
                  }}
                  style={styles.tab}
                  hitSlop={{ top: 6, bottom: 8, left: 4, right: 4 }}>
                  {Icon ? <Icon focused={isFocused} color={color} size={22} /> : null}
                  <Text
                    style={[styles.label, { color, fontWeight: isFocused ? '800' : '600' }]}
                    numberOfLines={1}>
                    {typeof title === 'string' ? title : route.name}
                  </Text>
                </PlatformPressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 4,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  boxPointer: { pointerEvents: 'box-none' },
  barArea: {
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  track: {
    width: '100%',
    borderRadius: 28,
    minHeight: 58,
    justifyContent: 'center',
    borderWidth: 1,
  },
  trackShadowIos: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  trackShadowAndroid: {
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    letterSpacing: -0.15,
  },
});
