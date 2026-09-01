import { Image } from 'expo-image';
import { useRouter } from '@/hooks/use-safe-router';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronRight, Clock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { getSessionToken } from '@/lib/auth';
import { invalidateEnterprisesCache } from '@/lib/client-data';
import { patchEnterprise } from '@/lib/enterprise';
import { deliveryAddressError, quartierForForm } from '@/lib/format-address';
import { resolveRemoteImageUrl } from '@/lib/images';
import { DEFAULT_PREP_MINUTES, PREP_MINUTE_CHOICES } from '@/lib/pricing';
import { uploadImageBase64 } from '@/lib/uploads';
import { showToast } from '@/lib/app-toast';
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
  const guarded = useGuardedCallback();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const { shop, refresh } = useVendor();
  const queryClient = useQueryClient();
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
  const [prepMinutes, setPrepMinutes] = useState(shop?.delaiPreparationMin ?? DEFAULT_PREP_MINUTES);
  const [prepSaving, setPrepSaving] = useState(false);
  // Ne pré-remplit le formulaire qu'UNE FOIS par boutique : si l'objet `shop`
  // est recréé pendant l'édition (refresh silencieux), on ne doit pas écraser
  // les modifications en cours (sélection du temps de préparation, champs…).
  const syncedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shop || syncedForRef.current === shop.id) return;
    syncedForRef.current = shop.id;
    const ligne1 = shop.adresse || '';
    setPrepMinutes(shop.delaiPreparationMin);
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

  /**
   * Sauvegarde IMMÉDIATE du temps de préparation dès qu'un chip est tapé —
   * pas besoin d'appuyer sur « Enregistrer ». Le changement persiste même si
   * le vendeur quitte l'écran juste après, et les clients le voient aussitôt.
   */
  const savePrepMinutes = async (minutes: number) => {
    if (!shop?.id || prepSaving) return;
    // On compare à la sélection locale : pas de PATCH ni de toast redondant
    // quand on re-tape le chip déjà sélectionné (avant que le refresh serveur arrive).
    if (minutes === prepMinutes) return;
    const isRestaurant = commerceType === 'restaurant';
    const previous = prepMinutes;
    setPrepMinutes(minutes);
    setPrepSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée');
      // Envoie les deux conventions de nommage : l'API actuelle lit
      // `delaiPreparationMin`, certaines versions antérieures pouvaient
      // attendre le nom de colonne en snake_case. Le serveur ignore les
      // champs inconnus, donc l'envoi des deux est sans risque.
      const saved = await patchEnterprise(token, shop.id, {
        delaiPreparationMin: minutes,
        ...(isRestaurant ? { delai_preparation_min: minutes } : { delai_livraison_min: minutes }),
      });
      // Vérifie que la valeur a VRAIMENT été persistée : si l'API répond OK
      // mais renvoie encore l'ancienne valeur (version serveur qui ignore le
      // champ), on le signale au lieu d'afficher un succès trompeur.
      // Le type se lit dans la RÉPONSE serveur (jamais en retard ni trompeur).
      const persisted =
        saved.type === 'restaurant' ? saved.delai_preparation_min : saved.delai_livraison_min;
      if (persisted === undefined || Number(persisted) !== minutes) {
        throw new Error(
          "Le serveur n'a pas enregistré le nouveau temps de préparation. Vérifiez que l'API est à jour, puis réessayez.",
        );
      }
      invalidateEnterprisesCache();
      queryClient.invalidateQueries({ queryKey: ['enterprise'] });
      queryClient.invalidateQueries({ queryKey: ['enterprises'] });
      void refresh();
      showToast({ message: 'Temps de préparation enregistré ✓', variant: 'success', duration: 1800 });
    } catch (e) {
      setPrepMinutes(previous);
      showError('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setPrepSaving(false);
    }
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
        delaiPreparationMin: prepMinutes,
        ...(isRestaurant ? { delai_preparation_min: prepMinutes } : { delai_livraison_min: prepMinutes }),
        ...(imageUrl ? { imageUrl } : logoDataUrl ? { imageDataUrl: logoDataUrl } : {}),
      });
      setLogoDataUrl(null);
      // ⚡ Propager immédiatement la modification aux vues client du même
      // appareil : sans ça, le cache (React Query + request-cache, jusqu'à 2-3
      // min) afficherait l'ancien temps de préparation sur la fiche commerce,
      // l'accueil et le panier. Les autres appareils rafraîchissent par TTL.
      invalidateEnterprisesCache();
      queryClient.invalidateQueries({ queryKey: ['enterprise'] });
      queryClient.invalidateQueries({ queryKey: ['enterprises'] });
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
  // Photo choisie localement (URI file://) → affichage direct. URL distante →
  // résolution (redimensionnement Supabase). Le fallback sur l'URI brute évite
  // que la photo sélectionnée n'apparaisse qu'après enregistrement.
  const displayLogo = logoUri ? (resolveRemoteImageUrl(logoUri) ?? logoUri) : null;

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
        <Pressable style={[styles.photoZone, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => guarded(() => void pickLogo())}>
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

        {/* ── Temps de préparation (géré par le commerce) ── */}
        <ThemedText style={[styles.sectionHead, { color: colors.textSecondary }]}>
          Temps de préparation
        </ThemedText>
        <View style={[styles.prepCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText style={[styles.prepSub, { color: colors.textMuted }]}>
            {commerceType === 'restaurant'
              ? 'Le temps nécessaire pour cuisiner et emballer votre commande.'
              : 'Le temps nécessaire pour préparer le sac, vérifier les articles et emballer.'}
          </ThemedText>
          <View style={styles.prepChips}>
            {PREP_MINUTE_CHOICES.map((m) => {
              const on = prepMinutes === m;
              return (
                <Pressable
                  key={m}
                  style={[
                    styles.prepChip,
                    {
                      borderColor: on ? palette.primary : colors.border,
                      backgroundColor: on ? palette.primary : colors.surface,
                    },
                  ]}
                  onPress={() => guarded(() => void savePrepMinutes(m))}
                  disabled={prepSaving}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: prepSaving }}
                  accessibilityLabel={`${m} minutes`}>
                  <ThemedText
                    style={[
                      styles.prepChipTxt,
                      { color: on ? colors.onPrimary : colors.text },
                    ]}>
                    {m} min
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.prepHintRow}>
            <ThemedText style={[styles.prepHint, { color: colors.textMuted }]}>
              Vos clients verront : « Votre commande sera prête dans environ {prepMinutes} min », puis la livraison par un livreur GoLivra.
            </ThemedText>
            {prepSaving ? <ActivityIndicator size="small" color={palette.primary} /> : null}
          </View>
        </View>

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
          onPress={() => guarded(() => void save())}
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
  prepCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  prepSub: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  prepChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prepChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  prepHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  prepChipTxt: { fontWeight: '800', fontSize: 13 },
  prepHint: { fontSize: 11.5, lineHeight: 16, marginTop: 12, opacity: 0.85 },
  save: {
    marginTop: 28,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.7 },
  saveTxt: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
