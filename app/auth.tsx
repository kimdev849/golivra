import { Link } from 'expo-router'
import { useRouter } from '@/hooks/use-safe-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
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
import { ArrowLeft, ArrowRight, Eye, EyeOff, FlaskConical, Lock, Moon, Smartphone, Sun, UserPlus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthBackdrop } from '@/components/auth-backdrop';
import { FormErrorBanner } from '@/components/form-error-banner';
import { InlineFormError } from '@/components/inline-form-error';
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
  const { width, height } = useWindowDimensions();
  const colors = useAppColors();
  const { isDark, setDarkMode } = useAppTheme();
  const styles = useMemo(() => makeAuthStyles(colors), [colors]);
  const [loginPhone, setLoginPhone] = useState('+242 ');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string | null; password?: string | null }>({});
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Android (edge-to-edge) : le clavier peut recouvrir les champs bas du
  // formulaire — on ajoute un padding bas = hauteur du clavier pour que le
  // champ saisi reste visible et scrollable.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardInset(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const passwordRef = useRef<TextInput>(null);
  const phoneE164 = toE164(loginPhone);
  const canSubmit = Boolean(phoneE164) && Boolean(password) && password.length >= 6 && !isSubmitting;
  const formWidth = Math.min(width - 40, 460);

  // Sur les grands écrans (Android > 800px de haut), on descend TRÈS légèrement
  // le logo et le formulaire pour éviter l'effet « tout collé en haut ».
  const tallScreenPad = height > 800 ? Math.min(Math.round((height - 800) * 0.07), 26) : 0;

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
    const next: Record<string, string | null> = {};
    const e1 = validatePhone(loginPhone);
    if (!e1.ok) {
      next.phone = e1.message;
    } else if (!phoneE164) {
      next.phone = 'Ce numéro ne semble pas complet. Vérifiez-le, par exemple +242 06 123 45 67.';
    }
    const e2 = validatePassword(password);
    if (!e2.ok) {
      next.password = e2.message;
    }
    if (next.phone || next.password) {
      setFieldErrors(next);
      triggerShake();
      return;
    }
    if (!phoneE164) {
      setFieldErrors({ phone: 'Ce numéro ne semble pas complet. Vérifiez-le, par exemple +242 06 123 45 67.' });
      triggerShake();
      return;
    }
    setFieldErrors({});

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

  // Validation douce à la sortie du champ : l'erreur s'affiche sous le champ
  // concerné, sans bloquer la saisie ni attendre l'appui sur « Se connecter ».
  const handleBlurPhone = () => {
    setFieldErrors((prev) => ({ ...prev, phone: null }));
    const r = validatePhone(loginPhone);
    if (!r.ok) setFieldErrors((prev) => ({ ...prev, phone: r.message }));
  };

  const handleBlurPassword = () => {
    setFieldErrors((prev) => ({ ...prev, password: null }));
    const r = validatePassword(password);
    if (!r.ok) setFieldErrors((prev) => ({ ...prev, password: r.message }));
  };

  return (
    <ThemedView style={styles.container}>
      <AuthBackdrop colors={colors} />

      {/* Bouton retour + bascule thème */}
      <View style={[styles.topBar, { top: Math.max(insets.top + 10, 20) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed ? styles.pressed : undefined,
        ]}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          hitSlop={8}>
          <ArrowLeft size={20} color={colors.text} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
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
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        // Sur Android on laisse le système gérer le redimensionnement (adjustResize) :
        // behavior="height" réduisait l'écran une 2ᵉ fois et faisait fermer le clavier dès la saisie.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 24 + tallScreenPad },
            Platform.OS === 'android' ? styles.scrollContentAndroid : undefined,
            keyboardInset > 0 ? { paddingBottom: keyboardInset + 48 } : undefined,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {/* En-tête : logo + titre + slogan. Contenu aligné en HAUT (comme
              l'inscription) : un contenu centré se recentrerait quand le
              clavier s'ouvre → les champs bougent → perte de focus. */}
          <Animated.View entering={HEADER_ENTER} style={styles.header}>
            <Animated.View entering={LOGO_ENTER}>
              <Image
                source={require('@/assets/images/logo25292922882.png')}
                style={styles.logo}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
              />
            </Animated.View>
            <ThemedText type="title" style={styles.title}>
              Connexion
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Connectez-vous pour finaliser votre commande
            </ThemedText>
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
                {/* ── Téléphone ── */}
                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Numéro de téléphone
                  </ThemedText>
                  <View
                    style={[
                      styles.inputCard,
                      { backgroundColor: colors.inputBg, borderColor: fieldErrors.phone ? colors.error : colors.border },
                    ]}>
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
                      onChangeText={(text) => {
                        setLoginPhone(formatPhone(text));
                        if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: null }));
                      }}
                      onBlur={handleBlurPhone}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                  </View>
                  <InlineFormError message={fieldErrors.phone} colors={colors} />
                </View>

                {/* ── Mot de passe ── */}
                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    Mot de passe
                  </ThemedText>
                  <View
                    style={[
                      styles.inputCard,
                      { backgroundColor: colors.inputBg, borderColor: fieldErrors.password ? colors.error : colors.border },
                    ]}>
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
                      onChangeText={(text) => {
                        setPassword(text);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                      }}
                      onBlur={handleBlurPassword}
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
                  <InlineFormError message={fieldErrors.password} colors={colors} />
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
              <View style={styles.submitGlow}>
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
                      <ThemedText style={styles.submitButtonText}>Connexion…</ThemedText>
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
            </View>
          </View>


        </ScrollView>
      </KeyboardAvoidingView>
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
      backgroundColor: c.background,
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
    betaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 18,
      opacity: 0.85,
    },
    betaText: {
      fontSize: 12.5,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    topBar: {
      position: 'absolute',
      left: 20,
      right: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      zIndex: 10,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      marginBottom: 26,
    },
    logo: { width: 118, height: 68 },
    title: {
      fontSize: 22,
      lineHeight: 28,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 19,
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
    eyeButton: { padding: 10 },
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
  });
}
