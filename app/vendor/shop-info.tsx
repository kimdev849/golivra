import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Clock } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeliveryAddressForm, type DeliveryAddressFormValue } from '@/components/delivery-address-form';
import { InlineFormError } from '@/components/inline-form-error';
import { pickVendorImageAsset } from '@/components/vendor-form-shared';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useVendor } from '@/contexts/vendor-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorHoraires } from '@/hooks/use-vendor-horaires';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { patchEnterprise } from '@/lib/enterprise';
import { deliveryAddressError, quartierForForm } from '@/lib/format-address';
import { resolveRemoteImageUrl } from '@/lib/images';
import { uploadImageBase64 } from '@/lib/uploads';
import { validateCommerceName, validateDescription, validatePhone } from '@/lib/form-validation';

const emptyAddr = (): DeliveryAddressFormValue => ({
  quartier: '',
  ligne1: '',
  instructions: '',
  point_reperes: '',
  ville: 'Brazzaville',
  pays: 'Congo',
});

export default function VendorShopInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const { shop, refresh } = useVendor();
  const { commerceType, palette } = useVendorTheme();
  const horaires = useVendorHoraires(shop?.id);

  const openHorairesEditor = () =>
    router.push({ pathname: '/vendor/horaires', params: shop?.id ? { id: shop.id } : {} });
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [telephone, setTelephone] = useState('');
  const [address, setAddress] = useState<DeliveryAddressFormValue>(emptyAddr);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!shop) return;
    const ligne1 = shop.adresse || '';
    setNom(shop.nom || '');
    setDescription(shop.description || '');
    setTelephone(shop.telephone || '');
    setLogoUri(shop.avatar);
    setAddress({
      quartier: quartierForForm(shop.adresse_quartier, Boolean(ligne1.trim())),
      ligne1,
      instructions: '',
      point_reperes: '',
      ville: shop.adresse_ville || 'Brazzaville',
      pays: 'Congo',
    });
  }, [shop]);

  const pickLogo = async () => {
    const asset = await pickVendorImageAsset();
    if (!asset) return;
    setLogoUri(asset.uri);
    setLogoDataUrl(asset.dataUrl);
  };

  const save = async () => {
    if (!shop?.id) return;
    setFieldErrors({});
    const next: Record<string, string | null> = {};
    const e1 = validateCommerceName(nom);
    if (!e1.ok) {
      next.nom = e1.message;
      setFieldErrors(next);
      return;
    }
    setNom(e1.value);
    const e2 = validatePhone(telephone);
    if (!e2.ok) {
      next.telephone = e2.message;
      setFieldErrors(next);
      return;
    }
    setTelephone(e2.value);
    const e3 = validateDescription(description, 500);
    if (!e3.ok) {
      next.description = e3.message;
      setFieldErrors(next);
      return;
    }
    setDescription(e3.value);
    // Adresse : obligatoire uniquement pour les restaurants (livraison sur place).
    // Les boutiques (y compris e-commerce) peuvent enregistrer leur fiche sans adresse.
    // Si une boutique saisit une adresse partielle, on la valide en léger (mêmes règles que l'API).
    const isRestaurant = commerceType === 'restaurant';
    if (isRestaurant) {
      const e4 = deliveryAddressError(address);
      if (e4) {
        next.address = e4;
        setFieldErrors(next);
        return;
      }
    } else if (address.ligne1.trim() && address.ligne1.trim().length < 5) {
      next.address = 'Adresse détaillée trop courte (5 caractères minimum).';
      setFieldErrors(next);
      return;
    } else if (/^[0-9\s]+$/.test(address.ligne1.trim())) {
      next.address = 'Adresse invalide (pas uniquement des chiffres).';
      setFieldErrors(next);
      return;
    }

    setSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée');

      let imageUrl: string | undefined;
      if (logoDataUrl) {
        const uploaded = await uploadImageBase64(token, { dataUrl: logoDataUrl, folder: 'enterprises' });
        imageUrl = uploaded.url;
      }

      await patchEnterprise(token, shop.id, {
        nom: nom,
        description: description.trim() || null,
        telephone: telephone,
        adresse: address.ligne1.trim(),
        adresseQuartier: address.quartier.trim(),
        adresseVille: address.ville || 'Brazzaville',
        ...(imageUrl ? { imageUrl } : logoDataUrl ? { imageDataUrl: logoDataUrl } : {}),
      });
      setLogoDataUrl(null);
      router.back();
      void refresh();
      showSuccess('Enregistré !', 'Les informations du commerce ont été mises à jour.');
    } catch (e) {
      showError('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const infoTitle = commerceType === 'restaurant' ? 'Informations restaurant' : 'Informations boutique';
  const nomLabel = commerceType === 'restaurant' ? 'Nom du restaurant' : 'Nom de la boutique';
  const displayLogo = resolveRemoteImageUrl(logoUri);

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title={infoTitle} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <Pressable style={[styles.photoZone, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => void pickLogo()}>
          {displayLogo ? (
            <Image source={{ uri: displayLogo }} style={styles.photoImg} contentFit="cover" />
          ) : (
            <Camera size={36} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          )}
          <View style={[styles.chgPhoto, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.chgPhotoTxt, { color: colors.text }]}>Changer la photo</ThemedText>
          </View>
        </Pressable>

        <ThemedText style={[styles.lab, { color: colors.textSecondary }]}>{nomLabel}</ThemedText>
        <TextInput style={[styles.inp, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]} value={nom} onChangeText={setNom} placeholderTextColor={colors.placeholder} />
        <InlineFormError message={fieldErrors.nom} colors={colors} />
        <ThemedText style={[styles.lab, { color: colors.textSecondary }]}>Description</ThemedText>
        <TextInput
          style={[styles.inp, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.placeholder}
        />
        <InlineFormError message={fieldErrors.description} colors={colors} />
        <ThemedText style={[styles.lab, { color: colors.textSecondary }]}>Téléphone</ThemedText>
        <TextInput style={[styles.inp, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]} value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" placeholderTextColor={colors.placeholder} />
        <InlineFormError message={fieldErrors.telephone} colors={colors} />

        <ThemedText style={[styles.sectionHead, { color: colors.textSecondary }]}>
          {commerceType === 'restaurant'
            ? 'Adresse du commerce'
            : 'Adresse du commerce (optionnelle)'}
        </ThemedText>
        {commerceType === 'boutique' ? (
          <ThemedText style={[styles.addrHint, { color: colors.textMuted }]}>
            Boutique en ligne ? Laissez vide si vous ne recevez pas de clients sur place.
          </ThemedText>
        ) : null}
        <DeliveryAddressForm
          value={address}
          onChange={setAddress}
          accentColor={palette.primary}
          required={commerceType === 'restaurant'}
          hideLibelle
        />
        <InlineFormError message={fieldErrors.address} colors={colors} />

        {/* ── Horaires d'ouverture (obligatoires pour recevoir des commandes) ── */}
        <ThemedText style={[styles.sectionHead, { color: colors.textSecondary }]}>Horaires d&apos;ouverture</ThemedText>
        <Pressable
          style={[styles.hoursCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          onPress={openHorairesEditor}>
          <View
            style={[
              styles.hoursIcon,
              {
                backgroundColor: !horaires.hasHours
                  ? colors.errorSoft
                  : horaires.openNow
                    ? colors.successSoft
                    : colors.warningSoft,
              },
            ]}>
            <Clock
              size={20}
              color={!horaires.hasHours ? colors.error : horaires.openNow ? colors.success : colors.warning}
              strokeWidth={LUCIDE_STROKE}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.hoursTitle, { color: colors.text }]}>
              {horaires.hasHours ? 'Horaires définis' : 'Horaires non définis'}
            </ThemedText>
            <ThemedText
              style={[
                styles.hoursStatus,
                {
                  color: !horaires.hasHours
                    ? colors.error
                    : horaires.openNow
                      ? colors.success
                      : colors.warning,
                },
              ]}>
              {!horaires.hasHours
                ? "Requis — vous ne recevez aucune commande tant que ce n'est pas fait."
                : horaires.openNow
                  ? `Ouvert aujourd'hui${horaires.todayHours ? ` · ${horaires.todayHours}` : ''}`
                  : horaires.nextLabel
                    ? horaires.nextLabel.startsWith('aujourd')
                      ? `Fermé pour le moment · ouvre ${horaires.nextLabel}`
                      : `Fermé aujourd'hui · réouverture ${horaires.nextLabel}`
                    : "Fermé aujourd'hui"}
            </ThemedText>
            {horaires.hasHours ? (
              <ThemedText style={[styles.hoursSummary, { color: colors.textMuted }]} numberOfLines={1}>
                {horaires.summary}
              </ThemedText>
            ) : null}
          </View>
          <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        </Pressable>

        <View style={[styles.deliveryCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText type="defaultSemiBold" style={[styles.deliveryTitle, { color: colors.text }]}>
            Réseau GoLivra
          </ThemedText>
          <ThemedText style={[styles.deliverySub, { color: colors.textMuted }]}>
            Un livreur livre vos commandes (le client paie). Créez aussi vos propres livraisons (vous payez).
          </ThemedText>
        </View>

        <Pressable
          style={[styles.save, { backgroundColor: palette.primaryDeep }, saving && styles.saveDisabled]}
          onPress={() => void save()}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <ThemedText style={styles.saveTxt}>Enregistrer</ThemedText>
          )}
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photoZone: {
    height: 160,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
  },
  photoImg: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  chgPhoto: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 1,
  },
  chgPhotoTxt: { fontWeight: '700', fontSize: 13 },
  sectionHead: { fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  addrHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  lab: { fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 12 },
  inp: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 88 },
  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
  },
  hoursIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  hoursStatus: { fontSize: 12.5, fontWeight: '800', lineHeight: 17 },
  hoursSummary: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.85 },
  deliveryCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  deliveryTitle: { fontSize: 15, marginBottom: 6 },
  deliverySub: { fontSize: 12, lineHeight: 17 },
  save: {
    marginTop: 28,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.7 },
  saveTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
