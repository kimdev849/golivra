import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Store,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { AuthBackdrop } from '@/components/auth-backdrop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppColors } from '@/hooks/use-app-colors';

/** Couleurs "image" des pastilles de rôle — fixes pour rester fidèles au design. */
const ICON_BG_POPULAR = '#F59E0B';
const ICON_BG_GREEN = '#065F46';
const BADGE_BG = '#FBBF24';
const BADGE_TEXT = '#1A1A1A';

type Role = {
  href: '/signup/client' | '/signup/boutique' | '/signup/restaurant';
  icon: LucideIcon;
  title: string;
  subtitle: string;
  iconBg: string;
  popular?: boolean;
};

// Animations d'entrée stables (cascade logo → cartes → bouton).
const TOP_ENTER = FadeInDown.duration(380);
const HEADER_ENTER = FadeInDown.duration(380).delay(60);
const CHOICES_ENTER = FadeInUp.duration(420).delay(140);
const FOOTER_ENTER = FadeInUp.duration(380).delay(260);

const ROLES: Role[] = [
  {
    href: '/signup/client',
    icon: User,
    title: 'Commander sur GoLivra',
    subtitle: 'Commandez dans vos restaurants et boutiques préférés.',
    iconBg: ICON_BG_POPULAR,
    popular: true,
  },
  {
    href: '/signup/restaurant',
    icon: UtensilsCrossed,
    title: 'Inscrire mon restaurant',
    subtitle: 'Recevez et gérez vos commandes sur GoLivra.',
    iconBg: ICON_BG_GREEN,
  },
  {
    href: '/signup/boutique',
    icon: Store,
    title: 'Inscrire ma boutique',
    subtitle: 'Vendez vos produits et gérez vos commandes.',
    iconBg: ICON_BG_GREEN,
  },
];

export default function SignupChooseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 520);
  const colors = useAppColors();

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuthBackdrop colors={colors} />
      <View
        style={[
          styles.page,
          {
            paddingTop: Math.max(insets.top + 14, 28),
            paddingBottom: Math.max(insets.bottom + 12, 18),
          },
        ]}>
      
        <Animated.View entering={TOP_ENTER} style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}
            hitSlop={6}
          >
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.topLogoWrap}>
            <Image
              source={require('@/assets/images/logo25292922882.png')}
              style={styles.topLogo}
              contentFit="contain"
            />
          </View>
        </Animated.View>

        <View style={styles.centerBlock}>
          <Animated.View entering={HEADER_ENTER} style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Que souhaitez-vous faire ?
            </ThemedText>
            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
              Choisissez ce qui vous correspond.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={CHOICES_ENTER} style={[styles.choices, { width: cardWidth }]}>
            {ROLES.map((r) => {
              const Icon = r.icon;
              const isPopular = r.popular;
              return (
                <Pressable
                  key={r.href}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isPopular ? BADGE_BG : colors.border,
                    },
                    pressed ? styles.pressed : undefined,
                  ]}
                  onPress={() => router.push(r.href)}
                >
                  {isPopular ? (
                    <View style={styles.popularBadgeWrap}>
                      <View style={styles.popularBadge}>
                        <ShoppingBag size={11} color={BADGE_TEXT} strokeWidth={2.5} />
                        <ThemedText style={styles.popularBadgeText}>Populaire</ThemedText>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.choiceIconWrap, { backgroundColor: r.iconBg }]}>
                    <Icon size={24} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                  <View style={styles.choiceText}>
                    <ThemedText style={[styles.choiceTitle, { color: colors.text }]}>
                      {r.title}
                    </ThemedText>
                    <ThemedText style={[styles.choiceSubtitle, { color: colors.textMuted }]}>
                      {r.subtitle}
                    </ThemedText>
                  </View>
                  <ChevronRight size={22} color={colors.text} strokeWidth={2.5} />
                </Pressable>
              );
            })}
          </Animated.View>

          <Animated.View entering={FOOTER_ENTER} style={styles.footerWrap}>
            <ThemedText style={[styles.footerText, { color: colors.textMuted }]}>
              Déjà un compte ?
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                { borderColor: colors.primary, width: cardWidth },
                pressed ? styles.pressed : undefined,
              ]}
              onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/auth'); }}>
              <ThemedText style={[styles.loginButtonText, { color: colors.primary }]}>
                Se connecter
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLogoWrap: {
    flex: 1,
    alignItems: 'center',
    marginRight: 44,
  },
  topLogo: {
    width: 92,
    height: 52,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 340,
  },
  choices: {
    alignSelf: 'center',
    gap: 14,
  },
  choiceCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 18,
  },
  popularBadgeWrap: {
    position: 'absolute',
    top: -11,
    right: 14,
    zIndex: 2,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: BADGE_BG,
  },
  popularBadgeText: {
    color: BADGE_TEXT,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  choiceIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 16, fontWeight: '700' },
  choiceSubtitle: { fontSize: 13, lineHeight: 18 },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }],
  },
  footerWrap: {
    marginTop: 34,
    alignItems: 'center',
  },
  footerText: { fontSize: 14, fontWeight: '500' },
  loginButton: {
    marginTop: 14,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 15,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: { fontSize: 16, fontWeight: '800' },
});
