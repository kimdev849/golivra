import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from '@/hooks/use-safe-router';
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
import { Camera, ChevronLeft, ChevronRight, MapPin, Smartphone, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FormErrorBanner } from '@/components/form-error-banner';
import { FormSuccessBanner } from '@/components/form-success-banner';
import { InlineFormError } from '@/components/inline-form-error';
import { LUCIDE_STROKE } from '@/constants/icons';
import { pickVendorImageAsset } from '@/components/vendor-form-shared';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { patchAuthMeCache } from '@/lib/client-data';
import { resolveRemoteImageUrl } from '@/lib/images';
import { formatPhone, toE164 } from '@/lib/phone';
import { uploadImageBase64 } from '@/lib/uploads';
import { validatePersonName, validatePhone } from '@/lib/form-validation';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';

type Me = {
  id: string;
  nom: string | null;
  telephone: string;
  image_url?: string | null;
  imageUrl?: string | null;
};

export default function ProfileEditScreen() {
  const router = useRouter();
  const guarded = useGuardedCallback();
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState(() => formatPhone(''));

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    setError(null);
    setProfileOk(null);
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        // Invité : rediriger vers la connexion au lieu du faux
        // message « Session expirée » (F-AUTH-01).
        router.replace('/auth');
        return;
      }
      const data = await apiFetch<Me>('/api/auth/me', { method: 'GET', token });
      setNom(data.nom?.trim() ?? '');
      setPhoneDisplay(formatPhone(data.telephone ?? ''));
      setAvatarUri(resolveRemoteImageUrl(data.imageUrl ?? data.image_url));
      setAvatarDataUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      next.phone = 'Ce numéro ne semble pas complet. Vérifiez-le, par exemple +242 06 123 45 67.';
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

  const bottomPad = Math.max(insets.bottom, 12) + 28;

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
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
            Mon profil
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
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

              {/* ── Photo de profil ── */}
              <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }]}>Photo de profil</ThemedText>
              <View style={styles.avatarBlock}>
                <Pressable style={[styles.avatarCircle, { backgroundColor: colors.primarySoft, borderColor: avatarDataUrl ? colors.primary : colors.borderStrong }]} onPress={() => guarded(() => void pickPhoto())}>
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
                        onPress={() => setAvatarDataUrl(null)}>
                        <ThemedText style={[styles.photoCancelTxt, { color: colors.textSecondary }]}>Annuler</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.photoSaveBtn, { backgroundColor: colors.primary }, savingPhoto && styles.btnDisabled]}
                        onPress={() => guarded(() => void savePhoto())}
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
                  <ThemedText style={[styles.photoHint, { color: colors.textMuted }]}>
                    {avatarUri ? 'Touchez la photo pour la modifier' : 'Ajoutez une photo pour personnaliser votre compte'}
                  </ThemedText>
                )}
              </View>

              {/* ── Informations personnelles ── */}
              <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }]}>Informations personnelles</ThemedText>
              <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cell}>
                  <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                    <User size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <View style={styles.cellBody}>
                    <ThemedText style={[styles.cellLabel, { color: colors.textMuted }]}>Nom complet</ThemedText>
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
                onPress={() => guarded(() => void saveProfile())}
                disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.primaryBtnText}>Enregistrer</ThemedText>
                )}
              </Pressable>

              {/* ── Adresse de livraison ── */}
              <ThemedText style={[styles.sectionHeader, { color: colors.textMuted }, styles.sectionSpaced]}>Livraison</ThemedText>
              <Pressable
                style={({ pressed }) => [styles.linkRow, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { backgroundColor: colors.primarySoft }]}
                onPress={() => router.push('/my-addresses')}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.cellIcon, { backgroundColor: colors.primarySoft }]}>
                  <MapPin size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={styles.cellBody}>
                  <ThemedText style={[styles.linkTitle, { color: colors.text }]}>Adresses de livraison</ThemedText>
                  <ThemedText style={[styles.linkSub, { color: colors.textMuted }]}>Ajoutez un lieu pour recevoir vos commandes</ThemedText>
                </View>
                <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
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
  sectionSpaced: { marginTop: 22 },
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
  photoSaveBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  photoSaveTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  photoHint: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  photoBtnRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  photoCancelBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  photoCancelTxt: { fontWeight: '700', fontSize: 14 },
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
  cellIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cellBody: { flex: 1, minWidth: 0 },
  cellLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  cellInput: {
    fontSize: 17,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    paddingHorizontal: 0,
  },
  insetSep: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
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
  btnDisabled: { opacity: 0.65 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkTitle: { fontSize: 15, fontWeight: '700' },
  linkSub: { fontSize: 12, marginTop: 2 },
});
