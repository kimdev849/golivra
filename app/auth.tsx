import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FormErrorBanner } from '@/components/form-error-banner';
import type { AppPalette } from '@/constants/app-palette';
import { brandGradient3 } from '@/constants/app-palette';
import { useAppColors } from '@/hooks/use-app-colors';
import { loginAccount, persistAuthSession } from '@/lib/auth';
import { prefetchClientCatalog } from '@/lib/client-data';
import { formatPhone, initPhoneCountries, toE164 } from '@/lib/phone';
import { homeHrefForRole } from '@/lib/roles';
import { UX_ERRORS, friendlyErrorMessage } from '@/lib/ux-copy';
import { validatePassword, validatePhone } from '@/lib/form-validation';

export default function AuthScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = useMemo(() => makeAuthStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [loginPhone, setLoginPhone] = useState('+242 ');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneE164 = toE164(loginPhone);
  const canSubmit = Boolean(phoneE164) && Boolean(password) && password.length >= 6 && !isSubmitting;

  useEffect(() => {
    initPhoneCountries().catch(() => {});

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = async () => {
    setError(null);
    const e1 = validatePhone(loginPhone);
    if (!e1.ok) {
      setError(e1.message);
      return;
    }
    if (!phoneE164) {
      setError('Numéro invalide.');
      return;
    }
    const e2 = validatePassword(password);
    if (!e2.ok) {
      setError(e2.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await loginAccount({
        telephone: phoneE164,
        motDePasse: password,
      });
      await persistAuthSession(session);
      prefetchClientCatalog();
      void import('@/lib/favorites').then((m) => m.syncFavoritesWithServer());
      void import('@/lib/cart-local').then((m) => m.syncCartWithServer());
      router.replace(homeHrefForRole(session.user.role));
    } catch (e) {
      setError(friendlyErrorMessage(e, UX_ERRORS.auth));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.heroGlowTop} />
      <View style={styles.heroGlowBottom} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: 20,
              paddingBottom: keyboardVisible ? 140 : 32,
            },
            Platform.OS === 'android' ? styles.scrollContentAndroid : undefined,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/logo25292922882.png')}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="high"
            />
            <ThemedText type="title">Bon retour</ThemedText>
          </View>

          <View style={[styles.formWrapper, { width }]}>
            <FormErrorBanner
              message={error}
              colors={colors}
              title="Connexion impossible"
              onDismiss={() => setError(null)}
            />

            <ThemedView style={styles.inputCard}>
              <View style={styles.inputIcon}>
                <MaterialIcons name="call" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBody}>
                <ThemedText style={styles.inputLabel}>Numéro de téléphone</ThemedText>
                <TextInput
                  style={styles.inputField}
                  placeholder="+242 06 XXX XX XX"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.placeholder}
                  selectionColor={colors.primary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={loginPhone}
                  onChangeText={(text) => setLoginPhone(formatPhone(text))}
                  returnKeyType="next"
                  onSubmitEditing={() => {}}
                />
              </View>
            </ThemedView>

            <ThemedView style={styles.inputCard}>
              <View style={styles.inputIcon}>
                <MaterialIcons name="lock" size={18} color={colors.primary} />
              </View>
              <View style={styles.inputBody}>
                <ThemedText style={styles.inputLabel}>Mot de passe</ThemedText>
                <TextInput
                  style={styles.inputField}
                  placeholder="Votre mot de passe"
                  secureTextEntry={!passwordVisible}
                  placeholderTextColor={colors.placeholder}
                  selectionColor={colors.primary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              <Pressable style={styles.eyeButton} onPress={() => setPasswordVisible((v) => !v)} hitSlop={10}>
                <MaterialIcons name={passwordVisible ? 'visibility-off' : 'visibility'} size={20} color="#95ACA0" />
              </Pressable>
            </ThemedView>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed ? styles.buttonPressed : undefined,
                isSubmitting ? styles.buttonDisabled : undefined,
                !canSubmit ? styles.buttonDisabled : undefined,
              ]}
              disabled={!canSubmit}
              onPress={handleLogin}>
              <LinearGradient
                colors={canSubmit ? brandGradient3(colors) : [colors.primaryMuted, colors.primaryMuted]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Connexion…' : 'Se connecter'}</ThemedText>
                {isSubmitting ? <ActivityIndicator color={colors.onPrimary} style={{ marginLeft: 8 }} /> : null}
              </View>
            </Pressable>
            <Link href="/forgot-password" asChild>
              <Pressable style={({ pressed }) => [styles.linkButton, pressed ? styles.buttonPressed : undefined]}>
                <ThemedText style={styles.linkText}>Mot de passe oublié ?</ThemedText>
              </Pressable>
            </Link>

            {/* Lien d'inscription juste sous le formulaire, pas dans un footer */}
            <ThemedView style={styles.signupHint} lightColor="transparent" darkColor="transparent">
              <ThemedText style={[styles.signupHintText, { color: colors.textMuted }]}>
                Pas de compte ?{' '}
              </ThemedText>
              <Link href="/signup/choose" asChild>
                <Pressable hitSlop={8}>
                  <ThemedText style={[styles.signupHintLink, { color: colors.primary }]}>
                    {"S'inscrire"}
                  </ThemedText>
                </Pressable>
              </Link>
            </ThemedView>
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
    heroGlowTop: {
      position: 'absolute',
      top: -180,
      left: -120,
      width: 420,
      height: 420,
      borderRadius: 260,
      backgroundColor: c.heroGlow,
      opacity: 0.95,
    },
    heroGlowBottom: {
      position: 'absolute',
      bottom: -220,
      right: -160,
      width: 520,
      height: 520,
      borderRadius: 320,
      backgroundColor: c.heroGlow,
      opacity: 0.6,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContentAndroid: {
      // Android specific adjustments if needed
    },
    scrollContentWithKeyboard: {
      justifyContent: 'flex-start',
      paddingBottom: 260,
    },
    header: {
      paddingHorizontal: 20,
      gap: 10,
      alignItems: 'center',
      marginBottom: 16,
      width: '100%',
    },
    logo: { width: 140, height: 82, marginBottom: 6 },
    signupHint: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 0,
      width: '100%',
      gap: 4,
    },
    signupHintText: { fontSize: 15, fontWeight: '700' },
    signupHintLink: { fontSize: 15, fontWeight: '900' },
    formWrapper: {
      alignItems: 'center',
      width: '100%',
      paddingHorizontal: 20,
      gap: 14,
    },
    inputCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: c.inputBorder,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: c.inputBg,
      elevation: 4,
      width: '100%',
      maxWidth: 460,
    },
    inputIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputBody: { flex: 1, gap: 4 },
    inputLabel: { fontSize: 12, fontWeight: '800', color: c.textSecondary },
    inputField: { paddingVertical: 0, fontSize: 16, color: c.text, minHeight: 22 },
    eyeButton: { paddingHorizontal: 4, paddingVertical: 6 },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.995 }],
    },
    submitButton: {
      marginTop: 4,
      backgroundColor: c.primary,
      borderRadius: 999,
      paddingVertical: 16,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      width: '100%',
      maxWidth: 460,
      overflow: 'hidden',
      shadowColor: c.primaryDeep,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
    },
    submitButtonText: {
      color: c.onPrimary,
      fontWeight: '800',
      fontSize: 17,
    },
    linkButton: {
      marginTop: 4,
      alignItems: 'center',
      paddingVertical: 6,
    },
    linkText: {
      color: c.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
  });
}
