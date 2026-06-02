import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCourierPalette } from '@/lib/courier-theme';
import { useAppColors } from '@/hooks/use-app-colors';

const TAB_ORDER = ['index', 'missions', 'profile'] as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function CourierTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8);
  const focusedName = state.routes[state.index]?.name;

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null,
  );

  const trackBg = isDark ? colors.surfaceElevated : '#FFFFFF';
  const trackBorder = isDark ? palette.border : 'rgba(13,82,55,0.08)';

  return (
    <View style={[styles.root, styles.boxPointer, { backgroundColor: palette.bg, paddingBottom: bottomPad }]}>
      <View style={styles.barArea}>
        <View
          style={[
            styles.track,
            { backgroundColor: trackBg, borderColor: trackBorder },
            Platform.OS === 'ios'
              ? { shadowColor: palette.primaryDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 }
              : styles.shadowAndroid,
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
                  onPress={() => {
                    haptic();
                    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!isFocused && !e.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  }}
                  style={styles.tab}>
                  {Icon ? Icon({ focused: isFocused, color, size: 22 }) : null}
                  <Text style={[styles.label, { color, fontWeight: isFocused ? '800' : '600' }]}>{title}</Text>
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
  root: { paddingTop: 4 },
  boxPointer: { pointerEvents: 'box-none' },
  barArea: { paddingHorizontal: 16 },
  track: {
    borderRadius: 28,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
  },
  shadowAndroid: { elevation: 6 },
  row: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 5 },
  label: { fontSize: 10 },
});
