import { useRouter } from '@/hooks/use-safe-router';
import { useEffect, useRef, useState } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  MessageCircle,
  PartyPopper,
  Smartphone,
  Store,
  Tag,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';

import { CategoryPicker } from '@/components/category-picker';
import { FormErrorBanner } from '@/components/form-error-banner';
import { FormStepper } from '@/components/form-stepper';
import { InlineFormError } from '@/components/inline-form-error';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { AuthBackdrop } from '@/components/auth-backdrop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { registerAccount, registerVendorAccount, persistAuthSession } from '@/lib/auth';
import { fetchEnterpriseCategories, type EnterpriseCategory } from '@/lib/enterprise';
import { requestOtp } from '@/lib/otp';
import { formatPhone, initPhoneCountries, toE164 } from '@/lib/phone';
import { VENDOR_HREF } from '@/lib/vendor-nav';
import { friendlyErrorMessage } from '@/lib/ux-copy';
import { validateAddress, validateCommerceName, validateOtp, validatePassword, validatePersonName, validatePhone, type ValidationResult } from '@/lib/form-validation';

// Animations d'entrée du header et du stepper uniquement (aucun champ de
// saisie dedans : les Animated.View autour des TextInput faisaient perdre le
// focus et fermer le clavier dès la saisie).
const HEADER_ENTER = FadeInDown.duration(420);
const STEPPER_ENTER = FadeInUp.duration(420).delay(90);

type Profile = 'client' | 'vendeur';
type CommerceKind = 'restaurant' | 'boutique';
type SignupVariant = 'default' | CommerceKind;
type BaseProps = { variant: SignupVariant; forcedProfile?: Profile };

function commerceCopy(kind: CommerceKind) {
  if (kind === 'restaurant') {
    return {
      screenTitle: 'Votre restaurant', lead: 'Renseignez une fiche simple et claire pour que les clients vous trouvent vite.',
      nameLabel: 'Nom du restaurant', namePlaceholder: 'Ex. : Le Palmier', phoneLabel: 'Téléphone du restaurant',
      addressLabel: 'Adresse', addressPlaceholder: 'Quartier, rue, point de repère…',
      detailsLabel: 'Type de cuisine', detailsPlaceholder: 'Choisissez une catégorie',
    };
  }
  return {
    screenTitle: 'Votre boutique', lead: 'Renseignez une fiche simple et claire pour que les clients vous trouvent vite.',
    nameLabel: 'Nom de la boutique', namePlaceholder: 'Ex. : Mode & Co', phoneLabel: 'Téléphone de la boutique',
    addressLabel: 'Adresse (optionnelle)', addressPlaceholder: 'Laissez vide pour une boutique en ligne',
    detailsLabel: 'Catégorie de la boutique', detailsPlaceholder: 'Choisissez une catégorie',
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
  const [location, setLocation] = useState<LocationValue>({ pays: null, ville: null });
  const phoneIndicatif = location.pays?.indicatif || '+242';
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCategoryId, setBusinessCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<EnterpriseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [testOtpCode, setTestOtpCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const signupDoneRef = useRef(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Android (edge-to-edge) : le clavier recouvre les champs bas du formulaire
  // (ex. l'adresse resto/boutique). On ajoute un padding bas = hauteur du
  // clavier pour que le champ saisi reste visible et scrollable.
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
  const formWidth = Math.min(width - 40, 460);
  const phoneE164 = toE164(phone);

  useEffect(() => {
    initPhoneCountries().catch(() => {});
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

  // Bordure rouge sur le champ concerné quand il est en erreur.
  const fieldBorder = (name: string) => (fieldErrors[name] ? colors.error : colors.inputBorder);

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
    if (!phoneE164) { next.phone = 'Ce numéro ne semble pas complet. Vérifiez-le, par exemple +242 06 123 45 67.'; setFieldErrors(next); return next.phone; }
    next.phone = null;
    const e3 = validatePassword(password);
    if (!e3.ok) { next.password = e3.message; setFieldErrors(next); return e3.message; }
    next.password = null;
    if (profile === 'vendeur' && !commerceKind) return 'Choisissez restaurant ou boutique.';
    if (profile === 'vendeur') {
      const e4 = validateCommerceName(businessName);
      if (!e4.ok) { next.businessName = e4.message; setFieldErrors(next); return e4.message; }
      next.businessName = null;
      if (!businessCategoryId) { next.businessCategoryId = 'Sélectionnez une catégorie.'; setFieldErrors(next); return 'Sélectionnez une catégorie.'; }
      next.businessCategoryId = null;
      if (commerceKind === 'restaurant') {
        const e5 = validateAddress(businessAddress, true);
        if (!e5.ok) { next.businessAddress = e5.message; setFieldErrors(next); return e5.message; }
      }
      next.businessAddress = null;
    }
    setFieldErrors({});
    return null;
  };

  // Validation douce à la sortie de chaque champ : l'erreur s'affiche
  // directement sous le champ concerné, sans attendre l'appui sur le bouton.
  const handleBlurField = (name: string, validator: () => ValidationResult) => {
    if (otpSent) return;
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
    const r = validator();
    if (!r.ok) setFieldErrors((prev) => ({ ...prev, [name]: r.message }));
  };

  const canSendOtp = !isSubmitting && !otpSent && Boolean(phoneE164) && Boolean(password) && password.length >= 6 && (profile === 'vendeur' || Boolean(fullName.trim()));
  const canVerifyOtp = !isSubmitting && otpSent && Boolean(otp.trim()) && otp.trim().length >= 4;

  const handleSendOtp = async () => {
    setError(null);
    const v = validateAccountForOtp();
    if (v) return; // l'erreur s'affiche directement sous le champ concerné
    setIsSubmitting(true);
    try {
      const otpResult = await requestOtp(phoneE164!);
      setTestOtpCode(otpResult.testMode && otpResult.otpCode ? otpResult.otpCode : null);
      setOtpSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d\'envoyer le code.'); }
    finally { setIsSubmitting(false); }
  };

  const handleVerifyAndRegister = async () => {
    if (signupDoneRef.current) return;
    setError(null);
    if (!otpSent) { setError('Demandez d’abord le code par SMS.'); return; }
    const otpCheck = validateOtp(otp);
    if (!otpCheck.ok) { setFieldErrors({ otp: otpCheck.message }); return; }
    setFieldErrors((prev) => ({ ...prev, otp: null }));
    const v = validateAccountForOtp();
    if (v) return; // l'erreur s'affiche directement sous le champ concerné
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const userNom = profile === 'vendeur' ? businessName.trim() : fullName.trim();

      if (profile === 'vendeur') {
        if (!commerceKind) { setError("Type de commerce introuvable."); return; }
        const trimmedAddress = businessAddress.trim();
        const result = await registerVendorAccount({
          nom: userNom,
          telephone: phoneE164!,
          motDePasse: password,
          otpCode: otp.trim(),
          role: commerceKind === 'restaurant' ? 'restaurateur' : 'commercant',
          imageUrl: null,
          pays_id: location.pays?.id || null,
          ville_id: location.ville?.id || null,
          enterprise: {
            type: commerceKind,
            nom: businessName.trim(),
            telephone: phoneE164!,
            categorieId: businessCategoryId!,
            description: null,
            imageUrl: null,
            ...(commerceKind === 'restaurant' || trimmedAddress ? { adresse: trimmedAddress } : {}),
          },
        });
        if (!result?.token) {
          throw new Error('Compte créé mais session invalide. Connectez-vous avec votre numéro et mot de passe.');
        }
        const { enterprise: _ent, ...session } = result;
        await persistAuthSession(session);
        signupDoneRef.current = true;
        showSuccess(
          'Compte créé !',
          `Votre ${commerceKind === 'restaurant' ? 'restaurant' : 'boutique'} est enregistré et en attente de validation. Complétez votre fiche (logo, description) pour attirer vos premiers clients.`,
          { primaryLabel: 'Continuer', onPrimary: () => router.replace(VENDOR_HREF.root), icon: PartyPopper },
        );
        return;
      }

      const session = await registerAccount({
        nom: userNom, telephone: phoneE164!, motDePasse: password, otpCode: otp.trim(), imageUrl: null,
        role: 'client',
        pays_id: location.pays?.id || null,
        ville_id: location.ville?.id || null,
      });
      if (!session?.token) {
        throw new Error('Compte créé mais session invalide. Connectez-vous avec votre numéro et mot de passe.');
      }
      await persistAuthSession(session);
      signupDoneRef.current = true;
      showSuccess(
        'Bienvenue à bord !',
        'Votre compte GoLivra est prêt. Prenez le temps de compléter votre profil (photo, adresses), puis découvrez les commerces près de chez vous.',
        {
          primaryLabel: 'Explorer',
          onPrimary: () => router.replace('/(tabs)'),
          icon: PartyPopper,
        },
      );
    } catch (e) {
      if (signupDoneRef.current) return;
      const reqId = (e as { requestId?: string })?.requestId;
      const rawMsg = e instanceof Error ? e.message : String(e);
      const lower = rawMsg.toLowerCase();
      if (lower.includes('déjà enregistré') || lower.includes('deja enregistre') || lower.includes('déjà inscrit') || lower.includes('deja inscrit')) {
        setError('Ce numéro est déjà inscrit.');
        // Redirection automatique vers la connexion après 1.5s
        setTimeout(() => {
          router.replace('/auth');
        }, 1500);
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

  const isVendor = profile === 'vendeur' && forcedProfile !== 'client' && commerceKind;
  const vendorKind: CommerceKind = isVendor ? (commerceKind as CommerceKind) : 'restaurant';
  const vc = isVendor ? commerceCopy(vendorKind) : null;

  const headerIcon: LucideIcon = isVendor
    ? vendorKind === 'restaurant'
      ? UtensilsCrossed
      : Store
    : User;
  const HeaderIcon = headerIcon;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AuthBackdrop colors={colors} />
      <FeedbackOverlay />
      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'android' ? styles.scrollContentAndroid : undefined,
            keyboardInset > 0 ? { paddingBottom: keyboardInset + 48 } : undefined,
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <Animated.View entering={HEADER_ENTER} style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }}
                hitSlop={6}>
                <ChevronLeft size={22} color={colors.primary} strokeWidth={2.5} />
              </Pressable>
              <View style={styles.headerCenter}>
                <View style={styles.kindBadge}>
                  <View style={styles.kindBadgeInner}>
                    <HeaderIcon size={26} color="#FFFFFF" strokeWidth={2.1} />
                  </View>
                </View>
              </View>
            </View>
            <ThemedText type="title" style={styles.title}>{headerCopy(variant).title}</ThemedText>
            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
              {headerCopy(variant).description}
            </ThemedText>
          </Animated.View>

          <Animated.View entering={STEPPER_ENTER} style={styles.stepperWrap}>
            <FormStepper steps={['Informations', 'Vérification']} current={otpSent ? 2 : 1} colors={colors} />
          </Animated.View>

          <View style={[styles.formPage, { width }]}>
            <View style={[styles.formCard, { width: formWidth, borderColor: colors.border, backgroundColor: colors.surface }]}>
              <FormErrorBanner
                message={error}
                colors={colors}
                title="Inscription impossible"
                onDismiss={() => setError(null)}
              />

              {/* ── Section 1 : VOS INFORMATIONS ── */}
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  Vos informations
                </ThemedText>

                {profile === 'client' ? (
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nom complet</ThemedText>
                    <View style={[styles.inputCard, { borderColor: fieldBorder('fullName'), backgroundColor: colors.inputBg }]}>
                      <User size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Ex. : Jean Claude" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={fullName} editable={!otpSent} onChangeText={(t) => { setFullName(t); if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: null })); }} onBlur={() => handleBlurField('fullName', () => validatePersonName(fullName))} />
                    </View>
                    <ThemedText style={[styles.helperText, { color: colors.textMuted }]}>
                      Votre prénom et votre nom, par exemple « Jean Claude ».
                    </ThemedText>
                    <InlineFormError message={fieldErrors.fullName} colors={colors} />
                  </View>
                ) : null}

                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Numéro de téléphone</ThemedText>
                  <View style={[styles.inputCard, { borderColor: fieldBorder('phone'), backgroundColor: colors.inputBg }]}>
                    <Smartphone size={20} color={colors.primary} strokeWidth={2.2} />
                    <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="+242 06 XXX XX XX" keyboardType="phone-pad" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={phone} editable={!otpSent} autoCapitalize="none" autoCorrect={false} onChangeText={(text) => { setPhone(formatPhone(text, phoneIndicatif)); if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: null })); }} onBlur={() => handleBlurField('phone', () => validatePhone(phone, phoneIndicatif))} />
                  </View>
                  <ThemedText style={[styles.helperText, { color: colors.textMuted }]}>
                    Un code de vérification sera envoyé par SMS.
                  </ThemedText>
                  <InlineFormError message={fieldErrors.phone} colors={colors} />
                </View>

                <View style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mot de passe</ThemedText>
                  <View style={[styles.inputCard, { borderColor: fieldBorder('password'), backgroundColor: colors.inputBg }]}>
                    <Lock size={20} color={colors.primary} strokeWidth={2.2} />
                    <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Minimum 8 caractères" secureTextEntry={!passwordVisible} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" value={password} editable={!otpSent} onChangeText={(t) => { setPassword(t); if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null })); }} onBlur={() => handleBlurField('password', () => validatePassword(password))} />
                    <Pressable style={styles.eyeButton} onPress={() => setPasswordVisible((v) => !v)} hitSlop={10}>
                      {passwordVisible ? (
                        <EyeOff size={20} color={colors.textMuted} strokeWidth={2.2} />
                      ) : (
                        <Eye size={20} color={colors.textMuted} strokeWidth={2.2} />
                      )}
                    </Pressable>
                  </View>
                  <ThemedText style={[styles.helperText, { color: colors.textMuted }]}>
                    Au moins 8 caractères, avec 1 lettre et 1 chiffre.
                  </ThemedText>
                  <InlineFormError message={fieldErrors.password} colors={colors} />
                </View>

              </View>

              {/* ── Section 2 : LOCALISATION ── */}
              <View style={styles.section}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                  Localisation
                </ThemedText>
                <LocationPicker
                  value={location}
                  onChange={setLocation}
                  autoDetect
                  disabled={otpSent}
                  compact
                />
              </View>

              {/* ── Section 3 : VOTRE COMMERCE ── */}
              {isVendor && vc ? (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                    Votre {vendorKind === 'restaurant' ? 'restaurant' : 'boutique'}
                  </ThemedText>

                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>{vc.nameLabel}</ThemedText>
                    <View style={[styles.inputCard, { borderColor: fieldBorder('businessName'), backgroundColor: colors.inputBg }]}>
                      {vendorKind === 'restaurant' ? (
                        <UtensilsCrossed size={20} color={colors.primary} strokeWidth={2.2} />
                      ) : (
                        <Store size={20} color={colors.primary} strokeWidth={2.2} />
                      )}
                      <TextInput style={[styles.inputField, { color: colors.text }]} placeholder={vc.namePlaceholder} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={businessName} editable={!otpSent} onChangeText={(t) => { setBusinessName(t); if (fieldErrors.businessName) setFieldErrors((prev) => ({ ...prev, businessName: null })); }} onBlur={() => handleBlurField('businessName', () => validateCommerceName(businessName))} />
                    </View>
                    <ThemedText style={[styles.helperText, { color: colors.textMuted }]}>
                      Un nom clair que vos clients reconnaîtront.
                    </ThemedText>
                    <InlineFormError message={fieldErrors.businessName} colors={colors} />
                  </View>

                  <Pressable disabled={otpSent || categoriesLoading} style={({ pressed }) => [styles.inputCard, { borderColor: fieldBorder('businessCategoryId'), backgroundColor: colors.inputBg }, pressed ? styles.buttonPressed : undefined, otpSent || categoriesLoading ? styles.buttonDisabled : undefined]} onPress={() => setCategoryPickerOpen(true)}>
                    <Tag size={20} color={colors.primary} strokeWidth={2.2} />
                    <View style={styles.inputBody}>
                      <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>{vc.detailsLabel}</ThemedText>
                      <ThemedText style={[styles.inputField, { color: selectedCategory ? colors.text : colors.textMuted }]}>
                        {categoriesLoading ? 'Chargement des catégories…' : selectedCategory?.nom || vc.detailsPlaceholder}
                      </ThemedText>
                    </View>
                    <ChevronDown size={22} color={colors.textMuted} strokeWidth={2.2} />
                  </Pressable>

                  <CategoryPicker visible={categoryPickerOpen} title={vc.detailsLabel} categories={categories} selectedId={businessCategoryId} onSelect={(cat) => { setBusinessCategoryId(cat.id); setFieldErrors((prev) => ({ ...prev, businessCategoryId: null })); }} onClose={() => setCategoryPickerOpen(false)} />
                  <InlineFormError message={fieldErrors.businessCategoryId} colors={colors} />

                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      {vc.addressLabel}
                    </ThemedText>
                    <View style={[styles.inputCard, { borderColor: fieldBorder('businessAddress'), backgroundColor: colors.inputBg }]}>
                      <MapPin size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput style={[styles.inputField, { color: colors.text }]} placeholder={vc.addressPlaceholder} placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={businessAddress} editable={!otpSent} onChangeText={(t) => { setBusinessAddress(t); if (fieldErrors.businessAddress) setFieldErrors((prev) => ({ ...prev, businessAddress: null })); }} onBlur={() => handleBlurField('businessAddress', () => validateAddress(businessAddress, commerceKind === 'restaurant'))} />
                    </View>
                    <InlineFormError message={fieldErrors.businessAddress} colors={colors} />
                  </View>
                </View>
              ) : null}

              {/* ── Vérification OTP ── */}
              {otpSent ? (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                    Vérification
                  </ThemedText>
                  {testOtpCode ? <ThemedText style={[styles.testOtpHint, { color: colors.primary }]}>Mode test actif - code OTP : {testOtpCode}</ThemedText> : null}
                  <View style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Code SMS</ThemedText>
                    <View style={[styles.inputCard, { borderColor: fieldBorder('otp'), backgroundColor: colors.inputBg }]}>
                      <MessageCircle size={20} color={colors.primary} strokeWidth={2.2} />
                      <TextInput style={[styles.inputField, { color: colors.text }]} placeholder="Ex. : 123456" keyboardType="number-pad" placeholderTextColor={colors.placeholder} selectionColor={colors.primary} value={otp} onChangeText={(t) => { setOtp(t); setFieldErrors((prev) => ({ ...prev, otp: null })); }} />
                    </View>
                    <InlineFormError message={fieldErrors.otp} colors={colors} />
                  </View>
                  <Pressable style={({ pressed }) => [styles.submitButton, { backgroundColor: colors.primary }, pressed ? styles.buttonPressed : undefined, isSubmitting ? styles.buttonDisabled : undefined]} disabled={!canVerifyOtp} onPress={handleVerifyAndRegister}>
                    <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Création du compte…' : 'Valider et créer le compte'}</ThemedText>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.primarySoft }, pressed ? styles.buttonPressed : undefined]} onPress={resetOtpFlow}>
                    <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Modifier les informations</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={({ pressed }) => [styles.submitButton, { backgroundColor: colors.primary }, pressed ? styles.buttonPressed : undefined, isSubmitting ? styles.buttonDisabled : undefined, !canSendOtp ? styles.buttonDisabled : undefined]} disabled={!canSendOtp} onPress={handleSendOtp}>
                  <ThemedText style={styles.submitButtonText}>{isSubmitting ? 'Envoi en cours…' : 'Recevoir le code par SMS'}</ThemedText>
                </Pressable>
              )}

              <Pressable style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.primarySoft }, pressed ? styles.buttonPressed : undefined]} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/auth'); }}>
                <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>{"J'ai déjà un compte"}</ThemedText>
              </Pressable>

              <ThemedText style={[styles.formHint, { color: colors.textMuted }]}>Vos informations restent privées et sécurisées. Consultez notre politique de confidentialité pour en savoir plus.</ThemedText>
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
  keyboardContainer: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 20, paddingBottom: 36 },
  scrollContentAndroid: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, gap: 6, alignItems: 'center' },
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginRight: 44,
  },
  kindBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindBadgeInner: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#0C4F36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, lineHeight: 28, textAlign: 'center', marginTop: 14 },
  description: { opacity: 0.8, textAlign: 'center', maxWidth: 340, fontSize: 13 },
  stepperWrap: { alignItems: 'center', marginTop: 20, marginBottom: 18 },
  formPage: { paddingHorizontal: 20, alignItems: 'center' },
  formCard: { borderWidth: 1.2, borderRadius: 24, padding: 18, gap: 12, elevation: 6 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13.5, fontWeight: '700' },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputBody: { flex: 1, gap: 2 },
  inputField: { flex: 1, paddingVertical: 0, fontSize: 15, minHeight: 22 },
  helperText: { fontSize: 12, lineHeight: 16, marginTop: -4 },
  eyeButton: { paddingHorizontal: 2, paddingVertical: 6 },
  buttonDisabled: { opacity: 0.6 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  submitButton: {
    marginTop: 6,
    borderRadius: 999,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16.5 },
  secondaryButton: { marginTop: 10, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { fontWeight: '800', fontSize: 15 },
  formHint: { marginTop: 2, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  testOtpHint: { marginTop: 2, marginBottom: 2, fontWeight: '700', textAlign: 'center' },
});
