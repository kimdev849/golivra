import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from '@/hooks/use-safe-router';
import { ChevronLeft, Home, MapPin, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeliveryAddressForm, type DeliveryAddressFormValue } from '@/components/delivery-address-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { createUserAddress, deleteUserAddress, fetchUserAddresses, setPrincipalAddress, updateUserAddress, type UserAddress } from '@/lib/addresses';
import { getSessionToken } from '@/lib/auth';
import { addressLabel, deliveryAddressError, formatDeliveryAddressText } from '@/lib/format-address';
import { captureCurrentPosition } from '@/lib/location';

const emptyForm = (): DeliveryAddressFormValue => ({ libelle: '', quartier: '', ligne1: '', instructions: '', point_reperes: '', ville: 'Brazzaville', pays: 'Congo' });

export default function MyAddressesScreen() {
  const router = useRouter();
  const guarded = useGuardedCallback();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showError, showConfirm, FeedbackOverlay } = useActionFeedback();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserAddress[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Mode création : permet d'afficher le formulaire vide (« + Ajouter une
  // adresse ») en plus du mode modification (editingId !== null).
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DeliveryAddressFormValue>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        // Invité : rediriger vers la connexion au lieu du faux
        // message « Session expirée » (F-AUTH-01).
        router.replace('/auth');
        return;
      }
      setRows(await fetchUserAddresses(token));
    } catch (e) {
      showError('Chargement impossible', e instanceof Error ? e.message : undefined);
    }
    finally { setLoading(false); }
  }, [showError, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setForm(emptyForm());
  };

  const closeForm = () => {
    setCreating(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (a: UserAddress) => {
    setCreating(false);
    setForm({
      libelle: a.libelle ?? '',
      quartier: a.quartier || '',
      ligne1: a.ligne1,
      instructions: a.instructions ?? '',
      point_reperes: a.point_reperes ?? '',
      ville: a.ville || 'Brazzaville',
      pays: a.pays || 'Congo',
    });
    setEditingId(a.id);
  };

  const save = async () => {
    const e = deliveryAddressError(form);
    if (e) { showError('Adresse invalide', e); return; }
    setSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      // GPS en arrière-plan, en parallèle de l'enregistrement : n'attend jamais
      // la réponse de l'utilisateur ni le satellite pour sauvegarder.
      const coordsPromise = captureCurrentPosition();
      const current = editingId ? rows.find((r) => r.id === editingId) : undefined;
      const saved = editingId
        ? await updateUserAddress(token, editingId, {
            ...form,
            // Préserve le statut « principale » lors de la modification.
            est_principale: current?.est_principale === true,
          })
        : await createUserAddress(token, { ...form, est_principale: rows.length === 0 });
      const coords = await coordsPromise;
      // Rattache la position GPS une fois connue (si l'utilisateur a accordé la permission).
      if (coords && saved?.id) {
        await updateUserAddress(token, saved.id, {
          ...form,
          est_principale: saved.est_principale === true,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }).catch(() => {});
      }
      closeForm(); await load();
    } catch (e) { showError('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const remove = (id: string) => {
    showConfirm({
      title: 'Supprimer',
      message: 'Retirer cette adresse ?',
      primaryLabel: 'Supprimer',
      secondaryLabel: 'Annuler',
      onPrimary: async () => {
        const token = await getSessionToken();
        if (!token) return;
        await deleteUserAddress(token, id);
        await load();
      },
    });
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {rows.map((a) => (
              <View key={a.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <MapPin size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Home size={15} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {addressLabel(a.libelle)}
                    </ThemedText>
                    {a.est_principale ? <ThemedText style={[styles.principal, { color: colors.primary }]}>Principale</ThemedText> : null}
                  </View>
                  <ThemedText style={[styles.addrTxt, { color: colors.text }]}>{formatDeliveryAddressText({ quartier: a.quartier || '', ligne1: a.ligne1, point_reperes: a.point_reperes, instructions: a.instructions, ville: a.ville, pays: a.pays })}</ThemedText>
                  {!a.est_principale ? (
                    <Pressable onPress={() => { void (async () => { const token = await getSessionToken(); if (!token) return; await setPrincipalAddress(token, a.id); await load(); })(); }}>
                      <ThemedText style={[styles.setMain, { color: colors.primary }]}>Définir comme principale</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => startEdit(a)} hitSlop={10} style={styles.iconBtn}>
                    <Pencil size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </Pressable>
                  <Pressable onPress={() => remove(a.id)} hitSlop={10} style={styles.iconBtn}>
                    <Trash2 size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
                  </Pressable>
                </View>
              </View>
            ))}

            {creating || editingId !== null ? (
              <View style={[styles.formBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <ThemedText style={[styles.formTitle, { color: colors.text }]}>
                  {creating ? "Nouvelle adresse" : "Modifier l'adresse"}
                </ThemedText>
                <DeliveryAddressForm value={form} onChange={setForm} />
                <Pressable style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveDisabled]} onPress={() => guarded(() => void save())} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.saveTxt}>{creating ? "Enregistrer l'adresse" : 'Enregistrer les modifications'}</ThemedText>}
                </Pressable>
                <Pressable onPress={closeForm}>
                  <ThemedText style={[styles.cancel, { color: colors.textMuted }]}>Annuler</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.addBtn, { borderColor: colors.primary }]} onPress={startCreate}>
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
  actions: { flexDirection: 'row', gap: 14 },
  iconBtn: { padding: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  cardTitle: { fontSize: 15, flexShrink: 1 },
  principal: { fontSize: 11, fontWeight: '800' },
  addrTxt: { fontSize: 14, lineHeight: 20 },
  setMain: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  formBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  formTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  saveBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveDisabled: { opacity: 0.7 },
  saveTxt: { color: '#FFF', fontWeight: '800' },
  cancel: { textAlign: 'center', marginTop: 12, fontWeight: '600' },
  addBtn: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addTxt: { fontWeight: '800' },
});
