import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ChevronRight,
  CreditCard,
  Gavel,
  Heart,
  HelpCircle,
  MapPin,
  Settings,
  Smartphone,
  Sparkles,
  Store,
  User,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { brandGradient3 } from '@/constants/app-palette';
import { AppLogoutButton } from '@/components/app-logout-button';
import { getSessionToken, logoutLocal } from '@/lib/auth';
import { saveCart } from '@/lib/cart-local';
import { fetchAuthMe, peekAuthMe, type AuthMe } from '@/lib/client-data';
import { resolveRemoteImageUrl } from '@/lib/images';
import { isMerchantRole } from '@/lib/roles';
import { VENDOR_HREF } from '@/lib/vendor-nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useAppColors } from '@/hooks/use-app-colors';

type Me = AuthMe;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showInfo, FeedbackOverlay } = useActionFeedback();
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const cached = peekAuthMe(token);
      if (cached) {
        setMe(cached);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      const data = await fetchAuthMe(token, force);
      setMe(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const avatarUri = resolveRemoteImageUrl(me?.imageUrl ?? me?.image_url);
  const memberSince =
    me?.created_at != null || me?.cree_le != null
      ? new Date(me.created_at ?? me.cree_le!).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const menuRow = (Icon: LucideIcon, title: string, subtitle: string, onPress: () => void) => (
    <Pressable style={({ pressed }) => [styles.menuRow, { backgroundColor: colors.surface }, pressed && { backgroundColor: colors.primarySoft }]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
        <Icon size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="defaultSemiBold" style={[styles.menuTitle, { color: colors.text }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.menuSub, { color: colors.textMuted }]}>{subtitle}</ThemedText>
      </View>
      <ChevronRight size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <View style={[styles.heroGlow, { backgroundColor: colors.heroGlow }]} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 10), paddingBottom: bottomPad }]}>
        <ThemedText type="title" style={[styles.pageTitle, { color: colors.primaryDeep }]}>
          Mon compte
        </ThemedText>
        <ThemedText style={[styles.pageSub, { color: colors.textSecondary }]}></ThemedText>

        {error ? (
          <View style={[styles.card, { borderColor: colors.errorSoft, backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.errTitle, { color: colors.error }]}>{error}</ThemedText>
            <Pressable style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => void load()}>
              <ThemedText style={[styles.retryText, { color: colors.onPrimary }]}>Réessayer</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.heroShell}>
            <LinearGradient
              colors={brandGradient3(colors)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}>
              <Sparkles size={20} color="rgba(255,255,255,0.9)" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.heroGradientTitle}>Mon espace GoLivra</ThemedText>
              <ThemedText style={styles.heroGradientSub}>Profil, paiements et préférences</ThemedText>
            </LinearGradient>
            <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
              {isLoading ? (
                <View style={styles.heroLoading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <ThemedText style={[styles.heroLoadingText, { color: colors.textMuted }]}>Chargement du profil…</ThemedText>
                </View>
              ) : (
                <>
                  <View style={[styles.avatarWrap, { backgroundColor: colors.primarySoft, borderColor: colors.surface }]}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" />
                    ) : (
                      <User size={34} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    )}
                  </View>
                  <ThemedText type="defaultSemiBold" style={[styles.displayName, { color: colors.text }]}>
                    {me?.nom?.trim() || 'Client GoLivra'}
                  </ThemedText>
                  <View style={styles.phoneRow}>
                    <Smartphone size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.phone, { color: colors.textSecondary }]}>{me?.telephone}</ThemedText>
                  </View>
                  {memberSince ? (
                    <ThemedText style={[styles.memberSince, { color: colors.textMuted }]}>Membre depuis le {memberSince}</ThemedText>
                  ) : null}
                </>
              )}
            </View>
          </View>
        )}

        <ThemedText style={[styles.sectionLabel, styles.sectionAfterHero, { color: colors.primaryDeep }]}>Compte</ThemedText>
        <View style={[styles.menuCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {me && isMerchantRole(me.role) ? (
            <>
              {menuRow(
                Store,
                me.role === 'restaurateur' ? 'Espace restaurant' : 'Espace boutique',
                me.role === 'restaurateur'
                  ? 'Menu, commandes, livraisons'
                  : 'Catalogue, commandes, livraisons',
                () => router.push(VENDOR_HREF.root),
              )}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}
          {menuRow(Settings, 'Profil et sécurité', 'Nom, téléphone et mot de passe', () =>
            router.push('/account-settings')
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {menuRow(MapPin, 'Mes adresses', 'Arrondissement et adresse détaillée', () => router.push('/my-addresses'))}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {menuRow(CreditCard, 'Paiement', 'Airtel Money et MTN Mobile Money', () =>
            router.push('/payment-methods'),
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {menuRow(Heart, 'Mes favoris', 'Restaurants et boutiques enregistrés', () =>
            router.push('/(tabs)/favorites')
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {menuRow(Settings, 'Préférences', 'Thème et notifications push', () => router.push('/settings'))}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.primaryDeep }]}>Assistance</ThemedText>
        <View style={[styles.menuCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {menuRow(HelpCircle, 'Centre d’aide', 'Foire aux questions et support client', () =>
            showInfo('Assistance', 'Le centre d’aide sera disponible prochainement.')
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {menuRow(Gavel, 'Conditions & Confidentialité', 'Mentions légales et politique de données', () =>
            showInfo('Mentions Légales', 'Conditions Générales d’Utilisation GoLivra v2.1')
          )}
        </View>

        <View style={styles.logoutWrapper}>
          <AppLogoutButton variant="ghost" clearCart />
        </View>

        <ThemedText style={[styles.versionLine, { color: colors.textMuted }]}>GoLivra · version {appVersion}</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroGlow: {
    position: 'absolute',
    top: -140,
    left: -90,
    width: 360,
    height: 360,
    borderRadius: 220,
  },
  content: { paddingHorizontal: 18 },
  pageTitle: { fontSize: 24, fontWeight: '800' },
  pageSub: { marginTop: 6, fontSize: 13, opacity: 0.92, marginBottom: 12 },
  heroShell: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 7,
  },
  heroGradient: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 4,
  },
  heroGradientTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  heroGradientSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    maxWidth: '96%',
  },
  heroLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 22,
    minHeight: 112,
  },
  heroLoadingText: { fontSize: 13, fontWeight: '600' },
  heroCard: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
    gap: 6,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
    marginTop: -40,
    marginBottom: 2,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImg: { width: '100%', height: '100%' },
  displayName: { fontSize: 18, textAlign: 'center' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  phone: { fontSize: 14, fontWeight: '600' },
  memberSince: { fontSize: 12, marginTop: 2 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  errTitle: { fontWeight: '700', marginBottom: 8 },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
  },
  retryText: { fontWeight: '800', fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
  },
  sectionAfterHero: {
    marginTop: 4,
  },
  sectionSupport: {
    marginTop: 12,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuTitle: { fontSize: 15 },
  menuSub: { fontSize: 11, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  logoutWrapper: { marginTop: 24, marginBottom: 8 },
  versionLine: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
});
