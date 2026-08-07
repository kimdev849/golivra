import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVendor } from '@/contexts/vendor-context';
import { createVendorPreparationStyles } from '@/constants/vendor-detail-styles';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { getSessionToken } from '@/lib/auth';
import { formatFcfa } from '@/lib/format';
import { updateVendorOrderStatus } from '@/lib/vendor-api';
import { VENDOR_HREF, hrefVendorOrder } from '@/lib/vendor-nav';

const STEPS = ['Reçue', 'Préparation', 'Prête', 'Livraison GoLivra'];

export default function VendorPreparationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, refreshOrders, setOrders } = useVendor();
  const [acting, setActing] = useState(false);
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const styles = useThemedStyles(createVendorPreparationStyles);
  const { palette, labels } = useVendorTheme();
  const o = orders.find((x) => x.id === (typeof id === 'string' ? id : ''));

  const activeIdx =
    o?.statut === 'livree' || o?.statut === 'en_livraison'
      ? 3
      : o?.statut === 'prete'
        ? 2
        : o?.statut === 'en_preparation' || o?.statut === 'a_preparer' || o?.statut === 'acceptee'
          ? 1
          : 0;

  const runStatus = async (statut: string, successMsg: string, goDeliveries?: boolean) => {
    if (!o) return;
    const previousStatut = o.statut;
    // Optimiste : le statut change immédiatement (badge, étapes), sans rechargement.
    setOrders((prev) =>
      prev.map((x) => (x.id === o.id ? { ...x, statut: statut as typeof x.statut } : x)),
    );
    setActing(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée');
      await updateVendorOrderStatus(token, o.id, statut, o.sous_commande_id);
      // Synchronisation en arrière-plan : commandes seules, sans écran de chargement.
      void refreshOrders();
      // On ne navigue qu'après le succès : en cas d'erreur, le rollback et le
      // toast restent visibles sur cet écran.
      if (goDeliveries) {
        router.replace(VENDOR_HREF.deliveriesTab);
        showSuccess('Commande prête !', successMsg, { primaryLabel: 'OK' });
      } else {
        router.back();
        showSuccess('C’est enregistré', successMsg, { primaryLabel: 'OK' });
      }
    } catch (e) {
      setOrders((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, statut: previousStatut } : x)),
      );
      showError('Mise à jour impossible', e instanceof Error ? e.message : 'Réessayez.');
    } finally {
      setActing(false);
    }
  };

  if (!o) {
    return (
      <ThemedView style={{ flex: 1 }}>
        <VendorScreenHeader title={labels.preparationHeader} />
        <ThemedText style={{ padding: 24 }}>Commande introuvable.</ThemedText>
      </ThemedView>
    );
  }

  const statusPill =
    o.statut === 'prete'
      ? { bg: colors.successSoft, txt: colors.success, label: 'Prête — livreur GoLivra' }
      : o.statut === 'en_preparation' || o.statut === 'a_preparer' || o.statut === 'acceptee'
        ? { bg: colors.warningSoft, txt: colors.warning, label: 'En préparation' }
        : o.statut === 'en_attente'
          ? { bg: colors.warningSoft, txt: colors.warning, label: 'En attente — à accepter' }
          : { bg: colors.surfaceMuted, txt: colors.textSecondary, label: 'À traiter' };

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <VendorScreenHeader title={labels.preparationHeader} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 20 }}>
        <ThemedText style={styles.ruleHint}>
          Préparez la commande, puis marquez-la prête : un livreur GoLivra est assigné automatiquement via
          l’application.
        </ThemedText>

        <View style={styles.stepRow}>
          {STEPS.map((label, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <View key={label} style={styles.stepCol}>
                <View
                  style={[
                    styles.dot,
                    done && { backgroundColor: palette.primary },
                    active && { borderWidth: 3, borderColor: colors.primaryBright, backgroundColor: palette.primary },
                  ]}
                />
                <ThemedText
                  style={[styles.stepTxt, (done || active) && { color: palette.primaryDeep }]}
                  numberOfLines={2}>
                  {label}
                </ThemedText>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <ThemedText type="defaultSemiBold">#{o.ref}</ThemedText>
            <View style={[styles.pill, { backgroundColor: statusPill.bg }]}>
              <ThemedText style={[styles.pillTxt, { color: statusPill.txt }]}>{statusPill.label}</ThemedText>
            </View>
          </View>
          <ThemedText type="defaultSemiBold" style={styles.total}>
            {formatFcfa(o.prixTotal)}
          </ThemedText>
        </View>

        <ThemedText style={[styles.h3, { color: palette.primaryDeep }]}>{labels.orderArticlesTitle}</ThemedText>
        {o.lignes.map((l) => (
          <View key={l.id} style={styles.article}>
            <View style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">{l.nom}</ThemedText>
              {l.detail ? <ThemedText style={styles.det}>{l.detail}</ThemedText> : null}
              <ThemedText style={styles.det}>
                {l.quantite} × {formatFcfa(l.prixUnitaire)}
              </ThemedText>
            </View>
          </View>
        ))}

        {acting ? (
          <Pressable
            style={[styles.primary, { backgroundColor: palette.primary }]}
            disabled>
            <ActivityIndicator color={colors.onPrimary} size="small" />
          </Pressable>
        ) : o.statut === 'en_attente' || o.statut === 'a_preparer' || o.statut === 'acceptee' ? (
          <Pressable
            style={[styles.primary, { backgroundColor: palette.primary }]}
            onPress={() => {
              const isFreshAccept = o.statut === 'en_attente' || o.statut === 'a_preparer';
              void runStatus(
                'en_preparation',
                isFreshAccept
                  ? 'Commande acceptée. Préparation démarrée.'
                  : 'Préparation démarrée.',
              );
            }}>
            <ThemedText style={styles.primaryTxt}>Accepter et commencer la préparation</ThemedText>
          </Pressable>
        ) : o.statut === 'en_preparation' ? (
          <Pressable
            style={[styles.primary, { backgroundColor: palette.primaryDeep, marginTop: 10 }]}
            onPress={() =>
              void runStatus(
                'prete',
                'Commande prête. Un livreur GoLivra va être notifié.',
                true,
              )
            }>
            <ThemedText style={styles.primaryTxt}>Commande prête — appeler un livreur GoLivra</ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.outline, { borderColor: palette.primary }]}
          onPress={() => router.push(hrefVendorOrder(o.id))}>
          <ThemedText style={[styles.outlineTxt, { color: palette.primary }]}>Voir détails commande</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}
