import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
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
import { Camera, ChevronLeft, Eye, EyeOff, Lock, Smartphone, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FormErrorBanner } from '@/components/form-error-banner';
import { FormSuccessBanner } from '@/components/form-success-banner';
import { BiometricLockToggle } from '@/components/biometric-lock-toggle';
import { DeleteAccountSection } from '@/components/delete-account-section';
import { InlineFormError } from '@/components/inline-form-error';
import { LUCIDE_STROKE } from '@/constants/icons';
import { pickVendorImageAsset } from '@/components/vendor-form-shared';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { patchAuthMeCache } from '@/lib/client-data';
import { resolveRemoteImageUrl } from '@/lib/images';
import { formatPhone, toE164 } from '@/lib/phone';
import { isMerchantRole } from '@/lib/roles';
import { uploadImageBase64 } from '@/lib/uploads';
import { validatePassword, validatePasswordConfirmation, validatePersonName, validatePhone } from '@/lib/form-validation';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Me = {
  id: string;
  nom: string | null;
  telephone: string;
  role?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  cree_le?: string | null;
};

export default function AccountSettingsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const isMerchant = isMerchantRole(role);
  const [nom, setNom] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState(() => formatPhone(''));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    setError(null);
    setProfileOk(null);
    setPasswordOk(null);
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const data = await apiFetch<Me>('/api/auth/me', { method: 'GET', token });
      setRole(data.role ?? null);
      setNom(data.nom?.trim() ?? '');
      setPhoneDisplay(formatPhone(data.telephone ?? ''));
      setAvatarUri(resolveRemoteImageUrl(data.imageUrl ?? data.image_url));
      setAvatarDataUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const phoneE164 = toE164(phoneDisplay);

  const pickPhoto = async () => {
    const asset = await pickVendorImageAsset();
    if (!asset) return;
    setAvatarUri(asset.uri);
    setAvatarDataUrl(asset.dataUrl);
  };

  const savePhoto = async () => {
    if (!avatarDataUrl) return;
    setSavingPhoto(true);
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const up = await uploadImageBase64(token, { dataUrl: avatarDataUrl, folder: 'profiles' });
      const updated = await apiFetch<Me>('/api/auth/me', { method: 'PATCH', token, jsonBody: { imageUrl: up.url } });
      patchAuthMeCache(token, { ...updated, imageUrl: up.url, image_url: up.url });
      setAvatarUri(up.url);
      setAvatarDataUrl(null);
      setProfileOk('Photo de profil mise à jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de mettre à jour la photo.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const saveProfile = async () => {
    setError(null);
    setProfileOk(null);
    setFieldErrors({});
    const next: Record<string, string | null> = {};
    const e1 = validatePersonName(nom);
    if (!e1.ok) {
      next.nom = e1.message;
      setFieldErrors(next);
      return;
    }
    const cleanedNom = e1.value;
    setNom(cleanedNom);
    const e2 = validatePhone(phoneDisplay);
    if (!e2.ok) {
      next.phone = e2.message;
      setFieldErrors(next);
      return;
    }
    if (!phoneE164) {
      next.phone = 'Numéro de téléphone invalide.';
      setFieldErrors(next);
      return;
    }

    setSavingProfile(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const updated = await apiFetch<Me>('/api/auth/me', {
        method: 'PATCH',
        token,
        jsonBody: { nom: cleanedNom, telephone: phoneE164 },
      });
      patchAuthMeCache(token, { ...updated, nom: cleanedNom, telephone: phoneE164 });
      setError(null);
      setProfileOk('Informations enregistrées.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setError(null);
    setPasswordOk(null);
    setFieldErrors({});
    if (!currentPassword) {
      setFieldErrors({ currentPassword: 'Saisissez votre mot de passe actuel.' });
      return;
    }
    const e1 = validatePassword(newPassword);
    if (!e1.ok) {
      setFieldErrors({ newPassword: e1.message });
      return;
    }
    const e2 = validatePasswordConfirmation(confirmPassword, newPassword);
    if (!e2.ok) {
      setFieldErrors({ confirmPassword: e2.message });
      return;
    }

    setSavingPassword(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        token,
        jsonBody: {
          currentPassword,
          newPassword,
        },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setPasswordOk('Mot de passe mis à jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setSavingPassword(false);
    }
  };

  const bottomPad = Math.max(insets.bottom, 12) + 28;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Pressable
            style={[styles.backBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour">
            <ChevronLeft size={26} color={isDark ? colors.primaryBright : colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
          <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.text }]}>
            {isMerchant ? 'Connexion & sécurité' : 'Connexion & sécurité'}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} size="large" />
              <ThemedText style={[styles.muted, { color: colors.textMuted }]}>Chargement…</ThemedText>
            </View>
          ) : (
            <>
              <FormErrorBanner
                message={error}
                colors={colors}
                title="Mise à jour impossible"
                onDismiss={() => setError(null)}
              />
              <FormSuccessBanner
                message={profileOk}
                colors={colors}
                title="Profil mis à jour"
                onDismiss={() => setProfileOk(null)}
              />
              <FormSuccessBanner
                message={passwordOk}
                colors={colors}
                title="Sécurité renforcée"
                onDismiss={() => setPasswordOk(null)}
              />

              {!isMerchant ? (
                <>
                  <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }]}>Photo de profil</ThemedText>
                  <View style={styles.avatarBlock}>
                    <Pressable style={[styles.avatarCircle, { backgroundColor: colors.primarySoft, borderColor: avatarDataUrl ? colors.primary : colors.borderStrong }]} onPress={() => void pickPhoto()}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImg} contentFit="cover" />
                      ) : (
                        <User size={32} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      )}
                      <View style={[styles.avatarCam, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Camera size={16} color={colors.textSecondary} strokeWidth={LUCIDE_STROKE} />
                      </View>
                    </Pressable>
                    {avatarDataUrl ? (
                      <>
                        <ThemedText style={[styles.photoHint, { color: colors.success }]}>✓ Nouvelle photo sélectionnée</ThemedText>
                        <View style={styles.photoBtnRow}>
                          <Pressable
                            style={[styles.photoCancelBtn, { borderColor: colors.border }]}
                            onPress={() => { setAvatarDataUrl(null); }}>
                            <ThemedText style={[styles.photoCancelTxt, { color: colors.textSecondary }]}>Annuler</ThemedText>
                          </Pressable>
                          <Pressable
                            style={[styles.photoSaveBtn, { backgroundColor: colors.primary }, savingPhoto && styles.btnDisabled]}
                            onPress={() => void savePhoto()}
                            disabled={savingPhoto}>
                            {savingPhoto ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <ThemedText style={styles.photoSaveTxt}>Enregistrer la photo</ThemedText>
                            )}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <ThemedText style={[styles.photoHint, { color: colors.textMuted }]}>Touchez la photo pour la modifier</ThemedText>
                    )}
                  </View>

                  <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }]}>Informations personnelles</ThemedText>
                  <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.cell}>
                      <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                        <User size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      </View>
                      <View style={styles.cellBody}>
                        <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Nom</ThemedText>
                        <TextInput
                          style={[styles.cellInput, { color: colors.text }]}
                          value={nom}
                          onChangeText={setNom}
                          placeholder="Votre nom"
                          placeholderTextColor={colors.placeholder}
                          autoCapitalize="words"
                        />
                        <InlineFormError message={fieldErrors.nom} colors={colors} />
                      </View>
                    </View>
                    <View style={[styles.insetSep, { backgroundColor: colors.border }]} />
                    <View style={styles.cell}>
                      <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                        <Smartphone size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                      </View>
                      <View style={styles.cellBody}>
                        <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Téléphone</ThemedText>
                        <TextInput
                          style={[styles.cellInput, { color: colors.text }]}
                          value={phoneDisplay}
                          onChangeText={(t) => setPhoneDisplay(formatPhone(t))}
                          placeholder="+242 …"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="phone-pad"
                        />
                        <InlineFormError message={fieldErrors.phone} colors={colors} />
                      </View>
                    </View>
                  </View>

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }, savingProfile && styles.btnDisabled]}
                    onPress={() => void saveProfile()}
                    disabled={savingProfile}>
                    {savingProfile ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.primaryBtnText}>Enregistrer</ThemedText>
                    )}
                  </Pressable>
                </>
              ) : null}

              <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }, styles.sectionSpaced]}>Sécurité</ThemedText>
              <BiometricLockToggle
                colors={colors}
                cardBackground={colors.surface}
                cardBorder={colors.border}
                hint="Au retour sur l’app (optionnel, désactivable à tout moment)"
              />
              <ThemedText style={[styles.sectionHint, { color: colors.textMuted }]}>Saisissez votre mot de passe actuel pour en définir un nouveau.</ThemedText>

              <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.cell, styles.cellMultiline]}>
                  <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                    <Lock size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <View style={styles.cellBody}>
                    <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Mot de passe actuel</ThemedText>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.cellInput, styles.inputFlex, { color: colors.text }]}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="••••••••"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showCurrent}
                      />
                      <Pressable onPress={() => setShowCurrent((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                        {showCurrent ? (
                          <EyeOff size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        ) : (
                          <Eye size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        )}
                      </Pressable>
                    </View>
                    <InlineFormError message={fieldErrors.currentPassword} colors={colors} />
                  </View>
                </View>
                <View style={[styles.insetSep, { backgroundColor: colors.border }]} />
                <View style={[styles.cell, styles.cellMultiline]}>
                  <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                    <Lock size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <View style={styles.cellBody}>
                    <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Nouveau mot de passe</ThemedText>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.cellInput, styles.inputFlex, { color: colors.text }]}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Au moins 6 caractères"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showNew}
                      />
                      <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                        {showNew ? (
                          <EyeOff size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        ) : (
                          <Eye size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        )}
                      </Pressable>
                    </View>
                    <InlineFormError message={fieldErrors.newPassword} colors={colors} />
                  </View>
                </View>
                <View style={[styles.insetSep, { backgroundColor: colors.border }]} />
                <View style={[styles.cell, styles.cellMultiline]}>
                  <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                    <Lock size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <View style={styles.cellBody}>
                    <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Confirmer</ThemedText>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.cellInput, styles.inputFlex, { color: colors.text }]}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirmer le nouveau mot de passe"
                        placeholderTextColor={colors.placeholder}
                        secureTextEntry={!showConfirm}
                      />
                      <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
                        {showConfirm ? (
                          <EyeOff size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        ) : (
                          <Eye size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                        )}
                      </Pressable>
                    </View>
                    <InlineFormError message={fieldErrors.confirmPassword} colors={colors} />
                  </View>
                </View>
              </View>

              <Pressable
                style={[styles.secondaryBtn, { borderColor: colors.primary, backgroundColor: colors.surface }, savingPassword && styles.btnDisabled]}
                onPress={() => void savePassword()}
                disabled={savingPassword}>
                {savingPassword ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <ThemedText style={[styles.secondaryBtnText, { color: isDark ? colors.primaryBright : colors.primaryDeep }]}>Mettre à jour le mot de passe</ThemedText>
                )}
              </Pressable>

              <DeleteAccountSection />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  loader: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  muted: { fontSize: 14 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  avatarBlock: { alignItems: 'center', marginBottom: 20, gap: 12 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  avatarImg: { width: 96, height: 96 },
  avatarCam: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
  },
  photoSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  photoSaveTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  photoHint: { fontSize: 13, fontWeight: '700' },
  photoBtnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  photoCancelBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  photoCancelTxt: { fontWeight: '700', fontSize: 14 },
  sectionSpaced: { marginTop: 22 },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginLeft: 4,
  },
  groupCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
  },
  cellMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  cellIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cellBody: { flex: 1, minWidth: 0 },
  cellLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cellInput: {
    fontSize: 17,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    paddingHorizontal: 0,
  },
  insetSep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 58,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: { flex: 1 },
  eyeBtn: { padding: 4 },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },
  secondaryBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.65 },
});
