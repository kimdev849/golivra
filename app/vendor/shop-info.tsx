import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
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
    const e4 = deliveryAddressError(address);
    if (e4) {
      next.address = e4;
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

        <ThemedText style={[styles.sectionHead, { color: colors.textSecondary }]}>Adresse du commerce</ThemedText>
        <DeliveryAddressForm value={address} onChange={setAddress} accentColor={palette.primary} />
        <InlineFormError message={fieldErrors.address} colors={colors} />

        <View style={[styles.deliveryCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText type="defaultSemiBold" style={[styles.deliveryTitle, { color: colors.text }]}>
            Réseau GoLivra
          </ThemedText>
          <ThemedText style={[styles.deliverySub, { color: colors.textMuted }]}>
            Quand un client commande, un livreur GoLivra est contacté (le client paie la livraison). Vous pouvez aussi
            créer une livraison vous-même depuis l’app (vous payez les frais).
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
  lab: { fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 12 },
  inp: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 88 },
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
