import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { formatFcfa } from '@/lib/format';
import { fetchMyWallet, requestWithdrawal, type WalletDashboard } from '@/lib/wallet-api';
import { validatePhone } from '@/lib/form-validation';

export default function VendorWalletScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const { palette } = useVendorTheme();
  const [wallet, setWallet] = useState<WalletDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) return;
      setWallet(await fetchMyWallet(token));
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRetrait = async () => {
    const token = await getSessionToken();
    if (!token) return;
    const m = Number(montant);
    if (!m || m < 1000) {
      showError('Montant invalide', 'Minimum 1 000 FCFA.');
      return;
    }
    const eNum = validatePhone(numero);
    if (!eNum.ok) {
      showError('Numéro invalide', eNum.message);
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal(token, {
        montant: m,
        methode: 'airtel_money',
        numero_compte: numero.trim(),
      });
      showSuccess('Demande envoyée', 'GoLivra validera votre retrait sous 1 à 3 jours.');
      setMontant('');
      await load();
    } catch (e) {
      showError('Erreur', e instanceof Error ? e.message : 'Échec du retrait.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title="PORTEFEUILLE" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 20 }}>
        <LinearGradient colors={[...palette.gradient]} style={styles.balanceCard}>
          <ThemedText style={styles.balLab}>Solde disponible (ventes)</ThemedText>
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} style={{ marginTop: 12 }} />
          ) : (
            <ThemedText style={styles.balVal}>{formatFcfa(wallet?.solde_fcfa ?? 0)}</ThemedText>
          )}
          <ThemedText style={styles.balHint}>
            100 % de vos ventes — GoLivra ne prend pas de commission sur les produits.
          </ThemedText>
        </LinearGradient>

        <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text }]}>
          Retrait Mobile Money
        </ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          placeholder="Montant (FCFA)"
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric"
          value={montant}
          onChangeText={setMontant}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          placeholder="Numéro Airtel / MTN"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          value={numero}
          onChangeText={setNumero}
        />
        <Pressable
          style={[styles.btn, { backgroundColor: palette.primary }]}
          onPress={() => void onRetrait()}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <ThemedText style={styles.btnText}>Demander un retrait</ThemedText>
          )}
        </Pressable>

        <ThemedText type="defaultSemiBold" style={[styles.h, { color: colors.text, marginTop: 24 }]}>
          Transactions
        </ThemedText>
        {(wallet?.transactions ?? []).length === 0 ? (
          <ThemedText style={[styles.empty, { color: colors.textMuted }]}>Aucune transaction pour le moment.</ThemedText>
        ) : (
          (wallet?.transactions ?? []).map((t) => (
            <View key={t.id} style={[styles.txn, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.txnLab, { color: colors.text }]}>{t.description || t.type}</ThemedText>
              </View>
              <ThemedText style={[styles.txnAmt, { color: t.type === 'debit' ? colors.error : colors.success }]}>
                {t.type === 'debit' ? '-' : '+'}
                {formatFcfa(t.montant)}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  balanceCard: { borderRadius: 18, padding: 20, marginBottom: 22 },
  balLab: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600' },
  balVal: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 8 },
  balHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 8 },
  h: { fontSize: 16, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    fontSize: 16,
  },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { fontSize: 14, paddingVertical: 16 },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txnLab: { fontSize: 15, fontWeight: '700' },
  txnAmt: { fontSize: 15, fontWeight: '800' },
});
