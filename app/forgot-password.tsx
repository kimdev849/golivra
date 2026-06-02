import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resetPassword } from '@/lib/auth';
import { requestOtp } from '@/lib/otp';
import { formatCgPhone, toCgE164 } from '@/lib/phone';
import { validateOtp, validatePassword, validatePasswordConfirmation, validatePhoneCg } from '@/lib/form-validation';

type Step = 'phone' | 'otp' | 'done';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
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

  const phoneE164 = toCgE164(phone);

  const handleRequestOtp = async () => {
    setError(null);
    const e = validatePhoneCg(phone);
    if (!e.ok) {
      setError(e.message);
      return;
    }
    if (!phoneE164) {
      setError('Numéro invalide.');
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(phoneE164);
      setTestOtp(res.testMode && res.otpCode ? res.otpCode : null);
      setStep('otp');
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
    try {
      await resetPassword({
        telephone: phoneE164,
        otpCode: otpCode.trim(),
        newPassword,
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réinitialisation impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
          <ThemedText type="title" style={[styles.title, { color: isDark ? colors.primaryBright : colors.primaryDeep }]}>
            Mot de passe oublié
          </ThemedText>
          <ThemedText style={[styles.sub, { color: colors.textMuted }]}>
            {step === 'phone'
              ? 'Nous enverrons un code de vérification sur votre numéro.'
              : step === 'otp'
                ? 'Saisissez le code reçu et choisissez un nouveau mot de passe.'
                : 'Votre mot de passe a été mis à jour.'}
          </ThemedText>

          {error ? (
            <ThemedText style={[styles.errorText, { color: colors.error, backgroundColor: colors.errorSoft, borderColor: colors.border }]}>
              {error}
            </ThemedText>
          ) : null}
          {testOtp ? (
            <ThemedText style={[styles.hint, { color: colors.warning }]}>Code test (dev) : {testOtp}</ThemedText>
          ) : null}

          <View style={[styles.formCard, { width: formWidth, borderColor: colors.border, backgroundColor: colors.surface }]}>
            {step === 'phone' ? (
              <>
                <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Téléphone</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
                  value={phone}
                  onChangeText={(t) => setPhone(formatCgPhone(t))}
                  keyboardType="phone-pad"
                  placeholder="+242 06 XXX XX XX"
                  placeholderTextColor={colors.placeholder}
                />
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
                  disabled={loading || !phoneE164}
                  onPress={handleRequestOtp}>
                  <ThemedText style={styles.btnText}>{loading ? 'Envoi…' : 'Recevoir le code'}</ThemedText>
                </Pressable>
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Code SMS</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  placeholder="123456"
                  placeholderTextColor={colors.placeholder}
                />
                <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Nouveau mot de passe</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor={colors.placeholder}
                />
                <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Confirmer</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.inputBorder, color: colors.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={colors.placeholder}
                />
                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
                  disabled={loading}
                  onPress={handleReset}>
                  <ThemedText style={styles.btnText}>{loading ? 'Enregistrement…' : 'Réinitialiser'}</ThemedText>
                </Pressable>
              </>
            ) : null}

            {step === 'done' ? (
              <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/auth')}>
                <ThemedText style={styles.btnText}>Retour à la connexion</ThemedText>
              </Pressable>
            ) : null}
          </View>

          <Link href="/auth" asChild>
            <Pressable style={styles.backLink}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <ThemedText style={[styles.backText, { color: colors.primary }]}>Retour</ThemedText>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20 },
  title: { fontWeight: '800', marginBottom: 8 },
  sub: { textAlign: 'center', marginBottom: 16, maxWidth: 340 },
  formCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  inputLabel: { fontSize: 12, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  errorText: {
    fontWeight: '700',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: 400,
  },
  hint: { fontWeight: '700', marginBottom: 8 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  backText: { fontWeight: '800' },
});
