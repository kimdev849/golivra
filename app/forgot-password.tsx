import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check, ChevronLeft, KeyRound, Lock, MessageCircle, Smartphone } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { FormStepper } from '@/components/form-stepper';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthBackdrop } from '@/components/auth-backdrop';
import { FormErrorBanner } from '@/components/form-error-banner';
import { useAppColors } from '@/hooks/use-app-colors';
import { resetPassword } from '@/lib/auth';
import { requestOtp } from '@/lib/otp';
import { formatPhone, initPhoneCountries, toE164 } from '@/lib/phone';
import { validateOtp, validatePassword, validatePasswordConfirmation, validatePhone } from '@/lib/form-validation';

// Animations d'entrée stables (cascade titre → étapes → formulaire).
const TOP_ENTER = FadeInDown.duration(400);
const TITLE_ENTER = FadeInDown.duration(400).delay(50);
const SUB_ENTER = FadeInDown.duration(400).delay(90);
const STEPPER_ENTER = FadeInUp.duration(420).delay(130);
const FORM_ENTER = FadeInUp.duration(420).delay(200);

type Step = 'phone' | 'otp' | 'done';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const formWidth = Math.min(width - 40, 460);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+242 ');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const phoneE164 = toE164(phone);
  const stepIndex = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;

  useEffect(() => {
    initPhoneCountries().catch(() => {});
  }, []);

  const handleRequestOtp = async () => {
    setError(null);
    const e = validatePhone(phone);
    if (!e.ok) {
      setError(e.message);
      return;
    }
    if (!phoneE164) {
      setError('Numéro invalide.');
      return;
    }
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await requestOtp(phoneE164);
      setTestOtp(res.testMode && res.otpCode ? res.otpCode : null);
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'envoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!phoneE164) {
      setError('Numéro invalide.');
      return;
    }
    const e1 = validateOtp(otpCode);
    if (!e1.ok) {
      setError(e1.message);
      return;
    }
    const e2 = validatePassword(newPassword);
    if (!e2.ok) {
      setError(e2.message);
      return;
    }
    const e3 = validatePasswordConfirmation(confirmPassword, newPassword);
    if (!e3.ok) {
      setError(e3.message);
      return;
    }
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await resetPassword({
        telephone: phoneE164,
        otpCode: otpCode.trim(),
        newPassword,
      });
      setStep('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réinitialisation impossible.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AuthBackdrop colors={colors} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            // Padding bas généreux (comme la page de connexion) : rend le
            // contenu assez haut pour défiler quand le clavier est ouvert.
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 150 },
          ]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={TOP_ENTER} style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth'))}
              hitSlop={6}>
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={TITLE_ENTER}>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              Mot de passe oublié
            </ThemedText>
          </Animated.View>
          <Animated.View entering={SUB_ENTER}>
            <ThemedText style={[styles.sub, { color: colors.textMuted }]}>
            {step === 'phone'
              ? 'Nous enverrons un code de vérification sur\nvotre numéro.'
              : step === 'otp'
                ? 'Saisissez le code reçu et choisissez un\nnouveau mot de passe.'
                : 'Votre mot de passe a été mis à jour.'}
            </ThemedText>
          </Animated.View>

          {step !== 'done' ? (
            <Animated.View entering={STEPPER_ENTER} style={styles.stepperWrap}>
              <FormStepper steps={['Téléphone', 'Code', 'Terminé']} current={stepIndex} colors={colors} />
            </Animated.View>
          ) : null}

          {step === 'done' ? (
            <Animated.View entering={FORM_ENTER} style={[styles.doneCard, { width: formWidth }]}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                style={styles.doneIconWrap}>
                <Check size={30} color="#FFFFFF" strokeWidth={3} />
              </LinearGradient>
              <ThemedText style={[styles.doneTitle, { color: colors.text }]}>
                Mot de passe réinitialisé
              </ThemedText>
              <ThemedText style={[styles.doneSub, { color: colors.textMuted }]}>
                Connectez-vous avec votre nouveau mot de passe.
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.btnWrap, pressed ? styles.pressed : undefined]}
                onPress={() => router.replace('/auth')}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btn}>
                  <ThemedText style={styles.btnText}>Retour à la connexion</ThemedText>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}

          {step !== 'done' ? (
            <>
              <FormErrorBanner
                message={error}
                colors={colors}
                title="Action impossible"
                onDismiss={() => setError(null)}
              />
              {testOtp ? (
                <ThemedText style={[styles.hint, { color: colors.warning }]}>Code test (dev) : {testOtp}</ThemedText>
              ) : null}
            </>
          ) : null}

          {step !== 'done' ? (
            <View style={[styles.formCard, { width: formWidth }]}>
              {step === 'phone' ? (
                <>
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Numéro de téléphone
                    </ThemedText>
                    <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                      <Smartphone size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput
                        style={[styles.inputField, { color: colors.text }]}
                        value={phone}
                        onChangeText={(t) => setPhone(formatPhone(t))}
                        keyboardType="phone-pad"
                        placeholder="+242 06 XXX XX XX"
                        placeholderTextColor={colors.placeholder}
                        returnKeyType="next"
                        onSubmitEditing={() => void handleRequestOtp()}
                      />
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnWrap,
                      loading || !phoneE164 ? styles.btnDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}
                    disabled={loading || !phoneE164}
                    onPress={handleRequestOtp}>
                    <LinearGradient
                      colors={[colors.primary, colors.primaryDeep]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btn}>
                      <ThemedText style={styles.btnText}>
                        {loading ? 'Envoi…' : 'Recevoir le code'}
                      </ThemedText>
                      {!loading ? <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.6} /> : null}
                    </LinearGradient>
                  </Pressable>
                </>
              ) : null}

              {step === 'otp' ? (
                <>
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Code SMS
                    </ThemedText>
                    <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                      <MessageCircle size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput
                        ref={otpRef}
                        style={[styles.inputField, { color: colors.text }]}
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        placeholder="123456"
                        placeholderTextColor={colors.placeholder}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Nouveau mot de passe
                    </ThemedText>
                    <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                      <Lock size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput
                        ref={passwordRef}
                        style={[styles.inputField, { color: colors.text }]}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholder="Minimum 6 caractères"
                        placeholderTextColor={colors.placeholder}
                        returnKeyType="next"
                        onSubmitEditing={() => confirmRef.current?.focus()}
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Confirmer
                    </ThemedText>
                    <View style={[styles.inputCard, { backgroundColor: colors.inputBg }]}>
                      <KeyRound size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput
                        ref={confirmRef}
                        style={[styles.inputField, { color: colors.text }]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholder="Répétez le mot de passe"
                        placeholderTextColor={colors.placeholder}
                        returnKeyType="go"
                        onSubmitEditing={() => void handleReset()}
                      />
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.btnWrap,
                      loading ? styles.btnDisabled : undefined,
                      pressed ? styles.pressed : undefined,
                    ]}
                    disabled={loading}
                    onPress={handleReset}>
                    <LinearGradient
                      colors={[colors.primary, colors.primaryDeep]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btn}>
                      <ThemedText style={styles.btnText}>
                        {loading ? 'Enregistrement…' : 'Réinitialiser'}
                      </ThemedText>
                      {!loading ? <Check size={19} color="#FFFFFF" strokeWidth={2.6} /> : null}
                    </LinearGradient>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20 },
  topRow: { width: '100%', marginTop: 8, marginBottom: 18 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' },
  sub: { textAlign: 'center', marginTop: 8, marginBottom: 20, maxWidth: 340, lineHeight: 21 },
  stepperWrap: { marginBottom: 20 },
  formCard: {
    gap: 4,
    alignItems: 'stretch',
  },
  field: { gap: 8, marginBottom: 14 },
  fieldLabel: { fontSize: 13.5, fontWeight: '700' },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputField: { flex: 1, paddingVertical: 0, fontSize: 16, minHeight: 22 },
  btnWrap: {
    marginTop: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    minHeight: 52,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16.5 },
  hint: { fontWeight: '700', marginBottom: 8, fontSize: 13 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  doneCard: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  doneIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  doneTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  doneSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320, marginBottom: 8 },
});
