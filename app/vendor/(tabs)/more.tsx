import { useRouter } from 'expo-router';
import {
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  HelpCircle,
  MapPin,
  Package,
  Settings,
  Truck,
  User,
  Wallet,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogoutButton } from '@/components/app-logout-button';
import { VendorTabHeader } from '@/components/vendor-tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { VENDOR_TAB_BAR_PADDING_BOTTOM } from '@/constants/vendor-layout';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { VENDOR_HREF } from '@/lib/vendor-nav';
import { useVendor } from '@/contexts/vendor-context';

export default function VendorMoreTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const colorScheme = useColorScheme();
  const { shop } = useVendor();
  const { palette, labels, commerceType } = useVendorTheme();
  const isOnline = shop?.enLigne === true;
  const bottom = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  const row = (
    icon: ReactNode,
    title: string,
    subtitle: string,
    onPress: () => void,
    danger?: boolean
  ) => (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.primarySoft }]}
      onPress={onPress}>
      <View
        style={[
          styles.menuIcon,
          {
            backgroundColor: danger ? colors.errorSoft : colors.primarySoft,
            borderColor: danger ? colors.border : colors.borderStrong,
          },
        ]}>
        {icon}
      </View>
      <View style={styles.menuText}>
        <ThemedText
          type="defaultSemiBold"
          style={[styles.menuTitle, { color: danger ? colors.error : colors.text }, danger && styles.menuTitleDanger]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.menuSub, { color: colors.textMuted }]}>{subtitle}</ThemedText>
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );

  return (
    <ThemedView style={styles.screen}>
      <VendorTabHeader title={labels.profileHeader} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}>
        <View style={styles.hero}>
          {shop?.avatar ? (
            <Image source={{ uri: shop.avatar }} style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} />
          )}
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.shopName, { color: colors.text }]}>
              {shop?.nom || 'Mon commerce'}
            </ThemedText>
            <ThemedText style={[styles.shopCat, { color: colors.textMuted }]}>{shop?.categorie || '—'}</ThemedText>
          </View>
            <View
              style={[
                styles.onlinePill,
                {
                  backgroundColor: isOnline ? colors.successSoft : colors.surfaceMuted,
                  borderColor: isOnline ? colors.border : colors.borderStrong,
                },
              ]}>
              <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.textMuted }]} />
              <ThemedText style={[styles.onlineTxt, { color: isOnline ? colors.success : colors.textMuted }]}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.textMuted }]}>Raccourcis</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          {row(
            <BarChart3 size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Statistiques',
            'Revenus et performances',
            () => router.push(VENDOR_HREF.statistics)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <Wallet size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Portefeuille',
            'Solde et transactions',
            () => router.push(VENDOR_HREF.wallet)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <Package size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Catalogue',
            'Catégories produits',
            () => router.push(VENDOR_HREF.catalog)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <Truck size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Livraisons en cours',
            'Suivi livreur',
            () => router.push(VENDOR_HREF.delivery)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <Bell size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Notifications',
            'Activité boutique',
            () => router.push(VENDOR_HREF.notifications)
          )}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {commerceType === 'restaurant' ? 'Restaurant' : 'Boutique'}
        </ThemedText>
        <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          {row(
            <Building2 size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            commerceType === 'restaurant' ? 'Informations restaurant' : 'Informations boutique',
            'Nom, description, contact',
            () => router.push(VENDOR_HREF.shopInfo)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <MapPin size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Adresses',
            'Arrondissement et adresse détaillée',
            () => router.push(VENDOR_HREF.shopAddresses)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <CreditCard size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Moyens de paiement',
            'Modalités de paiement clients',
            () => router.push(VENDOR_HREF.shopPayments)
          )}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.textMuted }]}>Compte de connexion</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          {row(
            <User size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Connexion & sécurité',
            'Mot de passe et suppression du compte',
            () => router.push('/account-settings')
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <Settings size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            'Apparence',
            'Thème clair ou sombre',
            () => router.push(VENDOR_HREF.shopSettings)
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {row(
            <HelpCircle size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />,
            "Centre d'aide",
            'FAQ et support',
            () => router.push(VENDOR_HREF.helpCenter)
          )}
        </View>

        <AppLogoutButton clearCart={false} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
    paddingVertical: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
  },
  shopName: { fontSize: 19, fontWeight: '800' },
  shopCat: { fontSize: 13, marginTop: 3 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineTxt: { fontSize: 11, fontWeight: '800' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuText: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 16 },
  menuTitleDanger: { fontWeight: '600' },
  menuSub: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
});
