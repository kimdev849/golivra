import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeliveryAddressForm, type DeliveryAddressFormValue } from '@/components/delivery-address-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { createUserAddress, deleteUserAddress, fetchUserAddresses, setPrincipalAddress, type UserAddress } from '@/lib/addresses';
import { getSessionToken } from '@/lib/auth';
import { deliveryAddressError, formatDeliveryAddressText } from '@/lib/format-address';

const emptyForm = (): DeliveryAddressFormValue => ({ quartier: '', ligne1: '', instructions: '', point_reperes: '', ville: 'Brazzaville', pays: 'Congo' });

export default function MyAddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserAddress[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DeliveryAddressFormValue>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      setRows(await fetchUserAddresses(token));
    } catch (e) {
      showError('Chargement impossible', e instanceof Error ? e.message : undefined);
    }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveNew = async () => {
    const e = deliveryAddressError(form);
    if (e) { Alert.alert('Adresse invalide', e); return; }
    setSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      await createUserAddress(token, { ...form, est_principale: rows.length === 0 });
      setEditing(false); setForm(emptyForm()); await load();
    } catch (e) { Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const remove = (id: string) => {
    Alert.alert('Supprimer', 'Retirer cette adresse ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void (async () => { const token = await getSessionToken(); if (!token) return; await deleteUserAddress(token, id); await load(); })(); } },
    ]);
  };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.text }]}>Mes adresses</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {rows.map((a) => (
              <View key={a.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <MapPin size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                <View style={{ flex: 1 }}>
                  {a.est_principale ? <ThemedText style={[styles.principal, { color: colors.primary }]}>Principale</ThemedText> : null}
                  <ThemedText style={[styles.addrTxt, { color: colors.text }]}>{formatDeliveryAddressText({ quartier: a.quartier || '', ligne1: a.ligne1, point_reperes: a.point_reperes, instructions: a.instructions, ville: a.ville, pays: a.pays })}</ThemedText>
                  {!a.est_principale ? (
                    <Pressable onPress={() => { void (async () => { const token = await getSessionToken(); if (!token) return; await setPrincipalAddress(token, a.id); await load(); })(); }}>
                      <ThemedText style={[styles.setMain, { color: colors.primary }]}>Définir comme principale</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable onPress={() => remove(a.id)} hitSlop={10}>
                  <Trash2 size={20} color={colors.error} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              </View>
            ))}

            {editing ? (
              <View style={[styles.formBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <DeliveryAddressForm value={form} onChange={setForm} />
                <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveDisabled]} onPress={() => void saveNew()} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.saveTxt}>Enregistrer</ThemedText>}
                </Pressable>
                <Pressable onPress={() => setEditing(false)}>
                  <ThemedText style={[styles.cancel, { color: colors.textMuted }]}>Annuler</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.addBtn, { borderColor: colors.primary }]} onPress={() => setEditing(true)}>
                <ThemedText style={[styles.addTxt, { color: colors.primaryDeep }]}>+ Ajouter une adresse</ThemedText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 44 },
  card: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10, alignItems: 'flex-start' },
  principal: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  addrTxt: { fontSize: 14, lineHeight: 20 },
  setMain: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  formBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  saveBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveDisabled: { opacity: 0.7 },
  saveTxt: { color: '#FFF', fontWeight: '800' },
  cancel: { textAlign: 'center', marginTop: 12, fontWeight: '600' },
  addBtn: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addTxt: { fontWeight: '800' },
});
