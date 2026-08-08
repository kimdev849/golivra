import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bike,
  CheckCircle2,
  Circle,
  CreditCard,
  MapPin,
  PackageCheck,
  Phone,
  Store,
  User,
  XCircle,
} from 'lucide-react-native';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { formatFcfa } from '@/lib/format';
import {
  fetchVendorDeliveryDetails,
  livraisonStatutLabel,
  type VendorDeliveryDetail,
} from '@/lib/vendor-api';

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

const DONE_STATUTS = ['livree', 'annulee'];

export default function VendorDeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { palette } = useVendorTheme();
  const [detail, setDetail] = useState<VendorDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getSessionToken();
      if (!token) return;
      const data = await fetchVendorDeliveryDetails(token, id);
      setDetail(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rafraîchissement en direct tant que la livraison n'est pas terminée.
  const statut = detail?.livraison.statut;
  useEffect(() => {
    if (!statut || DONE_STATUTS.includes(statut)) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [statut, load]);

  const liv = detail?.livraison;
  const livreur = detail?.livreur;
  const livree = liv?.statut === 'livree';
  const annulee = liv?.statut === 'annulee';
  const methodeLabel =
    liv?.methode_paiement === 'airtel_money'
      ? 'Airtel Money'
      : liv?.methode_paiement === 'mtn_money'
        ? 'MTN MoMo'
        : liv?.methode_paiement
          ? liv.methode_paiement
          : 'Mobile Money';
  const paye = liv?.paiement_statut === 'valide';

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Suivi de la livraison" subtitle="De la création à la livraison" />

      {loading && !detail ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : error && !detail ? (
        <View style={[styles.center, { padding: 24 }]}>
          <ThemedText style={[styles.errTxt, { color: colors.error }]}>{error}</ThemedText>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: palette.primary }]}
            onPress={() => {
              setLoading(true);
              void load();
            }}>
            <ThemedText style={styles.retryTxt}>Réessayer</ThemedText>
          </Pressable>
        </View>
      ) : detail && liv ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
          {/* En-tête statut */}
          <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
                {liv.client_nom || 'Livraison GoLivra'}
              </ThemedText>
              <ThemedText style={[styles.heroRef, { color: colors.textMuted }]}>
                {liv.type_livraison === 'externe' ? 'Livraison du commerce' : `#${liv.id.slice(0, 8).toUpperCase()}`}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: annulee
                    ? colors.errorSoft
                    : livree
                      ? colors.successSoft
                      : colors.primarySoft,
                },
              ]}>
              <ThemedText
                style={[
                  styles.statusTxt,
                  {
                    color: annulee
                      ? colors.error
                      : livree
                        ? colors.success
                        : palette.primary,
                  },
                ]}>
                {livraisonStatutLabel(liv.statut)}
              </ThemedText>
            </View>
          </View>

          {/* Félicitations quand la livraison est arrivée */}
          {livree ? (
            <View style={[styles.congrats, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <PackageCheck size={22} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.congratsTitle, { color: colors.success }]}>
                  Colis bien arrivé 🎉
                </ThemedText>
                <ThemedText style={[styles.congratsSub, { color: colors.textSecondary }]}>
                  {liv.livree_at
                    ? `Livré le ${formatDateFr(liv.livree_at)}. Bravo, mission accomplie !`
                    : 'Votre client a bien reçu son colis. Bravo !'}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {/* Traçabilité A→Z */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Bike size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Parcours de la livraison</ThemedText>
            </View>
            {annulee ? (
              <View style={[styles.cancelBox, { backgroundColor: colors.errorSoft }]}>
                <XCircle size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.cancelTxt, { color: colors.error }]}>
                  Cette livraison a été annulée.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.timeline}>
                {detail.timeline.map((step, idx) => {
                  const isFait = step.type === 'fait';
                  const isEnCours = step.type === 'encours';
                  const isLast = idx === detail.timeline.length - 1;
                  return (
                    <View key={step.key} style={styles.stepRow}>
                      <View style={styles.stepRail}>
                        {isFait ? (
                          <CheckCircle2 size={20} color={colors.success} strokeWidth={LUCIDE_STROKE} />
                        ) : isEnCours ? (
                          <Circle size={20} color={palette.primary} strokeWidth={2.4} />
                        ) : (
                          <Circle size={20} color={colors.borderStrong} strokeWidth={LUCIDE_STROKE} />
                        )}
                        {!isLast ? (
                          <View
                            style={[
                              styles.stepLine,
                              { backgroundColor: isFait ? colors.success : colors.border },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={styles.stepBody}>
                        <ThemedText
                          style={[
                            styles.stepTitre,
                            {
                              color: isFait || isEnCours ? colors.text : colors.textMuted,
                              fontWeight: isEnCours ? '900' : '700',
                            },
                          ]}>
                          {step.titre}
                        </ThemedText>
                        {step.date ? (
                          <ThemedText style={[styles.stepDate, { color: colors.textMuted }]}>
                            {formatDateFr(step.date)}
                          </ThemedText>
                        ) : null}
                        {isEnCours ? (
                          <ThemedText style={[styles.stepEnCours, { color: palette.primary }]}>
                            En cours…
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Livreur */}
          {livreur ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Bike size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Votre livreur</ThemedText>
              </View>
              <View style={styles.livreurRow}>
                <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                  <User size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.livreurNom, { color: colors.text }]}>{livreur.nom}</ThemedText>
                  <ThemedText style={[styles.livreurMeta, { color: colors.textMuted }]}>
                    {livreur.type_vehicule ? `${livreur.type_vehicule} · ` : ''}
                    {livreur.nb_livraisons_reussies ?? 0} livraison{livreur.nb_livraisons_reussies === 1 ? '' : 's'} réussie{livreur.nb_livraisons_reussies === 1 ? '' : 's'}
                  </ThemedText>
                </View>
                {livreur.telephone ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => void Linking.openURL(`tel:${livreur.telephone}`)}
                    style={[styles.callBtn, { backgroundColor: colors.primarySoft }]}>
                    <Phone size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                  </Pressable>
                ) : null}
              </View>
              {liv.statut === 'en_route' || liv.statut === 'collectee' ? (
                <ThemedText style={[styles.livreurHint, { color: palette.primary }]}>
                  🛵 Votre commande est en route vers le client…
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {/* Client */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <User size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Client</ThemedText>
            </View>
            {liv.client_nom ? (
              <ThemedText style={[styles.infoText, { color: colors.text }]}>{liv.client_nom}</ThemedText>
            ) : null}
            {liv.client_telephone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${liv.client_telephone}`)}
                style={styles.infoRow}
                hitSlop={8}>
                <Phone size={15} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.infoLink, { color: palette.primary }]}>{liv.client_telephone}</ThemedText>
              </Pressable>
            ) : null}
            {detail.commerce?.nom ? (
              <View style={[styles.infoRow, { marginTop: 10 }]}>
                <Store size={15} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.infoText, { color: colors.textSecondary, flex: 1 }]}>
                  {detail.commerce.nom} — {liv.adresse_retrait || detail.commerce.adresse || 'retrait sur place'}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Adresse de livraison */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <MapPin size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Adresse de livraison</ThemedText>
            </View>
            <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
              {liv.adresse_livraison || '—'}
            </ThemedText>
            {liv.note ? (
              <ThemedText style={[styles.noteTxt, { color: colors.textMuted }]}>Colis : {liv.note}</ThemedText>
            ) : null}
          </View>

          {/* Paiement */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <CreditCard size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Paiement</ThemedText>
            </View>
            <View style={styles.payRow}>
              <ThemedText style={[styles.payLabel, { color: colors.textMuted }]}>Frais de livraison</ThemedText>
              <ThemedText style={[styles.payValue, { color: colors.text }]}>
                {formatFcfa(liv.montant_total ?? 0)}
              </ThemedText>
            </View>
            <View style={styles.payRow}>
              <ThemedText style={[styles.payLabel, { color: colors.textMuted }]}>Méthode</ThemedText>
              <ThemedText style={[styles.payValue, { color: colors.text }]}>{methodeLabel}</ThemedText>
            </View>
            <View style={styles.payRow}>
              <ThemedText style={[styles.payLabel, { color: colors.textMuted }]}>Statut</ThemedText>
              <View
                style={[
                  styles.payStatusPill,
                  {
                    backgroundColor: paye ? colors.successSoft : annulee ? colors.errorSoft : colors.warningSoft,
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.payStatusTxt,
                    { color: paye ? colors.success : annulee ? colors.error : colors.warning },
                  ]}>
                  {paye ? 'Payé ✓' : annulee ? 'Échoué' : 'En attente'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Preuve de livraison */}
          {livree && liv.proof?.photoUrl ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <PackageCheck size={17} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Preuve de livraison</ThemedText>
              </View>
              <Image
                source={{ uri: liv.proof.photoUrl }}
                style={styles.proofImg}
                contentFit="cover"
                transition={150}
              />
              {liv.proof.gpsLat != null && liv.proof.gpsLng != null ? (
                <ThemedText style={[styles.proofMeta, { color: colors.textMuted }]}>
                  📍 {liv.proof.gpsLat.toFixed(5)}, {liv.proof.gpsLng.toFixed(5)}
                </ThemedText>
              ) : null}
              {liv.proof.takenAt ? (
                <ThemedText style={[styles.proofMeta, { color: colors.textMuted }]}>
                  🕐 {formatDateFr(liv.proof.takenAt)}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errTxt: { fontWeight: '700', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  retryTxt: { color: '#FFF', fontWeight: '800' },
  scroll: { padding: 18, gap: 12 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  heroTitle: { fontSize: 19, fontWeight: '900' },
  heroRef: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusTxt: { fontSize: 12, fontWeight: '800' },

  congrats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  congratsTitle: { fontSize: 15, fontWeight: '900' },
  congratsSub: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },

  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14.5, fontWeight: '800' },

  cancelBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  cancelTxt: { fontSize: 13, fontWeight: '700' },

  timeline: { marginTop: 2, gap: 0 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  stepLine: { width: 2, flex: 1, minHeight: 22, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 18 },
  stepTitre: { fontSize: 14.5 },
  stepDate: { fontSize: 12, marginTop: 2 },
  stepEnCours: { fontSize: 12, fontWeight: '800', marginTop: 2 },

  livreurRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  livreurNom: { fontSize: 15.5, fontWeight: '800' },
  livreurMeta: { fontSize: 12.5, marginTop: 2 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  livreurHint: { fontSize: 13, fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, lineHeight: 20 },
  infoLink: { fontSize: 14.5, fontWeight: '800', textDecorationLine: 'underline' },
  noteTxt: { fontSize: 12.5, fontStyle: 'italic' },

  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { fontSize: 13, fontWeight: '600' },
  payValue: { fontSize: 14, fontWeight: '800' },
  payStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  payStatusTxt: { fontSize: 12, fontWeight: '800' },

  proofImg: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#000' },
  proofMeta: { fontSize: 12.5, fontWeight: '600' },
});
