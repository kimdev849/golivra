import { useRouter, usePathname } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Bell,
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

const NAVBAR_HEIGHT = 64;

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
      {/* Logo */}
      <Pressable
        style={styles.logoWrap}
        onPress={() => router.push('/(tabs)')}
        hitSlop={8}>
        <Text style={[styles.logoText, { color: colors.primary }]}>Go</Text>
        <Text style={[styles.logoLivra, { color: colors.text }]}>Livra</Text>
      </Pressable>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Search size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un plat, un produit, un restaurant…"
          placeholderTextColor={colors.placeholder}
          value={currentSearch}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearchSubmit}
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
                size={16}
                color={active ? colors.primary : colors.textMuted}
                strokeWidth={active ? 2.4 : LUCIDE_STROKE}
              />
              <Text
                style={[
                  styles.navLinkText,
                  { color: active ? colors.primary : colors.textMuted },
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
              size={16}
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
            ]}>
            Panier
          </Text>
        </Pressable>
      </View>

      {/* Profil */}
      <Pressable
        style={({ pressed }) => [
          styles.profileBtn,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => router.navigate('/(tabs)/profile')}
        hitSlop={8}>
        <UserRound size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  navbar: {
    height: NAVBAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoLivra: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  searchBar: {
    flex: 1,
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  navLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
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
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 4,
  },
});
