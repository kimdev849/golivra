import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Eye, EyeOff, Lock, LogIn, Moon, ShieldCheck, Smartphone, Star, Sun, UserPlus, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthBackdrop } from '@/components/auth-backdrop';
import { FormErrorBanner } from '@/components/form-error-banner';
import { BUILD_LABEL } from '@/lib/build-info';
import { accentGradient2, type AppPalette } from '@/constants/app-palette';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { loginAccount, persistAuthSession } from '@/lib/auth';
import { prefetchClientCatalog } from '@/lib/client-data';
import { formatPhone, initPhoneCountries, toE164 } from '@/lib/phone';
import { homeHrefForRole } from '@/lib/roles';
import { UX_ERRORS, friendlyErrorMessage } from '@/lib/ux-copy';
import { validatePassword, validatePhone } from '@/lib/form-validation';

// Animation d'entrée du header uniquement (aucun champ de saisie dedans : les
// Animated.View autour des TextInput faisaient perdre le focus et fermer le
// clavier dès la saisie).
const HEADER_ENTER = FadeInDown.duration(460);
// Logo : apparition ressort (spring) pour un démarrage vivant et premium.
const LOGO_ENTER = ZoomIn.springify().damping(14).mass(0.9).stiffness(120);

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useAppColors();
  const { isDark, setDarkMode } = useAppTheme();
  const styles = useMemo(() => makeAuthStyles(colors), [colors]);
  const [loginPhone, setLoginPhone] = useState('+242 ');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflet lumineux qui balaie le bouton « Se connecter » pendant la
  // connexion : bien plus vivant qu'un simple spinner de chargement.
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!isSubmitting) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => {
      sweep.value = 0;
    };
  }, [isSubmitting, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-170, Math.max(width + 120, 420)]) },
    ],
  }));
  const passwordRef = useRef<TextInput>(null);
  const phoneE164 = toE164(loginPhone);
  const canSubmit = Boolean(phoneE164) && Boolean(password) && password.length >= 6 && !isSubmitting;
  const formWidth = Math.min(width - 40, 460);

  // Secousse simple en transform JS quand la connexion échoue. Volontairement
  // SANS reanimated : un Animated.View autour des champs faisait perdre le
  // focus au TextInput et fermer le clavier dès la saisie.
  const [shakeX, setShakeX] = useState(0);
  const shakeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = shakeTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const triggerShake = () => {
    shakeTimersRef.current.forEach(clearTimeout);
    shakeTimersRef.current = [];
    const frames = [-12, 12, -8, 8, 0];
    frames.forEach((x, i) => {
      shakeTimersRef.current.push(setTimeout(() => setShakeX(x), i * 60));
    });
  };

  useEffect(() => {
    initPhoneCountries().catch(() => {});
  }, []);

  const handleLogin = async () => {
    setError(null);
    const e1 = validatePhone(loginPhone);
    if (!e1.ok) {
      setError(e1.message);
      triggerShake();
      return;
    }
    if (!phoneE164) {
      setError('Numéro invalide.');
      triggerShake();
      return;
    }
    const e2 = validatePassword(password);
    if (!e2.ok) {
      setError(e2.message);
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const session = await loginAccount({
        telephone: phoneE164,
        motDePasse: password,
      });
      await persistAuthSession(session);
      prefetchClientCatalog();
      void import('@/lib/favorites').then((m) => m.syncFavoritesWithServer());
      void import('@/lib/cart-local').then((m) => m.syncCartWithServer());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(homeHrefForRole(session.user.role));
    } catch (e) {
      setError(friendlyErrorMessage(e, UX_ERRORS.auth));
      triggerShake();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AuthBackdrop colors={colors} />

      {/* Bascule rapide du thème clair/sombre */}
      <Pressable
        style={({ pressed }) => [
          styles.themeToggle,
          {
            top: Math.max(insets.top + 10, 20),
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          pressed ? styles.pressed : undefined,
        ]}
        onPress={() => {
          void Haptics.selectionAsync();
          void setDarkMode(!isDark);
        }}
        hitSlop={8}>
        {isDark ? (
          <Sun size={20} color={colors.primary} strokeWidth={2.2} />
        ) : (
          <Moon size={20} color={colors.primary} strokeWidth={2.2} />
        )}
      </Pressable>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        // Sur Android on laisse le système gérer le redimensionnement (adjustResize) :
        // behavior="height" réduisait l'écran une 2ᵉ fois et faisait fermer le clavier dès la saisie.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'android' ? styles.scrollContentAndroid : undefined,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {/* En-tête : logo + titre + slogan. Contenu aligné en HAUT (comme
              l'inscription) : un contenu centré se recentrerait quand le
              clavier s'ouvre → les champs bougent → perte de focus. */}
          <Animated.View entering={HEADER_ENTER} style={styles.header}>
            <View style={styles.logoWrap}>
              {/* Halo doux derrière le logo : profondeur et confiance. */}
              <View
                style={[
                  styles.logoGlow,
                  { backgroundColor: colors.heroGlow, borderColor: colors.primaryMuted },
                ]}
              />
              <Animated.View entering={LOGO_ENTER}>
                <Image
                  source={require('@/assets/images/logo25292922882.png')}
                  style={styles.logo}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="high"
                />
              </Animated.View>
            </View>
            <ThemedText type="title" style={styles.title}>
              Bon retour 👋
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Vos favoris, vos commandes,
              {'\n'}livrés en un clin d&apos;œil.
            </ThemedText>

            {/* Badges de confiance — la preuve sociale qui donne envie. */}
            <View style={styles.trustRow}>
              <View
                style={[styles.trustChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ShieldCheck size={13} color={colors.primary} strokeWidth={2.4} />
                <ThemedText style={[styles.trustTxt, { color: colors.textSecondary }]}>
                  Paiement sécurisé
                </ThemedText>
              </View>
              <View
                style={[styles.trustChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Zap size={13} color={colors.primary} strokeWidth={2.4} />
                <ThemedText style={[styles.trustTxt, { color: colors.textSecondary }]}>
                  Livraison rapide
                </ThemedText>
              </View>
              <View
                style={[styles.trustChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Star size={13} color="#F5A524" fill="#F5A524" strokeWidth={2} />
                <ThemedText style={[styles.trustTxt, { color: colors.textSecondary }]}>4.8/5</ThemedText>
              </View>
            </View>
          </Animated.View>

          <View style={[styles.formPage, { width }]}>
            <View
              style={[
                styles.formCard,
                { width: formWidth, borderColor: colors.border, backgroundColor: colors.surface },
                // Transform de secousse appliqué UNIQUEMENT pendant la secousse : au
                // repos, la carte est strictement identique à celle de l'inscription
                // (aucune couche transform native sur le parent des champs).
                shakeX !== 0 ? { transform: [{ translateX: shakeX }] } : null,
              ]}>
              <FormErrorBanner
                message={error}
                colors={colors}
                title="Connexion impossible"
                onDismiss={() => setError(null)}
              />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionNumber, { backgroundColor: colors.primary }]}>
                    <LogIn size={14} color="#FFFFFF" strokeWidth={2.6} />
                  </View>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Connexion</ThemedText>
                </View>

                {/* ── Téléphone ── */}
                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Numéro de téléphone
                  </ThemedText>
                  {/* Même structure que l'inscription : pas de onFocus/onBlur ni de
                      style dynamique au focus — le re-render + elevation sur le
                      parent faisaient perdre le focus au TextInput sur Android. */}
                  <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                    <Smartphone size={20} color={colors.primary} strokeWidth={2.2} />
                    <TextInput
                      style={[styles.inputField, { color: colors.text }]}
                      placeholder="+242 06 XXX XX XX"
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.placeholder}
                      selectionColor={colors.primary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={loginPhone}
                      onChangeText={(text) => setLoginPhone(formatPhone(text))}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                </View>

                {/* ── Mot de passe ── */}
                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Mot de passe
                  </ThemedText>
                  <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                    <Lock size={20} color={colors.primary} strokeWidth={2.2} />
                    <TextInput
                      ref={passwordRef}
                      style={[styles.inputField, { color: colors.text }]}
                      placeholder="Votre mot de passe"
                      secureTextEntry={!passwordVisible}
                      placeholderTextColor={colors.placeholder}
                      selectionColor={colors.primary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      value={password}
                      onChangeText={setPassword}
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        if (canSubmit) void handleLogin();
                      }}
                    />
                    <Pressable
                      style={styles.eyeButton}
                      onPress={() => setPasswordVisible((v) => !v)}
                      hitSlop={10}>
                      {passwordVisible ? (
                        <EyeOff size={20} color={colors.textMuted} strokeWidth={2.2} />
                      ) : (
                        <Eye size={20} color={colors.textMuted} strokeWidth={2.2} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.forgotRow, pressed && styles.pressed]}
                  onPress={() => router.push('/forgot-password')}
                  hitSlop={6}>
                  <ThemedText style={[styles.forgotText, { color: colors.primary }]}>
                    Mot de passe oublié ?
                  </ThemedText>
                </Pressable>
              </View>

              {/* ── Bouton principal ── */}
              {/* Le glow porte sur un wrapper SANS overflow:hidden : un parent
                  en overflow:hidden clipe l'ombre du bouton enfant sur iOS. */}
              <View
                style={[
                  styles.submitGlow,
                  !isSubmitting && { boxShadow: '0px 12px 30px rgba(22, 163, 74, 0.32)' },
                ]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitWrap,
                    pressed ? styles.pressed : undefined,
                    !canSubmit ? styles.buttonDisabled : undefined,
                  ]}
                  disabled={!canSubmit}
                  onPress={handleLogin}>
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitButton}>
                    {isSubmitting ? (
                      <View style={styles.submitBusy}>
                        {/* Reflet qui balaie le bouton pendant la connexion */}
                        <View pointerEvents="none" style={styles.submitSweepRot}>
                          <Animated.View style={[styles.submitSweep, sweepStyle]} />
                        </View>
                        <ThemedText style={styles.submitButtonText}>Connexion…</ThemedText>
                      </View>
                    ) : (
                      <View style={styles.submitLabelRow}>
                        <ThemedText style={styles.submitButtonText}>Se connecter</ThemedText>
                        <ArrowRight size={20} color={colors.onPrimary} strokeWidth={2.6} />
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>

              {/* ── Séparateur ── */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
                <ThemedText style={[styles.dividerText, { color: colors.textMuted }]}>ou</ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
              </View>

              <Link href="/signup/choose" asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.signupButton,
                    pressed ? styles.pressed : undefined,
                  ]}
                  hitSlop={8}>
                  <LinearGradient
                    colors={accentGradient2(colors)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signupButtonGradient}>
                    {/* Icône en position absolue : le texte reste parfaitement centré. */}
                    <UserPlus size={20} color={colors.onAccent} strokeWidth={2.4} style={styles.signupIcon} />
                    <ThemedText style={[styles.signupButtonText, { color: colors.onAccent }]}>
                      Créer un compte gratuit
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </Link>

              {/* Une simple ligne discrète en bas, comme sur l'inscription. */}
              <ThemedText style={[styles.formHint, { color: colors.textMuted }]}>
                Vos informations sont sécurisées et confidentielles.
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Marqueur de build : permet de vérifier que la version affichée est bien à jour. */}
      <View style={[styles.buildBadge, { bottom: Math.max(insets.bottom, 6) }]} pointerEvents="none">
        <ThemedText style={[styles.buildBadgeText, { color: colors.textMuted }]}>{BUILD_LABEL}</ThemedText>
      </View>
    </ThemedView>
  );
}

function makeAuthStyles(c: AppPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    keyboardContainer: {
      flex: 1,
    },
    // Padding bas généreux (fixe, sans contenu) : rend la page assez haute
    // pour défiler quand le clavier est ouvert, comme l'inscription. Rien
    // d'ajouté visuellement en bas.
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingTop: 24,
      paddingBottom: 150,
    },
    scrollContentAndroid: {
      paddingBottom: 140,
    },
    themeToggle: {
      position: 'absolute',
      right: 20,
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    header: {
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      marginBottom: 26,
    },
    logoWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      marginBottom: 4,
    },
    logoGlow: {
      position: 'absolute',
      width: 158,
      height: 158,
      borderRadius: 79,
      opacity: 0.85,
      borderWidth: 1,
    },
    logo: { width: 118, height: 68 },
    trustRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
    },
    trustChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    trustTxt: { fontSize: 11.5, fontWeight: '700' },
    title: {
      fontSize: 26,
      lineHeight: 32,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14.5,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 340,
    },
    formPage: {
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    // Carte du formulaire — même gabarit que l'inscription.
    formCard: {
      borderWidth: 1.2,
      borderRadius: 24,
      padding: 20,
      gap: 14,
      shadowColor: '#0C3020',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 6,
    },
    section: {
      gap: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 2,
    },
    sectionNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 13.5,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    field: {
      gap: 10,
    },
    fieldLabel: {
      fontSize: 13.5,
      fontWeight: '700',
    },
    // Champ de saisie — identique à l'inscription (icône dans la rangée).
    inputCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    inputField: {
      flex: 1,
      paddingVertical: 0,
      fontSize: 15,
      minHeight: 22,
    },
    eyeButton: { paddingHorizontal: 2, paddingVertical: 6 },
    forgotRow: {
      alignSelf: 'flex-end',
      paddingVertical: 4,
    },
    forgotText: {
      fontSize: 13.5,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.86,
      transform: [{ scale: 0.995 }],
    },
    submitGlow: {
      marginTop: 8,
      borderRadius: 999,
    },
    submitWrap: {
      borderRadius: 999,
      overflow: 'hidden',
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 999,
      paddingVertical: 16,
      minHeight: 56,
    },
    submitLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    submitBusy: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitSweepRot: {
      position: 'absolute',
      top: -46,
      left: 0,
      width: '120%',
      height: 150,
      transform: [{ rotate: '18deg' }],
    },
    submitSweep: {
      width: 110,
      height: '100%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.32)',
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 16.5,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    dividerText: {
      fontSize: 12.5,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    // Bouton secondaire plein format — dégradé jaune marque (l'accent de la
    // palette est réservé aux CTA secondaires) + texte foncé. Un vert plein se
    // fondait dans le fond sombre et donnait l'impression d'un simple lien :
    // le jaune est indiscutablement un bouton en clair ET en sombre.
    signupButton: {
      width: '100%',
      borderRadius: 999,
    },
    signupButtonGradient: {
      borderRadius: 999,
      minHeight: 56,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(0,0,0,0.14)',
      boxShadow: '0px 6px 18px rgba(245, 165, 36, 0.25)',
      elevation: 3,
    },
    signupIcon: {
      position: 'absolute',
      left: 18,
    },
    signupButtonText: { fontSize: 16.5, fontWeight: '800' },
    formHint: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
    },
    buildBadge: {
      position: 'absolute',
      alignSelf: 'center',
      zIndex: 5,
    },
    buildBadgeText: { fontSize: 10.5, fontWeight: '600', opacity: 0.75 },
  });
}
