import { useRouter, usePathname } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ClipboardList,
  Heart,
  Home,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react-native';

import { useCart } from '@/contexts/cart-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { LUCIDE_STROKE } from '@/constants/icons';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';

const NAVBAR_HEIGHT = 60;

export { NAVBAR_HEIGHT };

const NAV_LINKS = [
  { key: 'index', label: 'Accueil', Icon: Home, href: '/(tabs)' as const },
  { key: 'explore', label: 'Commandes', Icon: ClipboardList, href: '/(tabs)/explore' as const },
  { key: 'favorites', label: 'Favoris', Icon: Heart, href: '/(tabs)/favorites' as const },
] as const;

export const WebNavbar = memo(function WebNavbar({
  onSearch,
  searchValue,
  onSearchChange,
  onSearchClear,
}: {
  onSearch?: (query: string) => void;
  searchValue?: string;
  onSearchChange?: (text: string) => void;
  onSearchClear?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useAppColors();
  const { itemCount } = useCart();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const currentSearch = searchValue ?? search;
  const handleSearchChange = onSearchChange ?? setSearch;

  const handleSearchSubmit = useCallback(() => {
    const q = (searchValue ?? search).trim();
    if (q.length >= 2 && onSearch) {
      onSearch(q);
    }
  }, [search, searchValue, onSearch]);

  const handleClearSearch = useCallback(() => {
    onSearchClear?.();
    if (!searchValue) setSearch('');
    onSearchChange?.('');
  }, [onSearchClear, onSearchChange, searchValue]);

  const isActive = useCallback(
    (key: string) => {
      if (key === 'index') return pathname === '/(tabs)' || pathname === '/(tabs)/';
      return pathname.startsWith(`/(tabs)/${key}`);
    },
    [pathname],
  );

  return (
    <View style={[styles.navbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.navbarInner}>
        {/* Logo */}
        <Pressable
          style={styles.logoWrap}
          onPress={() => router.navigate('/(tabs)')}
          hitSlop={8}>
          <Text style={[styles.logoGo, { color: colors.primary }]}>Go</Text>
          <Text style={[styles.logoLivra, { color: colors.text }]}>Livra</Text>
        </Pressable>

        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: searchFocused ? colors.surface : colors.surfaceMuted,
              borderColor: searchFocused ? colors.primary : colors.border,
            },
          ]}>
          <Search size={15} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher un plat, un restaurant…"
            placeholderTextColor={colors.placeholder}
            value={currentSearch}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {currentSearch.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <X size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ) : null}
        </View>

        {/* Nav links */}
        <View style={styles.navLinks}>
          {NAV_LINKS.map(({ key, label, Icon, href }) => {
            const active = isActive(key);
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [
                  styles.navLink,
                  active && { backgroundColor: colors.primarySoft },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.navigate(href)}>
                <Icon
                  size={15}
                  color={active ? colors.primary : colors.textMuted}
                  strokeWidth={active ? 2.4 : LUCIDE_STROKE}
                />
                <Text
                  style={[
                    styles.navLinkText,
                    { color: active ? colors.primary : colors.textMuted },
                    active && { fontWeight: '700' },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}

          {/* Panier */}
          <Pressable
            style={({ pressed }) => [
              styles.navLink,
              isActive('cart') && { backgroundColor: colors.primarySoft },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.navigate('/(tabs)/cart')}>
            <View>
              <ShoppingBag
                size={15}
                color={isActive('cart') ? colors.primary : colors.textMuted}
                strokeWidth={isActive('cart') ? 2.4 : LUCIDE_STROKE}
              />
              {itemCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {itemCount > 99 ? '99+' : String(itemCount)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.navLinkText,
                { color: isActive('cart') ? colors.primary : colors.textMuted },
                isActive('cart') && { fontWeight: '700' },
              ]}>
              Panier
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Profil */}
        <Pressable
          style={({ pressed }) => [
            styles.profileBtn,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.navigate('/(tabs)/profile')}
          hitSlop={8}>
          <UserRound size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  navbar: {
    height: NAVBAR_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
  navbarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: DESKTOP_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: DESKTOP_PADDING,
    gap: 16,
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  logoGo: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoLivra: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  searchBar: {
    flex: 1,
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  navLinkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 24,
    opacity: 0.4,
  },
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
