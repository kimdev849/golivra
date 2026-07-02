import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ChevronLeft, Eye, EyeOff, Lock, Smartphone, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppContentWidth } from '@/components/app-content-width';
import { ThemeModePicker } from '@/components/theme-mode-picker';
import { BiometricLockToggle } from '@/components/biometric-lock-toggle';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { ThemedText } from '@/components/themed-text';
import { FormErrorBanner } from '@/components/form-error-banner';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { useCourierPalette } from '@/lib/courier-theme';
import { formatPhone, toE164 } from '@/lib/phone';
import { validatePassword, validatePasswordConfirmation, validatePersonName, validatePhone } from '@/lib/form-validation';

type Me = { nom: string | null; telephone: string };

export default function CourierSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const { profile, refresh } = useCourier();

  const [nom, setNom] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState(() => formatPhone(''));

  useEffect(() => {
    if (profile?.utilisateur) {
      setNom(profile.utilisateur.nom ?? '');
      setPhoneDisplay(formatPhone(profile.utilisateur.telephone ?? ''));
    }
  }, [profile]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneE164 = toE164(phoneDisplay);

  const saveProfile = async () => {
    setError(null);
    const e1 = validatePersonName(nom);
    if (!e1.ok) {
      setError(e1.message);
      return;
    }
    const e2 = validatePhone(phoneDisplay);
    if (!e2.ok) {
      setError(e2.message);
      return;
    }
    if (!phoneE164) {
      setError('Numéro invalide.');
      return;
    }
    setSavingProfile(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await apiFetch<Me>('/api/auth/me', {
        method: 'PATCH',
        token,
        jsonBody: { nom: nom.trim(), telephone: phoneE164 },
      });
      await refresh();
      showSuccess('Enregistré !', 'Vos informations personnelles ont été mises à jour.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Enregistrement impossible.';
      setError(msg);
      showError('Enregistrement impossible', msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setError(null);
    if (!currentPassword) {
      setError('Mot de passe actuel requis.');
      return;
    }
    const e1 = validatePassword(newPassword);
    if (!e1.ok) {
      setError(e1.message);
      return;
    }
    const e2 = validatePasswordConfirmation(confirmPassword, newPassword);
    if (!e2.ok) {
      setError(e2.message);
      return;
    }
    setSavingPassword(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        token,
        jsonBody: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Mot de passe mis à jour', 'Utilisez-le lors de votre prochaine connexion.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Modification impossible.';
      setError(msg);
      showError('Modification impossible', msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <FeedbackOverlay />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: palette.card, borderBottomColor: palette.border }]}>
          <Pressable style={[styles.back, { backgroundColor: palette.primarySoft }]} onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: palette.primaryDeep }]}>Mon compte</ThemedText>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
          <AppContentWidth phonePadding={0}>
          <ThemeModePicker
            palette={palette}
            title="Mode clair / sombre"
            hint="L’apparence s’applique à tout l’espace livreur."
          />

          <FormErrorBanner
            message={error}
            colors={{ error: palette.danger, errorSoft: palette.dangerBg }}
            title="Mise à jour impossible"
            onDismiss={() => setError(null)}
          />
          <ThemedText style={[styles.section, { color: palette.primaryDeep }]}>Informations</ThemedText>
          <View style={[styles.group, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Field icon={<User size={18} color={palette.primary} />} label="Nom" value={nom} onChangeText={setNom} palette={palette} />
            <Field
              icon={<Smartphone size={18} color={palette.primary} />}
              label="Téléphone"
              value={phoneDisplay}
              onChangeText={(t) => setPhoneDisplay(formatPhone(t))}
              keyboardType="phone-pad"
              palette={palette}
            />
          </View>
          <Pressable style={[styles.primaryBtn, { backgroundColor: palette.primary }]} onPress={() => void saveProfile()} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <ThemedText style={styles.primaryBtnText}>Enregistrer</ThemedText>
            )}
          </Pressable>

          <ThemedText style={[styles.section, { marginTop: 16, color: palette.primaryDeep }]}>Sécurité</ThemedText>
          <BiometricLockToggle
            colors={{
              primary: palette.primary,
              primaryMuted: palette.primaryMuted,
              primarySoft: palette.primarySoft,
              surfaceElevated: palette.surfaceElevated,
              borderStrong: palette.trackStroke,
              text: palette.text,
              textMuted: palette.muted,
            }}
            cardBackground={palette.card}
            cardBorder={palette.border}
            hint="Au retour sur l’app (optionnel, désactivable à tout moment)"
          />

          <ThemedText style={[styles.section, { marginTop: 16, color: palette.primaryDeep }]}>Mot de passe</ThemedText>
          <View style={[styles.group, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <PwdField label="Actuel" value={currentPassword} onChange={setCurrentPassword} show={showCurrent} toggle={() => setShowCurrent((v) => !v)} palette={palette} />
            <PwdField label="Nouveau" value={newPassword} onChange={setNewPassword} show={showNew} toggle={() => setShowNew((v) => !v)} palette={palette} />
            <PwdField label="Confirmer" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} toggle={() => setShowConfirm((v) => !v)} palette={palette} />
          </View>
          <Pressable style={[styles.secondaryBtn, { borderColor: palette.primary }]} onPress={() => void savePassword()} disabled={savingPassword}>
            {savingPassword ? (
              <ActivityIndicator color={palette.primary} />
            ) : (
              <ThemedText style={[styles.secondaryBtnText, { color: palette.primary }]}>Mettre à jour le mot de passe</ThemedText>
            )}
          </Pressable>
          </AppContentWidth>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  onChangeText,
  keyboardType,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'phone-pad' | 'default';
  palette: ReturnType<typeof useCourierPalette>;
}) {
  return (
    <View style={[styles.field, { borderBottomColor: palette.border }]}>
      <View style={[styles.fieldIcon, { backgroundColor: palette.primarySoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.fieldLabel, { color: palette.muted }]}>{label}</ThemedText>
        <TextInput
          style={[styles.input, { color: palette.text }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor={palette.placeholder}
        />
      </View>
    </View>
  );
}

function PwdField({
  label,
  value,
  onChange,
  show,
  toggle,
  palette,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  show: boolean;
  toggle: () => void;
  palette: ReturnType<typeof useCourierPalette>;
}) {
  return (
    <View style={[styles.field, { borderBottomColor: palette.border }]}>
      <View style={[styles.fieldIcon, { backgroundColor: palette.primarySoft }]}>
        <Lock size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.fieldLabel, { color: palette.muted }]}>{label}</ThemedText>
        <View style={styles.pwdRow}>
          <TextInput
            style={[styles.input, { flex: 1, color: palette.text }]}
            value={value}
            onChangeText={onChange}
            secureTextEntry={!show}
            placeholderTextColor={palette.placeholder}
          />
          <Pressable onPress={toggle} hitSlop={10}>
            {show ? (
              <EyeOff size={20} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
            ) : (
              <Eye size={20} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '800', fontSize: 17 },
  scroll: { padding: 16, gap: 10 },
  section: { fontWeight: '900', fontSize: 14, marginBottom: 4 },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  field: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  input: { fontSize: 16, padding: 0 },
  pwdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryBtnText: { fontWeight: '800' },
  ok: { padding: 12, borderRadius: 12, borderWidth: 1 },
  okText: { fontWeight: '600' },
});
