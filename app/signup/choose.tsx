import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Role = {
  href: '/signup/client' | '/signup/boutique' | '/signup/restaurant';
  icon: 'person' | 'storefront' | 'restaurant';
  title: string;
  subtitle: string;
  iconBg: 'primary' | 'accent';
};

const ROLES: Role[] = [
  { href: '/signup/client', icon: 'person', title: 'Client', subtitle: 'Je commande, on me livre.', iconBg: 'primary' },
  { href: '/signup/boutique', icon: 'storefront', title: 'Boutique', subtitle: 'Je vends mes produits en ligne.', iconBg: 'primary' },
  { href: '/signup/restaurant', icon: 'restaurant', title: 'Restaurant', subtitle: 'Je sers mes plats et GoLivra les livre.', iconBg: 'primary' },
];

export default function SignupChooseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 40, 520);
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.heroGlowTop, { backgroundColor: colors.heroGlow }]} />
      <View style={[styles.heroGlowBottom, { backgroundColor: colors.heroGlow }]} />
      <View style={[styles.page, { paddingBottom: Math.max(insets.bottom + 12, 18) }]}>
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.replace('/auth')}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.centerBlock}>
          <View style={styles.header}>
            <Image source={require('@/assets/images/logo25292922882.png')} style={styles.logo} contentFit="contain" />
            <ThemedText type="title">Créer un compte</ThemedText>
            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>Comment souhaitez-vous utiliser GoLivra ?</ThemedText>
          </View>

          <View style={[styles.choices, { width: cardWidth }]}>
            {ROLES.map((r) => {
              const isAccent = r.iconBg === 'accent';
              return (
                <Pressable
                  key={r.href}
                  style={({ pressed }) => [
                    styles.choiceCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    },
                    pressed ? styles.pressed : undefined,
                  ]}
                  onPress={() => router.push(r.href)}>
                  <View
                    style={[
                      styles.choiceIconWrap,
                      isAccent
                        ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                        : { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
                    ]}>
                    <MaterialIcons
                      name={r.icon}
                      size={22}
                      color={isAccent ? colors.accentDeep : colors.primary}
                    />
                  </View>
                  <View style={styles.choiceText}>
                    <ThemedText
                      style={[
                        styles.choiceTitle,
                        { color: isDark ? colors.primaryBright : colors.primaryDeep },
                      ]}>
                      {r.title}
                    </ThemedText>
                    <ThemedText style={[styles.choiceSubtitle, { color: colors.textMuted }]}>
                      {r.subtitle}
                    </ThemedText>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color={colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>

          <ThemedView style={styles.footerInline} lightColor="transparent" darkColor="transparent">
            <ThemedText style={[styles.footerText, { color: colors.textMuted }]}>Déjà un compte ? </ThemedText>
            <Pressable onPress={() => router.replace('/auth')}>
              <ThemedText style={[styles.footerLink, { color: colors.primary }]}>Se connecter</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroGlowTop: {
    position: 'absolute',
    top: -180,
    left: -120,
    width: 420,
    height: 420,
    borderRadius: 260,
    opacity: 0.95,
  },
  heroGlowBottom: {
    position: 'absolute',
    bottom: -220,
    right: -160,
    width: 520,
    height: 520,
    borderRadius: 320,
    opacity: 0.5,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-start' },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  logo: { width: 150, height: 84, marginTop: 6, marginBottom: 2 },
  description: { opacity: 0.75, textAlign: 'center', maxWidth: 360 },
  choices: { alignSelf: 'center', gap: 12, marginTop: 6, marginBottom: 0 },
  choiceCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 22,
    boxShadow: '0px 14px 26px rgba(10,58,40,0.10)',
    elevation: 10,
  },
  popularBadgeWrap: { position: 'absolute', top: -10, right: 12 },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  popularBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  choiceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { fontSize: 16, fontWeight: '900' },
  choiceSubtitle: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.9 },
  footerInline: {
    marginTop: 34,
    paddingTop: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { fontWeight: '700' },
  footerLink: { fontWeight: '900' },
});
