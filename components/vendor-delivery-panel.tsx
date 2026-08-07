import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { MapPin, Package, Phone, Plus, Truck } from 'lucide-react-native';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';



import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendor } from '@/contexts/vendor-context';
import { useVendorTheme } from '@/hooks/use-vendor-theme';

import { getSessionToken } from '@/lib/auth';

import { formatFcfa } from '@/lib/format';

import {

  fetchVendorExternalDeliveries,

  fetchVendorOrders,

  livraisonStatutLabel,

  type VendorExternalDelivery,

} from '@/lib/vendor-api';

import type { VendorPalette } from '@/lib/vendor-theme';

import type { VendorOrder } from '@/lib/vendor-types';

import { hrefVendorOrder } from '@/lib/vendor-nav';



function isCommandeDeliveryActive(o: VendorOrder): boolean {

  return o.statut === 'prete' || o.statut === 'en_livraison';

}



export function VendorDeliveryPanel({ embedded }: { embedded?: boolean }) {

  const router = useRouter();
  const isFocused = useIsFocused();
  const { orders, setOrders } = useVendor();
  const { palette, labels } = useVendorTheme();
  const colors = useAppColors();
  const [externalDeliveries, setExternalDeliveries] = useState<VendorExternalDelivery[]>([]);



  const commandeOrders = useMemo(() => {

    return orders.filter(

      (o) => o.statut !== 'annulee' && o.statut !== 'livree' && isCommandeDeliveryActive(o),

    );

  }, [orders]);



  // Rafraîchissement automatique toutes les 5 s (statuts livraison en temps réel).

  // Léger : ne refetch que les commandes + livraisons externes (pas le profil ni les produits).

  const refreshingRef = useRef(false);

  const refreshLight = useCallback(async () => {

    if (refreshingRef.current) return;

    refreshingRef.current = true;

    try {

      const token = await getSessionToken();

      if (token) {

        const [freshOrders, freshExternal] = await Promise.all([

          fetchVendorOrders(token),

          fetchVendorExternalDeliveries(token),

        ]);

        setOrders(freshOrders);

        setExternalDeliveries(freshExternal);

      } else {

        setExternalDeliveries([]);

      }

    } catch {

      // On garde les données actuelles en cas d'échec réseau.

    } finally {

      refreshingRef.current = false;

    }

  }, [setOrders]);

  // L'intervalle ne tourne que si l'écran est visible ET l'app au premier plan.

  const appActive = useRef(true);

  useEffect(() => {

    const sub = AppState.addEventListener('change', (state) => {

      const active = state === 'active';

      appActive.current = active;

      // Retour au premier plan : on rafraîchit immédiatement si l'écran est visible.

      if (active && isFocused) void refreshLight();

    });

    return () => sub.remove();

  }, [isFocused, refreshLight]);

  useEffect(() => {

    if (!isFocused) return;

    void refreshLight();

    const id = setInterval(() => {

      if (appActive.current) void refreshLight();

    }, 5000);

    return () => clearInterval(id);

  }, [isFocused, refreshLight]);



  const content = (

    <>

      <Pressable

        style={[styles.createBtn, { backgroundColor: palette.primary }]}

        onPress={() => router.push('/vendor/create-external-delivery')}>

        <Plus size={20} color={colors.textInverse} strokeWidth={LUCIDE_STROKE} />

        <ThemedText style={styles.createBtnTxt}>Créer une livraison externe</ThemedText>

      </Pressable>



      <View style={[styles.infoBanner, { backgroundColor: palette.primarySoft, borderColor: palette.onlinePillBorder }]}>
        <Truck size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
        <ThemedText style={[styles.infoTxt, { color: palette.primaryDeep }]}>
          Vos commandes sont livrées automatiquement. Créez vos propres livraisons en un clic.
        </ThemedText>
      </View>



      {externalDeliveries.length > 0 ? (

        <>

          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>Livraisons externes</ThemedText>

          {externalDeliveries.map((d) => (

            <ExternalDeliveryCard key={d.id} d={d} palette={palette} colors={colors} />

          ))}

        </>

      ) : null}



      {commandeOrders.length > 0 ? (

        <>

          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }, externalDeliveries.length ? { marginTop: 12 } : undefined]}>

            Livraisons internes (commandes)

          </ThemedText>

          {commandeOrders.map((o) => (

            <CommandeOrderCard key={o.id} o={o} palette={palette} labels={labels} router={router} colors={colors} />

          ))}

        </>

      ) : null}



      {commandeOrders.length === 0 && externalDeliveries.length === 0 ? (

        <View style={styles.empty}>

          <Package size={40} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />

          <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucune livraison en cours</ThemedText>

          <ThemedText style={[styles.emptyHint, { color: colors.textMuted }]}>

            Marquez une commande « prête » (livraison interne auto) ou créez une livraison externe.

          </ThemedText>

        </View>

      ) : null}



    </>

  );



  if (embedded) {

    return <View style={styles.embedded}>{content}</View>;

  }



  return (

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

      {content}

    </ScrollView>

  );

}



function ExternalDeliveryCard({ d, palette, colors }: { d: VendorExternalDelivery; palette: VendorPalette; colors: ReturnType<typeof useAppColors> }) {

  return (

    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>

      <View style={styles.cardTop}>

        <ThemedText type="defaultSemiBold" style={[styles.ref, { color: colors.text }]}>

          {d.client_nom}

        </ThemedText>

        <View style={[styles.modePill, { backgroundColor: colors.successSoft }]}>

          <ThemedText style={[styles.modeTxt, { color: colors.success }]}>Votre livreur</ThemedText>

        </View>

      </View>

      {d.client_telephone ? (

        <ThemedText style={[styles.phone, { color: colors.textMuted }]}>{d.client_telephone}</ThemedText>

      ) : null}

      <View style={styles.addrRow}>

        <MapPin size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />

        <ThemedText style={[styles.addr, { color: colors.textMuted }]}>{d.adresse}</ThemedText>

      </View>

      {d.note ? <ThemedText style={[styles.note, { color: colors.textSecondary }]}>Colis : {d.note}</ThemedText> : null}

      <ThemedText style={[styles.trackValue, { color: colors.text }]}>{livraisonStatutLabel(d.statut)}</ThemedText>

      {d.livreur ? (

        <View style={styles.livreurRow}>

          <ThemedText style={[styles.livreurLabel, { color: colors.textSecondary }]}>Livreur : {d.livreur.nom}</ThemedText>

          {d.livreur.tel ? (

            <Pressable hitSlop={8} onPress={() => void Linking.openURL(`tel:${d.livreur!.tel}`)}>

              <Phone size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />

            </Pressable>

          ) : null}

        </View>

      ) : null}

    </View>

  );

}



function CommandeOrderCard({
  o,
  palette,
  labels,
  router,
  colors,
}: {
  o: VendorOrder;
  palette: VendorPalette;
  labels: { orderArticlesTitle: string };
  router: ReturnType<typeof useRouter>;
  colors: ReturnType<typeof useAppColors>;
}) {

  const tracking = livraisonStatutLabel(o.livraison_statut);



  return (

    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>

      <View style={styles.cardTop}>

        <ThemedText type="defaultSemiBold" style={[styles.ref, { color: colors.text }]}>

          #{o.ref}

        </ThemedText>

        <View style={[styles.modePill, { backgroundColor: colors.primarySoft }]}>

          <ThemedText style={[styles.modeTxt, { color: colors.primary }]}>GoLivra</ThemedText>

        </View>

      </View>

      <ThemedText style={[styles.price, { color: colors.text }]}>{formatFcfa(o.prixTotal + o.fraisLivraison)}</ThemedText>

      <ThemedText type="defaultSemiBold" style={[styles.client, { color: colors.text }]}>

        {o.clientNom}

      </ThemedText>

      <View style={styles.addrRow}>

        <MapPin size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />

        <ThemedText style={[styles.addr, { color: colors.textMuted }]}>{o.adresse}</ThemedText>

      </View>

      <View style={[styles.trackBox, { backgroundColor: colors.surfaceMuted }]}>

        <ThemedText style={[styles.trackLabel, { color: colors.textMuted }]}>Statut livraison</ThemedText>

        <ThemedText style={[styles.trackValue, { color: colors.text }]}>{tracking}</ThemedText>

      </View>

      {o.livreur ? (

        <View style={styles.livreurRow}>

          <ThemedText style={[styles.livreurLabel, { color: colors.textSecondary }]}>Livreur GoLivra : {o.livreur.nom}</ThemedText>

          {o.livreur.tel ? (

            <Pressable hitSlop={8} onPress={() => void Linking.openURL(`tel:${o.livreur!.tel}`)}>

              <Phone size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />

            </Pressable>

          ) : null}

        </View>

      ) : o.statut === 'prete' ? (

        <ThemedText style={[styles.hint, { color: colors.textMuted }]}>Un livreur GoLivra sera contacté automatiquement.</ThemedText>

      ) : null}

      <Pressable style={styles.linkBtn} onPress={() => router.push(hrefVendorOrder(o.id))}>

        <ThemedText style={[styles.linkTxt, { color: palette.primary }]}>Voir la commande</ThemedText>

      </Pressable>

    </View>

  );

}



const styles = StyleSheet.create({

  embedded: { paddingHorizontal: 18 },

  scroll: { paddingHorizontal: 18, paddingBottom: 24 },

  createBtn: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    paddingVertical: 14,

    borderRadius: 12,

    marginBottom: 14,

  },

  createBtnTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  infoBanner: {

    flexDirection: 'row',

    gap: 12,

    padding: 14,

    borderRadius: 14,

    borderWidth: 1,

    marginBottom: 16,

  },

  infoTxt: { flex: 1, fontSize: 13, lineHeight: 19 },

  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },

  emptyTitle: { fontSize: 16, fontWeight: '800' },

  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  ref: { fontSize: 15 },

  modePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },

  modeTxt: { fontSize: 11, fontWeight: '800' },

  price: { fontSize: 18, fontWeight: '800', marginTop: 8 },

  client: { fontSize: 15, marginTop: 8 },

  phone: { fontSize: 13, marginTop: 4 },

  note: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  addrRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },

  addr: { flex: 1, fontSize: 13, lineHeight: 18 },

  trackBox: { marginTop: 12, padding: 10, borderRadius: 10 },

  trackLabel: { fontSize: 11, fontWeight: '600' },

  trackValue: { fontSize: 14, fontWeight: '700', marginTop: 6 },

  livreurRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },

  livreurLabel: { fontSize: 13, fontWeight: '600' },

  hint: { fontSize: 12, marginTop: 10, fontStyle: 'italic' },

  linkBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },

  linkTxt: { fontWeight: '800', fontSize: 14 },

});

