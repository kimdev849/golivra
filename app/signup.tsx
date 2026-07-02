import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
import * as ImagePicker from 'expo-image-picker';

import { CategoryPicker } from '@/components/category-picker';
import { FormErrorBanner } from '@/components/form-error-banner';
import { InlineFormError } from '@/components/inline-form-error';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { brandGradient3 } from '@/constants/app-palette';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerAccount, registerVendorAccount, persistAuthSession } from '@/lib/auth';
import { fetchEnterpriseCategories, type EnterpriseCategory } from '@/lib/enterprise';
import { requestOtp } from '@/lib/otp';
import { formatPhone, toE164 } from '@/lib/phone';
import { uploadImageForSignup } from '@/lib/uploads';
import { VENDOR_HREF } from '@/lib/vendor-nav';
import { friendlyErrorMessage } from '@/lib/ux-copy';
import { validateAddress, validateCommerceName, validateDescription, validateOtp, validatePassword, validatePersonName, validatePhone } from '@/lib/form-validation';

type Profile = 'client' | 'vendeur';
type CommerceKind = 'restaurant' | 'boutique';
type SignupVariant = 'default' | CommerceKind;
type BaseProps = { variant: SignupVariant; forcedProfile?: Profile };

function commerceCopy(kind: CommerceKind) {
  if (kind === 'restaurant') {
    return {
      screenTitle: 'Votre restaurant', lead: 'Renseignez une fiche simple et claire pour que les clients vous trouvent vite.',
      nameLabel: 'Nom du restaurant', namePlaceholder: 'Ex. : Le Palmier', phoneLabel: 'Téléphone du restaurant',
      addressLabel: 'Adresse', addressPlaceholder: 'Quartier, rue, point de repère…', descriptionPlaceholder: 'Spécialités, ambiance, horaires…',
      detailsLabel: 'Type de cuisine', detailsPlaceholder: 'Choisissez une catégorie', imageLabel: 'Photo du restaurant (optionnel)',
    };
  }
  return {
    screenTitle: 'Votre boutique', lead: 'Renseignez une fiche simple et claire pour que les clients vous trouvent vite.',
    nameLabel: 'Nom de la boutique', namePlaceholder: 'Ex. : Mode & Co', phoneLabel: 'Téléphone de la boutique',
    addressLabel: 'Adresse (optionnelle)', addressPlaceholder: 'Laissez vide pour une boutique en ligne', descriptionPlaceholder: 'Univers, produits phares, services…',
    detailsLabel: 'Catégorie de la boutique', detailsPlaceholder: 'Choisissez une catégorie', imageLabel: 'Photo de la boutique (optionnel)',
  };
}

function headerCopy(variant: SignupVariant) {
  if (variant === 'restaurant') return { title: 'Créer un compte', description: 'Type de compte : Restaurant' };
  if (variant === 'boutique') return { title: 'Créer un compte', description: 'Type de compte : Boutique' };
  return { title: 'Créer un compte', description: 'Type de compte : Client' };
}

function SignupScreenBase({ variant, forcedProfile }: BaseProps) {
  const router = useRouter();
  const colors = useAppColors();
  const { showSuccess, FeedbackOverlay } = useActionFeedback();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile>(forcedProfile ?? (variant === 'default' ? 'client' : 'vendeur'));
  const [commerceKind, setCommerceKind] = useState<CommerceKind | null>(variant === 'default' ? null : variant);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+242 ');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [profileImageDataUrl, setProfileImageDataUrl] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ pays: null, ville: null });
  const phoneIndicatif = location.pays?.indicatif || '+242';
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessCategoryId, setBusinessCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<EnterpriseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [businessImageDataUrl, setBusinessImageDataUrl] = useState<string | null>(null);
  const [businessImageUrl, setBusinessImageUrl] = useState<string | null>(null);
  const [businessImagePreview, setBusinessImagePreview] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [testOtpCode, setTestOtpCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const signupDoneRef = useRef(false);
  const formWidth = Math.min(width - 40, 460);
  const phoneE164 = toE164(phone);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (variant !== 'default') return;
    if (forcedProfile === 'client') { setCommerceKind(null); setProfile('client'); return; }
    if (profile === 'client') setCommerceKind(null);
  }, [forcedProfile, profile, variant]);

  useEffect(() => {
    if (profile !== 'vendeur' || !commerceKind) { setCategories([]); setBusinessCategoryId(null); return; }
    let alive = true;
    setCategoriesLoading(true);
    fetchEnterpriseCategories(commerceKind)
      .then((list) => { if (!alive) return; setCategories(list); })
      .catch(() => { if (!alive) return; setCategories([]); })
      .finally(() => { if (alive) setCategoriesLoading(false); });
    return () => { alive = false; };
  }, [profile, commerceKind]);

  const selectedCategory = categories.find((c) => c.id === businessCategoryId) ?? null;

  const validateAccountForOtp = (): string | null => {
    const next: Record<string, string | null> = {};
    if (profile === 'client') {
      const e1 = validatePersonName(fullName);
      if (!e1.ok) { next.fullName = e1.message; setFieldErrors(next); return e1.message; }
    } else {
      next.fullName = null;
    }
    const e2 = validatePhone(phone, phoneIndicatif);
    if (!e2.ok) { next.phone = e2.message; setFieldErrors(next); return e2.message; }
    if (!phoneE164) { next.phone = 'Numéro invalide.'; setFieldErrors(next); return 'Numéro invalide.'; }
    next.phone = null;
    const e3 = validatePassword(password);
    if (!e3.ok) { next.password = e3.message; setFieldErrors(next); return e3.message; }
    next.password = null;
    if (profile === 'vendeur' && !commerceKind) return 'Choisissez restaurant ou boutique.';
    if (profile === 'vendeur') {
      const e4 = validateCommerceName(businessName);
      if (!e4.ok) { next.businessName = e4.message; setFieldErrors(next); return e4.message; }
      next.businessName = null;
      if (!businessCategoryId) return 'Sélectionnez une catégorie.';
      if (commerceKind === 'restaurant') {
        const e5 = validateAddress(businessAddress, true);
        if (!e5.ok) { next.businessAddress = e5.message; setFieldErrors(next); return e5.message; }
      }
      next.businessAddress = null;
      const e6 = validateDescription(businessDescription, 500);
      if (!e6.ok) { next.businessDescription = e6.message; setFieldErrors(next); return e6.message; }
      next.businessDescription = null;
    }
    setFieldErrors({});
    return null;
  };

  const canSendOtp = !isSubmitting && !otpSent && Boolean(phoneE164) && Boolean(password) && password.length >= 6 && (profile === 'vendeur' || Boolean(fullName.trim()));
  const canVerifyOtp = !isSubmitting && otpSent && Boolean(otp.trim()) && otp.trim().length >= 4;

  const handleSendOtp = async () => {
    setError(null);
    const v = validateAccountForOtp();
    if (v) { setError(v); return; }
    setIsSubmitting(true);
    try {
      const otpResult = await requestOtp(phoneE164!);
      setTestOtpCode(otpResult.testMode && otpResult.otpCode ? otpResult.otpCode : null);
      setOtpSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d\'envoyer le code.'); }
    finally { setIsSubmitting(false); }
  };

  const pickImage = async (folder: 'profiles' | 'enterprises') => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Autorisation refusée: accès aux photos requis.'); return null; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, base64: true, allowsEditing: false, selectionLimit: 1 });
      if (result.canceled) return null;
      const asset = result.assets?.[0];
      if (!asset?.base64) { setError("Impossible de lire l'image sélectionnée."); return null; }
      const mime = asset.mimeType || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      return { previewUri: asset.uri, dataUrl };
    } catch (e) { setError(e instanceof Error ? e.message : "Impossible de choisir l'image."); return null; }
  };

  const handleVerifyAndRegister = async () => {
    if (signupDoneRef.current) return;
    setError(null);
    if (!otpSent) { setError('Demandez d’abord le code par SMS.'); return; }
    const otpCheck = validateOtp(otp);
    if (!otpCheck.ok) { setError(otpCheck.message); return; }
    const v = validateAccountForOtp();
    if (v) { setError(v); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const userNom = profile === 'vendeur' ? businessName.trim() : fullName.trim();
      let finalProfileImageUrl = profileImageUrl;
      let finalBusinessImageUrl = businessImageUrl;
      if (profileImageDataUrl) { finalProfileImageUrl = await uploadImageForSignup(null, { dataUrl: profileImageDataUrl, folder: 'profiles' }); }
      if (profile === 'vendeur' && businessImageDataUrl) {
        try { finalBusinessImageUrl = await uploadImageForSignup(null, { dataUrl: businessImageDataUrl, folder: 'enterprises' }); }
        catch { finalBusinessImageUrl = null; }
      }

      if (profile === 'vendeur') {
        if (!commerceKind) { setError("Type de commerce introuvable."); return; }
        const trimmedAddress = businessAddress.trim();
        const result = await registerVendorAccount({
          nom: userNom,
          telephone: phoneE164!,
          motDePasse: password,
          otpCode: otp.trim(),
          role: commerceKind === 'restaurant' ? 'restaurateur' : 'commercant',
          imageUrl: finalProfileImageUrl || null,
          pays_id: location.pays?.id || null,
          ville_id: location.ville?.id || null,
          enterprise: {
            type: commerceKind,
            nom: businessName.trim(),
            telephone: phoneE164!,
            categorieId: businessCategoryId!,
            description: businessDescription.trim() || null,
            ...(commerceKind === 'restaurant' || trimmedAddress ? { adresse: trimmedAddress } : {}),
            imageUrl: finalBusinessImageUrl || null,
            imageDataUrl: !finalBusinessImageUrl && businessImageDataUrl ? businessImageDataUrl : undefined,
          },
        });
        if (!result?.token) {
          throw new Error('Compte créé mais session invalide. Connectez-vous avec votre numéro et mot de passe.');
        }
        const { enterprise: _ent, ...session } = result;
        await persistAuthSession(session);
        signupDoneRef.current = true;
        if (profileImageDataUrl && !finalProfileImageUrl) {
          void uploadImageForSignup(session.token, { dataUrl: profileImageDataUrl, folder: 'profiles' })
            .catch(() => undefined);
        }
        showSuccess(
          'Compte créé',
          'Votre commerce est en attente de validation. Vous pouvez préparer votre menu ou vos produits. Les clients le verront dès qu’il sera activé.',
          { primaryLabel: 'Continuer', onPrimary: () => router.replace(VENDOR_HREF.root) },
        );
        return;
      }

      const session = await registerAccount({
        nom: userNom, telephone: phoneE164!, motDePasse: password, otpCode: otp.trim(), imageUrl: finalProfileImageUrl || null,
        role: 'client',
        pays_id: location.pays?.id || null,
        ville_id: location.ville?.id || null,
      });
      if (!session?.token) {
        throw new Error('Compte créé mais session invalide. Connectez-vous avec votre numéro et mot de passe.');
      }
      await persistAuthSession(session);
      signupDoneRef.current = true;
      if (profileImageDataUrl && !finalProfileImageUrl) {
        void uploadImageForSignup(session.token, { dataUrl: profileImageDataUrl, folder: 'profiles' })
          .catch(() => undefined);
      }
      showSuccess('Compte créé', 'Bienvenue sur GoLivra !', {
        primaryLabel: 'Explorer',
        onPrimary: () => router.replace('/(tabs)'),
      });
    } catch (e) {
      if (signupDoneRef.current) return;
      const reqId = (e as { requestId?: string })?.requestId;
      const rawMsg = e instanceof Error ? e.message : String(e);
      const lower = rawMsg.toLowerCase();
      if (lower.includes('déjà enregistré') || lower.includes('deja enregistre')) {
        setError('Ce numéro est déjà inscrit. Connectez-vous avec votre mot de passe.');
        return;
      }
      const msg = friendlyErrorMessage(e, 'La création du compte a échoué.');
      if (__DEV__) {
        console.warn('[signup] échec inscription', { reqId, message: msg });
      }
      setError(reqId ? `${msg} (ref. ${reqId.slice(0, 8)})` : msg);
    }
    finally { setIsSubmitting(false); }
  };

  const resetOtpFlow = () => { setOtpSent(false); setOtp(''); setTestOtpCode(null); setError(null); };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <FeedbackOverlay />
      <View style={[styles.heroGlow, { backgroundColor: colors.heroGlow }]} />
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView contentContainerStyle={[styles.scrollContent, Platform.OS === 'android' ? styles.scrollContentAndroid : undefined, keyboardVisible ? styles.scrollContentWithKeyboard : undefined]} keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { backgroundColor: colors.background }]}>
            <View style={styles.headerTopRow}>
              <Pressable style={styles.backButton} onPress={() => router.replace('/auth')}>
                <MaterialIcons name="arrow-back-ios-new" size={18} color={colors.primary} />
                <ThemedText style={[styles.backButtonText, { color: colors.primary }]}>Retour</ThemedText>
              </Pressable>
            </View>
            <View style={[styles.logoBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Image source={require('@/assets/images/logo25292922882.png')} style={styles.appIcon} contentFit="contain" />
            </View>
            <ThemedText type="title">{headerCopy(variant).title}</ThemedText>
            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>{headerCopy(variant).description}</ThemedText>
          </View>

          <View style={[styles.formPage, { width }]}>
            <View style={[styles.formCard, { width: formWidth, borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={[styles.cardAccent, { backgroundColor: colors.primary }]} />
              <FormErrorBanner
                message={error}
                colors={colors}
                title="Inscription impossible"
                onDismiss={() => setError(null)}
              />

              {profile === 'client' ? (
                <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                  <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                    <MaterialIcons name="person" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.inputBody}>
                    <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom complet</ThemedText>
                    <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Ex. : Jean Claude" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={fullName} editable={!otpSent} onChangeText={setFullName} />
                    <InlineFormError message={fieldErrors.fullName} colors={colors} />
                  </View>
                </View>
              ) : null}

              <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                  <MaterialIcons name="call" size={18} color={colors.primary} />
                </View>
                <View style={styles.inputBody}>
                  <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Numéro de téléphone</ThemedText>
                  <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="+242 06 XXX XX XX" keyboardType="phone-pad" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={phone} editable={!otpSent} autoCapitalize="none" autoCorrect={false} onChangeText={(text) => setPhone(formatPhone(text, phoneIndicatif))} />
                  <InlineFormError message={fieldErrors.phone} colors={colors} />
                </View>
              </View>

              <ThemedText style={[styles.formHint, { color: colors.textMuted }]}>Un code de vérification sera envoyé par SMS.</ThemedText>

              {/* Localisation (Pays / Ville) pour tous les profils */}
              <ThemedText style={[styles.sectionTitle, { color: colors.primary, marginTop: 8 }]}>Localisation</ThemedText>
              <LocationPicker
                value={location}
                onChange={setLocation}
                autoDetect
                disabled={otpSent}
                compact
              />

              {profile === 'vendeur' && forcedProfile !== 'client' && commerceKind ? (() => {
                const c = commerceCopy(commerceKind);
                return (
                  <>
                    <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                      <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                        <MaterialIcons name={commerceKind === 'restaurant' ? 'restaurant' : 'storefront'} size={18} color={colors.primary} />
                      </View>
                      <View style={styles.inputBody}>
                        <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>{commerceKind === 'restaurant' ? 'Nom du restaurant' : 'Nom du business'}</ThemedText>
                        <TextInput style={[styles.inputField, { color: colors.text }]} placeholder={c.namePlaceholder} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={businessName} editable={!otpSent} onChangeText={setBusinessName} />
                        <InlineFormError message={fieldErrors.businessName} colors={colors} />
                      </View>
                    </View>

                    <Pressable disabled={otpSent || categoriesLoading} style={({ pressed }) => [styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }, pressed ? styles.buttonPressed : undefined, otpSent || categoriesLoading ? styles.buttonDisabled : undefined]} onPress={() => setCategoryPickerOpen(true)}>
                      <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                        <MaterialIcons name="category" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.inputBody}>
                        <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>{c.detailsLabel}</ThemedText>
                        <ThemedText style={[styles.inputField, { color: selectedCategory ? colors.text : colors.textMuted }]}>
                          {categoriesLoading ? 'Chargement des catégories…' : selectedCategory?.nom || c.detailsPlaceholder}
                        </ThemedText>
                      </View>
                      <MaterialIcons name="expand-more" size={22} color={colors.textMuted} />
                    </Pressable>

                    <CategoryPicker visible={categoryPickerOpen} title={c.detailsLabel} categories={categories} selectedId={businessCategoryId} onSelect={(cat) => setBusinessCategoryId(cat.id)} onClose={() => setCategoryPickerOpen(false)} />

                    <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                      <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                        <MaterialIcons name="description" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.inputBody}>
                        <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Description (optionnel)</ThemedText>
                        <TextInput style={[styles.inputField, { color: colors.text }]} placeholder={c.descriptionPlaceholder} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={businessDescription} editable={!otpSent} onChangeText={setBusinessDescription} multiline />
                        <InlineFormError message={fieldErrors.businessDescription} colors={colors} />
                      </View>
                    </View>

                    <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                      <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                        <MaterialIcons name="place" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.inputBody}>
                        <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          Localisation {commerceKind === 'boutique' ? '(optionnelle — e-commerce)' : ''}
                        </ThemedText>
                        <TextInput style={[styles.inputField, { color: colors.text }]} placeholder={c.addressPlaceholder} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={businessAddress} editable={!otpSent} onChangeText={setBusinessAddress} />
                        <InlineFormError message={fieldErrors.businessAddress} colors={colors} />
                      </View>
                    </View>

                    <Pressable disabled={otpSent} style={({ pressed }) => [styles.imagePickCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }, pressed ? styles.buttonPressed : undefined, otpSent ? styles.buttonDisabled : undefined]} onPress={async () => { const r = await pickImage('enterprises'); if (!r) return; setBusinessImagePreview(r.previewUri); setBusinessImageDataUrl(r.dataUrl); setBusinessImageUrl(null); }}>
                      <View style={styles.imagePickLeft}>
                        <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                          <MaterialIcons name="image" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.inputBody}>
                          <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>{commerceKind === 'restaurant' ? 'Logo du restaurant' : 'Logo de la boutique'}</ThemedText>
                          <ThemedText style={[styles.imagePickHint, { color: businessImagePreview ? colors.success : colors.textMuted }]}>
                            {businessImagePreview ? '✓ Photo sélectionnée' : 'Choisir une image'}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.imagePickRight}>
                        {businessImagePreview ? (
                          <Image source={{ uri: businessImagePreview }} style={[styles.imageThumb, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} contentFit="cover" />
                        ) : (
                          <View style={[styles.imageThumbEmpty, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                            <MaterialIcons name="add-a-photo" size={26} color={colors.primary} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </>
                );
              })() : null}

              <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                  <MaterialIcons name="lock" size={18} color={colors.primary} />
                </View>
                <View style={styles.inputBody}>
                  <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Mot de passe</ThemedText>
                  <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Minimum 6 caractères" secureTextEntry={!passwordVisible} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" value={password} editable={!otpSent} onChangeText={setPassword} />
                  <InlineFormError message={fieldErrors.password} colors={colors} />
                </View>
                <Pressable style={styles.eyeButton} onPress={() => setPasswordVisible((v) => !v)} hitSlop={10}>
                  <MaterialIcons name={passwordVisible ? 'visibility-off' : 'visibility'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              {profile === 'client' ? (
                <Pressable disabled={otpSent} style={({ pressed }) => [styles.imagePickCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }, pressed ? styles.buttonPressed : undefined, otpSent ? styles.buttonDisabled : undefined]} onPress={async () => { const r = await pickImage('profiles'); if (!r) return; setProfileImagePreview(r.previewUri); setProfileImageDataUrl(r.dataUrl); setProfileImageUrl(null); }}>
                  <View style={styles.imagePickLeft}>
                    <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                      <MaterialIcons name="image" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.inputBody}>
                      <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Photo de profil (optionnel)</ThemedText>
                      <ThemedText style={[styles.imagePickHint, { color: profileImagePreview ? colors.success : colors.textMuted }]}>
                        {profileImagePreview ? '✓ Photo sélectionnée' : 'Choisir une image'}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.imagePickRight}>
                    {profileImagePreview ? (
                      <Image source={{ uri: profileImagePreview }} style={[styles.imageThumb, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} contentFit="cover" />
                    ) : (
                      <View style={[styles.imageThumbEmpty, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                        <MaterialIcons name="add-a-photo" size={26} color={colors.primary} />
                      </View>
                    )}
                  </View>
                </Pressable>
              ) : null}

              {otpSent ? (
                <>
                  <ThemedText style={[styles.sectionTitle, { color: colors.primary }]}>Vérification</ThemedText>
                  {testOtpCode ? <ThemedText style={[styles.testOtpHint, { color: colors.primary }]}>Mode test actif - code OTP: {testOtpCode}</ThemedText> : null}
                  <View style={[styles.inputCard, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
                    <View style={[styles.inputIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
                      <MaterialIcons name="sms" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.inputBody}>
                      <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Code SMS</ThemedText>
                      <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Ex. : 123456" keyboardType="number-pad" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={otp} onChangeText={setOtp} />
                    </View>
                  </View>
                  <Pressable style={({ pressed }) => [styles.submitButton, { backgroundColor: colors.primary }, pressed ? styles.buttonPressed : undefined, isSubmitting ? styles.buttonDisabled : undefined]} disabled={!canVerifyOtp} onPress={handleVerifyAndRegister}>
                    <LinearGradient
                      colors={canVerifyOtp && !isSubmitting ? brandGradient3(colors) : [colors.primaryMuted, colors.primaryMuted]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Création du compte…' : 'Valider et créer le compte'}</ThemedText>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.primarySoft }, pressed ? styles.buttonPressed : undefined]} onPress={resetOtpFlow}>
                    <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Modifier les informations</ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable style={({ pressed }) => [styles.submitButton, { backgroundColor: colors.primary }, pressed ? styles.buttonPressed : undefined, isSubmitting ? styles.buttonDisabled : undefined, !canSendOtp ? styles.buttonDisabled : undefined]} disabled={!canSendOtp} onPress={handleSendOtp}>
                  <LinearGradient
                    colors={canSendOtp && !isSubmitting ? brandGradient3(colors) : [colors.primaryMuted, colors.primaryMuted]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Envoi en cours…' : 'Recevoir le code par SMS'}</ThemedText>
                </Pressable>
              )}

              <Pressable style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.primarySoft }, pressed ? styles.buttonPressed : undefined]} onPress={() => router.replace('/auth')}>
                <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>{"J'ai déjà un compte"}</ThemedText>
              </Pressable>

              <ThemedText style={[styles.formHint, { color: colors.textMuted }]}>Vos données sont traitées conformément à notre politique de confidentialité.</ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

export default function SignupScreen() {
  return <SignupScreenBase variant="default" forcedProfile="client" />;
}

export function SignupCommerceScreen({ kind }: { kind: CommerceKind }) {
  return <SignupScreenBase variant={kind} forcedProfile="vendeur" />;
}

export function SignupClientOnlyScreen() {
  return <SignupScreenBase variant="default" forcedProfile="client" />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroGlow: { position: 'absolute', top: -140, left: -80, width: 360, height: 360, borderRadius: 220 },
  keyboardContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 36 },
  scrollContentAndroid: { paddingBottom: 130 },
  scrollContentWithKeyboard: { paddingBottom: 320 },
  header: { paddingHorizontal: 20, gap: 8, alignItems: 'center', marginBottom: 4 },
  headerTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'flex-start' },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 999 },
  backButtonText: { fontWeight: '800', fontSize: 14 },
  logoBadge: { width: 104, height: 104, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  appIcon: { width: 92, height: 92 },
  description: { opacity: 0.8, textAlign: 'center', maxWidth: 340 },
  formPage: { paddingHorizontal: 20, marginTop: 22, alignItems: 'center' },
  formCard: { borderWidth: 1.2, borderRadius: 24, padding: 18, gap: 12, elevation: 6 },
  cardAccent: { height: 4, width: 54, borderRadius: 99, alignSelf: 'center', marginBottom: 4, opacity: 0.9 },
  inputCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, elevation: 4 },
  inputIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inputBody: { flex: 1, gap: 4 },
  inputLabel: { fontSize: 12, fontWeight: '800', opacity: 0.9 },
  inputField: { paddingVertical: 0, fontSize: 15 },
  eyeButton: { paddingHorizontal: 4, paddingVertical: 6 },
  imagePickCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, elevation: 4 },
  imagePickLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  imagePickRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imagePickHint: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  imageThumb: { width: 72, height: 72, borderRadius: 14, borderWidth: 1.5 },
  imageThumbEmpty: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { marginTop: 10, fontSize: 14, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  buttonDisabled: { opacity: 0.65 },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  submitButton: { marginTop: 10, borderRadius: 16, paddingVertical: 15, alignItems: 'center', elevation: 6, overflow: 'hidden', shadowColor: '#0C4F36', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: { marginTop: 8, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '700', fontSize: 15 },
  formHint: { marginTop: 2, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  testOtpHint: { marginTop: 2, marginBottom: 2, fontWeight: '700', textAlign: 'center' },
});
