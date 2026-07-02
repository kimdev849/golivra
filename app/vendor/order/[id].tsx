import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Phone, Truck } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
import type { VendorOrder, VendorOrderStatus } from '@/lib/vendor-types';
import { hrefVendorPreparation } from '@/lib/vendor-nav';
import { vendorOrderStatusLabel as statusLabel } from '@/lib/ux-copy';

export default function VendorOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, refresh } = useVendor();
  const [acting, setActing] = useState(false);
  const colors = useAppColors();
  const { showSuccess, showError, showConfirm, FeedbackOverlay } = useActionFeedback();
  const styles = useThemedStyles(createVendorOrderDetailStyles);
  const { palette, labels } = useVendorTheme();
  const orderId = typeof id === 'string' ? id : '';
  const cached = orders.find((x) => x.id === orderId);

  const [o, setO] = useState<VendorOrder | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [livraisonLabel, setLivraisonLabel] = useState<string | null>(null);

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
        setO(order);
        const statut = delivery?.delivery?.statut ?? order.livraison_statut;
        setLivraisonLabel(livraisonStatutLabel(statut));
      } catch {
        if (!cancelled && !cached) setO(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, cached]);

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

  const runStatus = async (statut: string, msg: string, raisonRefus?: string) => {
    const token = await getSessionToken();
    if (!token || !o.sous_commande_id) return;
    setActing(true);
    try {
      await updateVendorOrderStatus(token, o.id, statut, o.sous_commande_id, raisonRefus);
      const updated = await fetchVendorOrder(token, o.id);
      setO(updated);
      showSuccess('C’est enregistré', msg);
      void refresh();
    } catch (e) {
      showError('Mise à jour impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setActing(false);
    }
  };

  const refuseOrder = () => {
    showConfirm({
      title: 'Refuser la commande',
      message: 'Confirmer le refus ?',
      primaryLabel: 'Refuser',
      secondaryLabel: 'Annuler',
      onPrimary: () => {
        void runStatus('refusee', 'Commande refusée.', 'Refusé par le commerce').then(() => router.back());
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
            <ThemedText style={styles.sumLab}>Sous-total</ThemedText>
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
              disabled={acting}
              onPress={() => void runStatus('acceptee', 'Commande acceptée.')}>
              <ThemedText style={styles.primaryTxt}>Accepter</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, { flex: 1, borderColor: colors.error }]}
              disabled={acting}
              onPress={refuseOrder}>
              <ThemedText style={[styles.outlineTxt, { color: colors.error }]}>Refuser</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {showPrep ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: palette.primaryDeep }]}
            onPress={() => router.push(hrefVendorPreparation(o.id))}>
            <ThemedText style={styles.primaryTxt}>{labels.orderPrimaryCta}</ThemedText>
          </Pressable>
        ) : null}
        {showDelivery ? (
          <Pressable
            style={[styles.outlineBtn, { borderColor: palette.primary }]}
            onPress={() => router.push('/vendor/delivery')}>
            <ThemedText style={[styles.outlineTxt, { color: palette.primary }]}>Suivre la livraison GoLivra</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}
