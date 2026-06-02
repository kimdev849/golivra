import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBag } from 'lucide-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brandGradient3, GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Ordre maquette : accueil, marketplace, panier au centre (FAB), commandes, compte */
const TAB_ORDER = ['index', 'marketplace', 'cart', 'explore', 'profile'] as const;

function triggerTabHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function GolivraTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { itemCount } = useCart();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 10);

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((r) => r.name === name)).filter(
    (r): r is (typeof state.routes)[number] => r != null
  );

  const leftTabs = orderedRoutes.filter((r) => r.name === 'index' || r.name === 'marketplace');
  const rightTabs = orderedRoutes.filter((r) => r.name === 'explore' || r.name === 'profile');
  const cartRoute = orderedRoutes.find((r) => r.name === 'cart');

  const focusedRouteName = state.routes[state.index]?.name;

  const trackBg = isDark ? colors.surfaceElevated : '#FFFFFF';
  const trackBorder = isDark ? colors.border : 'rgba(13,82,55,0.08)';
  const fabRingColor = isDark ? colors.backgroundAlt : '#F6FAF7';

  const renderSideTab = (route: (typeof state.routes)[number]) => {
    const { options } = descriptors[route.key];
    const isFocused = focusedRouteName === route.name;
    const title =
      typeof options.title === 'string'
        ? options.title
        : typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : route.name;
    const color = isFocused ? colors.accent : colors.tabInactive;
    const Icon = options.tabBarIcon;

    const onPress = () => {
      triggerTabHaptic();
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (event.defaultPrevented) return;

      if (route.name === 'marketplace') {
        navigation.navigate('(tabs)', { screen: 'marketplace' });
        return;
      }

      if (!isFocused) {
        navigation.navigate(route.name as never);
      }
    };

    return (
      <PlatformPressable
        key={route.key}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={typeof title === 'string' ? title : route.name}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        style={styles.sideTap}
        hitSlop={{ top: 8, bottom: 12, left: 6, right: 6 }}>
        {Icon ? <Icon focused={isFocused} color={color} size={24} /> : null}
        <Text style={[styles.sideLabel, { color }]} numberOfLines={1}>
          {typeof title === 'string' ? title : route.name}
        </Text>
      </PlatformPressable>
    );
  };

  const cartFocused = cartRoute ? focusedRouteName === cartRoute.name : false;

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
    <View style={[styles.root, styles.rootPointer, { paddingBottom: bottomPad }]}>
      <View style={[styles.barArea, styles.boxPointer]}>
        <View style={styles.track}>
          <View
            style={[
              styles.trackInner,
              { backgroundColor: trackBg, borderColor: trackBorder },
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
              testID={cartRoute ? descriptors[cartRoute.key].options.tabBarButtonTestID : undefined}
              onPress={onCartPress}
              onLongPress={() => {
                if (!cartRoute) return;
                navigation.emit({ type: 'tabLongPress', target: cartRoute.key });
              }}
              style={styles.fabPress}
              hitSlop={{ top: 16, bottom: 8, left: 16, right: 16 }}>
              <LinearGradient
                colors={brandGradient3(colors)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.fab,
                  cartFocused ? styles.fabFocused : styles.fabIdle,
                  { borderColor: fabRingColor },
                ]}>
                <ShoppingBag size={26} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 4,
    overflow: 'visible',
    position: 'relative',
  },
  rootPointer: { pointerEvents: 'box-none' },
  boxPointer: { pointerEvents: 'box-none' },
  barArea: {
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'visible',
  },
  track: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'flex-end',
  },
  trackInner: {
    width: '100%',
    borderRadius: 34,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
  },
  trackShadowIos: {
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
  },
  trackShadowAndroid: {
    elevation: 8,
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sideCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  cartGap: { width: 72 },
  sideTap: {
    flex: 1,
    maxWidth: '50%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  sideLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.1,
  },
  fabSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  fabPress: { borderRadius: 34 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  fabIdle: {
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
    transform: [{ scale: 1 }],
  },
  fabFocused: {
    shadowColor: GOLIVRA_BRAND_SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 20,
    transform: [{ scale: 1.06 }],
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
});
