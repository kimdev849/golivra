import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Phone, Truck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useVendor } from '@/contexts/vendor-context';
import { getSessionToken } from '@/lib/auth';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import {
  createVendorOrderDetailStyles,
  vendorStatusBadge,
} from '@/constants/vendor-detail-styles';
import { formatFcfa } from '@/lib/format';
import {
  fetchDeliveryStatus,
  fetchVendorOrder,
  livraisonStatutLabel,
  updateVendorOrderStatus,
} from '@/lib/vendor-api';
import type { VendorOrder } from '@/lib/vendor-types';

import { vendorOrderStatusLabel as statusLabel } from '@/lib/ux-copy';

export default function VendorOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, refreshOrders, setOrders } = useVendor();
  const [actingAction, setActingAction] = useState<string | null>(null);
  const colors = useAppColors();
  const { showSuccess, showError, showConfirm, FeedbackOverlay } = useActionFeedback();
  const styles = useThemedStyles(createVendorOrderDetailStyles);
  const { palette, labels } = useVendorTheme();
  const orderId = typeof id === 'string' ? id : '';
  const cached = orders.find((x) => x.id === orderId);

  const [o, setO] = useState<VendorOrder | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [livraisonLabel, setLivraisonLabel] = useState<string | null>(null);
  // Marque une action en cours pour éviter que le fetch initial (lancé au montage)
  // n'écrase la mise à jour optimiste avec l'état serveur périmé.
  const actingRef = useRef(false);

  // Synchronise l'écran avec le store (silencieux, sans requête) : quand la
  // liste des commandes évolue (mise à jour optimiste, refresh en arrière-plan),
  // le détail affiche immédiatement l'état à jour, sans écran de chargement.
  useEffect(() => {
    if (cached) setO(cached);
  }, [cached]);

  // Fetch initial unique : détail de la commande + statut livraison.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!orderId) return;
      try {
        const token = await getSessionToken();
        if (!token) return;
        const [order, delivery] = await Promise.all([
          fetchVendorOrder(token, orderId),
          fetchDeliveryStatus(token, orderId).catch(() => null),
        ]);
        if (cancelled) return;
        // Si une action (accepter/refuser) est en cours, on laisse l'optimiste
        // s'appliquer : le refresh en arrière-plan synchronisera l'état frais.
        if (!actingRef.current) setO(order);
        const statut = delivery?.delivery?.statut ?? order.livraison_statut;
        if (!actingRef.current) setLivraisonLabel(livraisonStatutLabel(statut));
      } catch {
        if (!cancelled) setO((cur) => cur ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <ThemedView style={styles.screen}>
        <VendorScreenHeader title="Détail commande" />
        <ActivityIndicator style={{ marginTop: 40 }} color={palette.primary} />
      </ThemedView>
    );
  }

  if (!o) {
    return (
      <ThemedView style={styles.screen}>
        <VendorScreenHeader title="Détail commande" />
        <ThemedText style={{ padding: 24 }}>Commande introuvable.</ThemedText>
      </ThemedView>
    );
  }

  const st = vendorStatusBadge(o.statut, colors);
  const total = o.prixTotal + o.fraisLivraison;
  const showAccept = o.statut === 'en_attente';
  const showPrep = o.statut === 'a_preparer' || o.statut === 'en_preparation';
  const showDelivery = o.statut === 'prete' || o.statut === 'en_livraison';
  // Nouveau parcours : le client paie APRÈS acceptation. Tant que le paiement
  // n'est pas validé, la commande n'est pas réellement confirmée → pas de
  // préparation possible.
  const paid = o.paiement_statut === 'valide';
  const waitingClientPayment = o.statut === 'a_preparer' && !paid;

  const runStatus = async (
    statut: string,
    msg: string,
    actionKey: string,
    raisonRefus?: string,
  ) => {
    if (!o || !o.sous_commande_id) return;
    const token = await getSessionToken();
    if (!token) return;
    const previous = o;
    // Optimiste : l'UI change immédiatement (badge, boutons), sans écran blanc
    // ni rechargement. Un petit spinner apparaît uniquement dans le bouton cliqué.
    setO((cur) => (cur ? { ...cur, statut: statut as typeof cur.statut } : cur));
    setOrders((prev) =>
      prev.map((x) => (x.id === o.id ? { ...x, statut: statut as typeof x.statut } : x)),
    );
    setActingAction(actionKey);
    actingRef.current = true;
    try {
      await updateVendorOrderStatus(token, o.id, statut, o.sous_commande_id, raisonRefus);
      showSuccess('C’est enregistré', msg);
      // Synchronisation en arrière-plan : commandes seules, sans loading.
      void refreshOrders();
    } catch (e) {
      // Rollback si le serveur a refusé.
      setO(previous);
      setOrders((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, statut: previous.statut } : x)),
      );
      showError('Mise à jour impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setActingAction(null);
      actingRef.current = false;
    }
  };

  const refuseOrder = () => {
    showConfirm({
      title: 'Refuser la commande',
      message: 'Confirmer le refus ?',
      primaryLabel: 'Refuser',
      secondaryLabel: 'Annuler',
      onPrimary: () => {
        void runStatus('refusee', 'Commande refusée.', 'refuse', 'Refusé par le commerce').then(
          () => router.back(),
        );
      },
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title="Détail commande" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 18 }}>
        <View style={styles.topRow}>
          <ThemedText type="defaultSemiBold" style={styles.ref}>
            #{o.ref}
          </ThemedText>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <ThemedText style={[styles.badgeText, { color: st.text }]}>
              {statusLabel(o.statut)}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="defaultSemiBold" style={styles.bigPrice}>
          {formatFcfa(o.prixTotal)}
        </ThemedText>
        <ThemedText style={styles.time}>{o.creeLeLabel}</ThemedText>

        <View style={[styles.deliveryBox, { backgroundColor: palette.primarySoft, borderColor: palette.onlinePillBorder }]}>
          <Truck size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.deliveryTitle, { color: palette.primaryDeep }]}>
              Livraison GoLivra
            </ThemedText>
            <ThemedText style={styles.deliveryHint}>
              {livraisonLabel ?? livraisonStatutLabel(o.livraison_statut)}
            </ThemedText>
            {o.livreur ? (
              <ThemedText style={styles.livreur}>
                Livreur : {o.livreur.nom}
                {o.livreur.tel ? ` · ${o.livreur.tel}` : ''}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <ThemedText style={styles.sectionLabel}>Client</ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.blockVal}>
          {o.clientNom}
        </ThemedText>
        <View style={styles.phoneRow}>
          <ThemedText style={styles.blockVal}>{o.clientTel}</ThemedText>
          <Pressable
            style={[styles.iconCircle, { backgroundColor: palette.primary }]}
            onPress={() => {
              if (o.clientTel) void Linking.openURL(`tel:${o.clientTel}`);
            }}>
            <Phone size={18} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionLabel, { marginTop: 18 }]}>Adresse de livraison</ThemedText>
        <View style={styles.addrRow}>
          <ThemedText style={styles.addr}>{o.adresse}</ThemedText>
          <MapPin size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
        </View>

        <ThemedText style={[styles.sectionLabel, { marginTop: 18 }]}>
          {labels.orderArticlesTitle} ({o.lignes.length})
        </ThemedText>
        <View style={{ gap: 10 }}>
          {o.lignes.map((l) => (
            <View key={l.id} style={styles.lineRow}>
              <View style={styles.lineThumb} />
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={styles.lineName}>
                  {l.nom}
                </ThemedText>
                {l.detail ? <ThemedText style={styles.lineDet}>{l.detail}</ThemedText> : null}
                <ThemedText style={styles.linePrice}>
                  {l.quantite} × {formatFcfa(l.prixUnitaire)}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sumBox}>
          <View style={styles.sumRow}>
            <ThemedText style={styles.sumLab}>Total articles</ThemedText>
            <ThemedText style={styles.sumVal}>{formatFcfa(o.prixTotal)}</ThemedText>
          </View>
          <View style={styles.sumRow}>
            <ThemedText style={styles.sumLab}>Frais de livraison GoLivra</ThemedText>
            <ThemedText style={styles.sumVal}>{formatFcfa(o.fraisLivraison)}</ThemedText>
          </View>
          <View style={[styles.sumRow, styles.sumTotal]}>
            <ThemedText type="defaultSemiBold" style={styles.totalLab}>
              Total
            </ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.totalVal}>
              {formatFcfa(total)}
            </ThemedText>
          </View>
        </View>

        {showAccept ? (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.primaryBtn, { flex: 1, backgroundColor: palette.primary }]}
              disabled={actingAction !== null}
              onPress={() => void runStatus('acceptee', 'Commande acceptée.', 'accept')}>
              {actingAction === 'accept' ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <ThemedText style={styles.primaryTxt}>Accepter</ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, { flex: 1, borderColor: colors.error }]}
              disabled={actingAction !== null}
              onPress={refuseOrder}>
              {actingAction === 'refuse' ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <ThemedText style={[styles.outlineTxt, { color: colors.error }]}>Refuser</ThemedText>
              )}
            </Pressable>
          </View>
        ) : null}
        {waitingClientPayment ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.warning,
              backgroundColor: colors.warningSoft,
              padding: 14,
              gap: 4,
            }}>
            <ThemedText style={{ color: colors.warning, fontWeight: '800', fontSize: 14 }}>
              En attente de paiement du client
            </ThemedText>
            <ThemedText style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              La commande est acceptée. La préparation démarrera dès la confirmation du paiement
              (le client a 5 minutes pour payer).
            </ThemedText>
          </View>
        ) : null}
        {showPrep && paid ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primaryDeep }]}
            disabled={actingAction !== null}
            onPress={() => o.statut === 'en_preparation'
              ? runStatus('prete', 'Commande prête.', 'ready')
              : runStatus('en_preparation', 'Préparation démarrée.', 'prep')}>
            {actingAction === 'prep' || actingAction === 'ready' ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <ThemedText style={styles.primaryTxt}>{o.statut === 'en_preparation' ? 'Marquer prête' : labels.orderPrimaryCta}</ThemedText>
            )}
          </Pressable>
        ) : null}
        {showDelivery ? (
          <Pressable
            style={[styles.outlineBtn, { borderColor: palette.primary }]}
            onPress={() =>
              o.livraison_id
                ? router.push({ pathname: '/vendor/delivery/[id]', params: { id: o.livraison_id } })
                : router.push('/vendor/delivery')
            }>
            <ThemedText style={[styles.outlineTxt, { color: palette.primary }]}>Suivre la livraison GoLivra</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}
