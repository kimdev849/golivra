import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { CheckCircle2, CreditCard, MapPin, Smartphone, Wallet } from 'lucide-react-native';

import { DeliveryAddressForm, type DeliveryAddressFormValue } from '@/components/delivery-address-form';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVendor } from '@/contexts/vendor-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import { deliveryAddressError, snapshotFromFields } from '@/lib/format-address';
import { formatFcfa } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import {
  CLIENT_PAYMENT_METHODS,
  type ClientPaymentMethodId,
} from '@/lib/payment-methods';
import {
  createVendorExternalDelivery,
  fetchVendorDeliveryPaymentStatus,
} from '@/lib/vendor-api';
import {
  DEFAULT_PUBLIC_PRICING,
  deliveryFeeForQuartier,
  fetchPublicPricing,
  zoneLabelForQuartier,
  type PublicPricing,
} from '@/lib/pricing';
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

type PayState = 'idle' | 'processing' | 'waiting' | 'failed';

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
  const [payMethod, setPayMethod] = useState<ClientPaymentMethodId>('mtn_money');
  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  const [payState, setPayState] = useState<PayState>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void fetchPublicPricing().then(setPricing);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Prix de la livraison selon la ZONE / l'arrondissement choisi (tarif GoLivra).
  const price = deliveryFeeForQuartier(address.quartier, pricing ?? DEFAULT_PUBLIC_PRICING);
  const zoneLabel = pricing ? zoneLabelForQuartier(address.quartier, pricing) : null;
  const payPhone = String(shop?.telephone || '').trim();
  const busy = payState === 'processing' || payState === 'waiting';

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finishSuccess = useCallback(() => {
    stopPolling();
    router.replace(VENDOR_HREF.deliveriesTab);
    showSuccess(
      'Livraison créée ! 🎉',
      'Paiement confirmé. Un livreur est contacté pour récupérer votre colis — vous serez notifié à chaque étape.',
      { primaryLabel: 'OK' },
    );
  }, [router, showSuccess, stopPolling]);

  const startPolling = useCallback(
    (deliveryId: string) => {
      let tries = 0;
      stopPolling();
      pollRef.current = setInterval(() => {
        tries += 1;
        void (async () => {
          try {
            const token = await getSessionToken();
            if (!token) return;
            const st = await fetchVendorDeliveryPaymentStatus(token, deliveryId);
            if (st.statut === 'valide') {
              finishSuccess();
            } else if (st.statut === 'echoue') {
              stopPolling();
              setPayState('failed');
              setPayError('Le paiement a été refusé. Réessayez avec Mobile Money.');
            } else if (tries > 40) {
              stopPolling();
              setPayState('failed');
              setPayError(
                'La confirmation prend trop de temps. Vérifiez votre compte Mobile Money puis réessayez.',
              );
            }
          } catch {
            /* on continue d'interroger */
          }
        })();
      }, 3000);
    },
    [finishSuccess, stopPolling],
  );

  const payAndCreate = async () => {
    if (busy) return;
    if (!shop?.id) {
      showError('Commerce introuvable', 'Rechargez votre espace vendeur puis réessayez.');
      return;
    }
    if (!payPhone) {
      showError('Téléphone manquant', 'Ajoutez un téléphone à votre commerce pour payer la livraison.');
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

    setPayState('processing');
    setPayError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const result = await createVendorExternalDelivery(token, {
        establishmentId: shop.id,
        establishmentType: shop.type,
        clientNom: nom,
        clientTelephone: tel,
        adresse: snapshotFromFields(address),
        note: description.trim() || undefined,
        methodePaiement: payMethod,
        telephonePaiement: payPhone,
      });
      // Test / simulation → validé immédiatement ; live → confirmation à suivre.
      if (result.paiement.statut === 'valide') {
        finishSuccess();
        return;
      }
      setPayState('waiting');
      startPolling(result.livraison.id);
    } catch (e) {
      setPayState('failed');
      setPayError(e instanceof Error ? e.message : 'Paiement impossible, réessayez.');
    }
  };

  const methodeLabel = (id: ClientPaymentMethodId) =>
    CLIENT_PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title="Créer une livraison" subtitle="Paiement Mobile Money avant l'envoi" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          pointerEvents={busy ? 'none' : 'auto'}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
          <ThemedText style={[styles.intro, { color: colors.textMuted }]}>
            Choisissez l’arrondissement, le prix s’ajuste automatiquement. La livraison n’est
            créée qu’après paiement depuis le téléphone de votre commerce.
          </ThemedText>

          {/* ── Prix selon la zone + méthode de paiement ── */}
          <View style={[styles.priceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.priceIcon, { backgroundColor: colors.primarySoft }]}>
              <Wallet size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.priceRow}>
                <ThemedText style={[styles.priceValue, { color: colors.text }]}>{formatFcfa(price)}</ThemedText>
                {zoneLabel ? (
                  <View style={[styles.zonePill, { backgroundColor: colors.primarySoft }]}>
                    <MapPin size={11} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.zonePillTxt, { color: palette.primary }]}>{zoneLabel}</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[styles.priceSub, { color: colors.textMuted }]}>
                Frais de livraison GoLivra — {address.quartier ? `vers ${address.quartier}` : 'selon l\u2019arrondissement choisi'}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.label, { color: palette.primaryDeep }]}>Paiement Mobile Money</ThemedText>
          <View style={styles.payRow}>
            {CLIENT_PAYMENT_METHODS.map((m) => {
              const active = payMethod === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    styles.payChip,
                    {
                      borderColor: active ? palette.primary : colors.border,
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                    },
                  ]}
                  onPress={() => setPayMethod(m.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <CreditCard size={16} color={active ? palette.primary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText
                    style={[styles.payChipTxt, { color: active ? palette.primary : colors.textSecondary }]}>
                    {m.shortLabel}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.phoneRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Smartphone size={15} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.phoneTxt, { color: colors.textSecondary }]} numberOfLines={1}>
              {payPhone ? `Paiement depuis le téléphone du commerce : ${payPhone}` : 'Ajoutez un téléphone à votre commerce pour payer'}
            </ThemedText>
          </View>

          <ThemedText style={[styles.label, { color: palette.primaryDeep, marginTop: 16 }]}>Client</ThemedText>
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
          <DeliveryAddressForm value={address} onChange={setAddress} compact accentColor={palette.primary} hideLibelle />

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

          {payError ? (
            <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.errorSoft }]}>
              <ThemedText style={[styles.errorTxt, { color: colors.error }]}>{payError}</ThemedText>
            </View>
          ) : null}

          {payState === 'waiting' ? (
            <View style={[styles.waitingBox, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
              <ActivityIndicator color={colors.warning} size="small" />
              <ThemedText style={[styles.waitingTxt, { color: colors.warning }]}>
                Ouvrez votre compte {methodeLabel(payMethod)} et validez la transaction avec votre code PIN…
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            style={[styles.submit, { backgroundColor: palette.primaryDeep }, busy && styles.submitDisabled]}
            onPress={() => void payAndCreate()}
            disabled={busy}>
            {busy ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <ThemedText style={[styles.submitTxt, { color: colors.onPrimary }]}>
                  {payState === 'processing' ? 'Paiement en cours…' : 'En attente de confirmation…'}
                </ThemedText>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.submitTxt, { color: colors.onPrimary }]}>
                  {payState === 'failed' ? 'Réessayer le paiement' : `Payer ${formatFcfa(price)} et créer la livraison`}
                </ThemedText>
              </>
            )}
          </Pressable>
          <ThemedText style={[styles.footNote, { color: colors.textMuted }]}>
            Votre colis est pris en charge dès le paiement confirmé — un livreur viendra le récupérer.
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { fontSize: 13.5, lineHeight: 20, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 80, marginTop: 0 },

  /* Carte prix */
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  priceIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  zonePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  zonePillTxt: { fontSize: 11, fontWeight: '800' },
  priceSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  /* Méthode de paiement */
  payRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  payChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  payChipTxt: { fontSize: 14, fontWeight: '800' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  phoneTxt: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  errorBox: { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 14 },
  errorTxt: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
  },
  waitingTxt: { flex: 1, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 15,
  },
  submitDisabled: { opacity: 0.85 },
  submitTxt: { fontWeight: '900', fontSize: 15.5 },
  footNote: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
