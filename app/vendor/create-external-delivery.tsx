import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVendor } from '@/contexts/vendor-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { deliveryAddressError, snapshotFromFields } from '@/lib/format-address';
import { formatPhone } from '@/lib/phone';
import { createVendorExternalDelivery } from '@/lib/vendor-api';
import { VENDOR_HREF } from '@/lib/vendor-nav';
import { validatePersonName, validatePhone } from '@/lib/form-validation';

const emptyAddr = (): DeliveryAddressFormValue => ({
  quartier: '',
  ligne1: '',
  instructions: '',
  point_reperes: '',
  ville: 'Brazzaville',
  pays: 'Congo',
});

export default function VendorCreateDirectDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shop } = useVendor();
  const colors = useAppColors();
  const { palette } = useVendorTheme();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const [clientNom, setClientNom] = useState('');
  const [clientPhone, setClientPhone] = useState(() => formatPhone(''));
  const [address, setAddress] = useState<DeliveryAddressFormValue>(emptyAddr);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!shop?.id) {
      showError('Commerce introuvable', 'Rechargez votre espace vendeur puis réessayez.');
      return;
    }
    const nom = clientNom.trim();
    const tel = formatPhone(clientPhone);
    const e1 = validatePersonName(nom);
    if (!e1.ok) {
      showError('Nom du destinataire invalide', e1.message);
      return;
    }
    const e2 = validatePhone(clientPhone);
    if (!e2.ok || !tel) {
      showError('Téléphone invalide', e2.ok ? 'Indiquez un numéro valide.' : e2.message);
      return;
    }
    const e3 = deliveryAddressError(address);
    if (e3) {
      showError('Adresse invalide', e3);
      return;
    }

    setSubmitting(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await createVendorExternalDelivery(token, {
        establishmentId: shop.id,
        establishmentType: shop.type,
        clientNom: nom,
        clientTelephone: tel,
        adresse: snapshotFromFields(address),
        note: description.trim() || undefined,
      });
      router.replace(VENDOR_HREF.deliveriesTab);
      showSuccess(
        'Livraison créée !',
        'Un livreur GoLivra sera assigné automatiquement. Suivez le statut dans l’onglet Livraisons.',
        { primaryLabel: 'OK' },
      );
    } catch (e) {
      showError('Création impossible', e instanceof Error ? e.message : 'Réessayez plus tard.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title="Créer une livraison" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
          <ThemedText style={[styles.intro, { color: colors.textMuted }]}>
            <ThemedText type="defaultSemiBold">Livraison externe</ThemedText> : hors commande client (colis, client
            au téléphone). Même réseau GoLivra.{' '}
            <ThemedText type="defaultSemiBold">Votre commerce paie</ThemedText> la livraison (Mobile Money).
          </ThemedText>

          <ThemedText style={[styles.label, { color: palette.primaryDeep }]}>Client</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={clientNom}
            onChangeText={setClientNom}
            placeholder="Nom du destinataire"
            placeholderTextColor={colors.placeholder}
          />
          <TextInput
            style={[styles.input, { marginTop: 10, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={clientPhone}
            onChangeText={(t) => setClientPhone(formatPhone(t))}
            placeholder="Téléphone +XXX …"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
          />

          <ThemedText style={[styles.label, { color: palette.primaryDeep, marginTop: 16 }]}>
            Adresse de livraison
          </ThemedText>
          <DeliveryAddressForm value={address} onChange={setAddress} compact accentColor={palette.primary} />

          <ThemedText style={[styles.label, { color: palette.primaryDeep, marginTop: 8 }]}>
            Description du colis
          </ThemedText>
          <TextInput
            style={[styles.input, styles.area, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex. Sac noir, documents, nourriture à garder au chaud…"
            placeholderTextColor={colors.placeholder}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submit, { backgroundColor: palette.primaryDeep }, submitting && styles.submitDisabled]}
            onPress={() => void submit()}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={[styles.submitTxt, { color: colors.onPrimary }]}>Créer la livraison GoLivra</ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 80, marginTop: 0 },
  submit: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitTxt: { fontWeight: '800', fontSize: 16 },
});
