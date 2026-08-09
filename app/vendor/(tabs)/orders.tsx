import { useRouter } from 'expo-router';
import { Clock, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorTabHeader } from '@/components/vendor-tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { VENDOR_TAB_BAR_PADDING_BOTTOM } from '@/constants/vendor-layout';
import { useVendor } from '@/contexts/vendor-context';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { useRealtimeOrders } from '@/hooks/use-realtime-orders';
import { useVendorHoraires } from '@/hooks/use-vendor-horaires';
import { formatFcfa } from '@/lib/format';
import { getSessionToken } from '@/lib/auth';
import { livraisonStatutLabel } from '@/lib/vendor-api';
import type { VendorOrder, VendorOrderStatus } from '@/lib/vendor-types';
import { vendorOrderStatusLabel } from '@/lib/ux-copy';
import { hrefVendorOrder } from '@/lib/vendor-nav';
import { CardSkeleton } from '@/components/ui/skeleton';

type FilterKey = 'all' | 'prep' | 'ship';

function statusLabel(s: VendorOrderStatus): string {
  return vendorOrderStatusLabel(s);
}

function statusStyle(s: VendorOrderStatus, colors: ReturnType<typeof useAppColors>) {
  switch (s) {
    case 'en_attente':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'acceptee':
    case 'a_preparer':
      return { bg: colors.successSoft, text: colors.success };
    case 'en_preparation':
      return { bg: colors.warningSoft, text: colors.warning };
    case 'prete':
      return { bg: colors.successSoft, text: colors.primaryDeep };
    case 'en_livraison':
      return { bg: colors.primarySoft, text: colors.primary };
    case 'livree':
      return { bg: colors.successSoft, text: colors.primaryDeep };
    case 'annulee':
      return { bg: colors.errorSoft, text: colors.error };
    default:
      return { bg: colors.surfaceMuted, text: colors.textSecondary };
  }
}

function formatHeureLimite(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function matchesFilter(o: VendorOrder, f: FilterKey): boolean {
  if (f === 'all') return true;
  if (f === 'prep')
    return (
      o.statut === 'en_attente' ||
      o.statut === 'a_preparer' ||
      o.statut === 'en_preparation' ||
      o.statut === 'prete'
    );
  if (f === 'ship') return o.statut === 'en_livraison';
  return true;
}

export default function VendorOrdersTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { orders, refreshOrders, shop, loading } = useVendor();
  const { labels } = useVendorTheme();
  const horaires = useVendorHoraires(shop?.id);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [token, setToken] = useState<string | null>(null);
  const bottom = Math.max(insets.bottom, 10) + VENDOR_TAB_BAR_PADDING_BOTTOM;

  // Récupérer le token au montage
  useEffect(() => {
    getSessionToken().then(setToken);
  }, []);

  // --- REALTIME: Écoute les nouvelles commandes ---
  // Refresh silencieux (commandes seules, sans écran de chargement) :
  // chaque changement reçu ne doit pas faire clignoter la liste.
  useRealtimeOrders({
    enterpriseId: shop?.id || null,
    refreshOrders,
    token,
  });

  const counts = useMemo(() => {
    const all = orders.filter((o) => matchesFilter(o, 'all')).length;
    const prep = orders.filter((o) => matchesFilter(o, 'prep')).length;
    const ship = orders.filter((o) => matchesFilter(o, 'ship')).length;
    return { all, prep, ship };
  }, [orders]);

  const list = useMemo(() => orders.filter((o) => matchesFilter(o, filter)), [orders, filter]);

  const pills = labels.orderListFilters.map((p) => {
    const n = p.key === 'all' ? counts.all : p.key === 'prep' ? counts.prep : counts.ship;
    return { ...p, label: `${p.label} (${n})` };
  });

  return (
    <ThemedView style={styles.screen}>
      <VendorTabHeader title="COMMANDES" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}>
        {!horaires.loading && !horaires.hasHours ? (
          <Pressable
            style={[styles.hoursWarn, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}
            onPress={() => router.push({ pathname: '/vendor/horaires', params: shop?.id ? { id: shop.id } : {} })}>
            <Clock size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.hoursWarnTxt, { color: colors.error }]} numberOfLines={2}>
              Horaires non définis : vous ne recevez aucune commande. Définissez-les.
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.pillRow}>
          {pills.map((p) => {
            const on = filter === p.key;
            return (
              <Pressable
                key={p.key}
                style={[styles.pill, on ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]}
                onPress={() => setFilter(p.key)}>
                <ThemedText style={[styles.pillText, on ? { color: colors.onPrimary } : { color: colors.textSecondary }]}>{p.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
          </View>
        ) : list.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Aucune commande</ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>Les commandes de vos clients apparaîtront ici.</ThemedText>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {list.map((o) => {
              const st = statusStyle(o.statut, colors);
              return (
                <Pressable
                  key={o.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(hrefVendorOrder(o.id))}
                  android_ripple={{ color: colors.primarySoft }}>
                  <View style={styles.cardTop}>
                    <View style={[styles.refBadge, { backgroundColor: colors.surfaceMuted }]}>
                       <ThemedText style={[styles.ref, { color: colors.text }]}>#{o.ref}</ThemedText>
                    </View>
                    <ThemedText type="defaultSemiBold" style={[styles.price, { color: colors.primary }]}>
                      {formatFcfa(o.prixTotal)}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.cardBody}>
                    <ThemedText type="defaultSemiBold" style={[styles.client, { color: colors.text }]}>
                      {o.clientNom}
                    </ThemedText>
                    <View style={styles.infoRow}>
                      <MapPin size={12} color={colors.textMuted} />
                      <ThemedText style={[styles.infoText, { color: colors.textMuted }]} numberOfLines={1}>
                        {o.adresse}
                      </ThemedText>
                    </View>
                  </View>

                  {o.statut === 'en_attente' && o.acceptation_limite_at ? (
                    <View style={[styles.deliveryBadge, { backgroundColor: colors.warningSoft }]}>
                      <ThemedText style={[styles.deliveryHint, { color: colors.warning }]} numberOfLines={2}>
                        À accepter avant {formatHeureLimite(o.acceptation_limite_at)} — sinon la commande
                        expire automatiquement.
                      </ThemedText>
                    </View>
                  ) : null}

                  {o.statut === 'a_preparer' && o.paiement_statut !== 'valide' ? (
                    <View style={[styles.deliveryBadge, { backgroundColor: colors.warningSoft }]}>
                      <ThemedText style={[styles.deliveryHint, { color: colors.warning }]} numberOfLines={2}>
                        ⏳ En attente de paiement du client — la préparation démarrera après confirmation.
                      </ThemedText>
                    </View>
                  ) : null}

                  {(o.statut === 'prete' || o.statut === 'en_livraison') && o.livraison_statut ? (
                    <View style={[styles.deliveryBadge, { backgroundColor: colors.primarySoft }]}>
                      <ThemedText style={[styles.deliveryHint, { color: colors.primary }]} numberOfLines={1}>
                        Livraison · {livraisonStatutLabel(o.livraison_statut)}
                      </ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.cardBottom}>
                    <View style={styles.timeRow}>
                      <Clock size={12} color={colors.textMuted} />
                      <ThemedText style={[styles.time, { color: colors.textMuted }]}>{o.creeLeLabel}</ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: st.text }]}>
                        {statusLabel(o.statut)}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 6 },
  hoursWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  hoursWarnTxt: { flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '800' },
  emptyBox: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: { fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  ref: { fontSize: 12, fontWeight: '800' },
  price: { fontSize: 16, fontWeight: '900' },
  cardBody: { marginBottom: 12 },
  client: { fontSize: 16, marginBottom: 6, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13 },
  deliveryBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  deliveryHint: { fontSize: 11, fontWeight: '800' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.05)' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 12, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
});

