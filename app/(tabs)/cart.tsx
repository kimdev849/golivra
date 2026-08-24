import { useFocusEffect } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Check, ChevronRight, Clock, Home, Info, Minus, PackageOpen, Plus, Sparkles, Trash2, Truck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';


import { DeliveryAddressForm } from '@/components/delivery-address-form';
import { ProductPrice } from '@/components/product-price';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ZoomableImage } from '@/components/zoomable-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCart } from '@/contexts/cart-context';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
import { useIsWebDesktop } from '@/hooks/use-is-web-desktop';
import { DESKTOP_MAX_WIDTH, DESKTOP_PADDING } from '@/components/desktop-layout';
import type { EnterprisePublic, ProductPublic } from '@/lib/catalog';
import { fetchEnterpriseById, fetchProductsForEnterprise } from '@/lib/catalog';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import {
  cartTotal,
  removeProductLineSync,
  saveCart,
  segmentSubtotal,
  syncCartWithServer,
  updateLineQuantitySync,
  type CartSegment,
  type CartState,
} from '@/lib/cart-local';
import { fetchUserAddresses, type UserAddress } from '@/lib/addresses';
import { addressLabel, deliveryAddressError, formatDeliveryAddressText, snapshotFromFields, type DeliveryAddressFields } from '@/lib/format-address';
import { formatFcfa, formatHumanMinutes } from '@/lib/format';
import { resolveRemoteImageUrl } from '@/lib/images';
import {
  DEFAULT_PUBLIC_PRICING,
  deliveryFeeForQuartier,
  deliveryMinutesForQuartier,
  displayDeliveryFeeFcfa,
  enterprisePrepMinutes,
  etaEstimateForEnterprise,
  fetchPublicPricing,
  type PublicPricing,
} from '@/lib/pricing';
import { validatePromoCode, type PromoValidation } from '@/lib/promo-api';
import { captureCurrentPosition } from '@/lib/location';
import { effectiveStockCap, UNLIMITED_STOCK_CAP } from '@/lib/product-stock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { useCurrentTime } from '@/hooks/use-current-time';
import { useFeatureEnabled } from '@/hooks/use-feature-enabled';
import { computeLiveStatus } from '@/lib/horaires-status';

/** Valeur d'adresse vierge (aucune adresse sélectionnée). */
const emptyAddressForm = (): DeliveryAddressFields => ({
  libelle: '',
  quartier: '',
  ligne1: '',
  instructions: '',
  point_reperes: '',
  ville: 'Brazzaville',
  pays: 'Congo',
});

/** Convertit une adresse enregistrée en champs d'adresse. */
const addressFromSaved = (a: UserAddress): DeliveryAddressFields => ({
  libelle: a.libelle ?? '',
  quartier: a.quartier || '',
  ligne1: a.ligne1 || '',
  instructions: a.instructions ?? '',
  point_reperes: a.point_reperes ?? '',
  ville: a.ville || 'Brazzaville',
  pays: a.pays || 'Congo',
});

function segmentLabel(seg: CartSegment, ent: EnterprisePublic | null | undefined): string {
  const t = ent?.type ?? seg.enterpriseType;
  if (t === 'boutique') return 'Boutique';
  if (t === 'restaurant') return 'Restaurant';
  return 'Commerce';
}

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, showConfirm, FeedbackOverlay } = useActionFeedback();
  const { cart, hydrated, hydrate, syncFromMemory } = useCart();
  const [address, setAddress] = useState<DeliveryAddressFields>(emptyAddressForm);
  const [savedAddressId, setSavedAddressId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  const [productById, setProductById] = useState<Record<string, ProductPublic>>({});
  const [enterpriseById, setEnterpriseById] = useState<Record<string, EnterprisePublic | null>>({});
  const [submitting, setSubmitting] = useState(false);
  // Paiement Mobile Money par défaut (choisi au moment du paiement, après
  // acceptation du commerce — le parcours ne débite rien à la commande).
  const methodePaiement = 'airtel_money' as const;
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  const orderInFlight = useRef(false);
  // ⚡ Horloge locale rafraîchie toutes les 30 s : recalcul du statut
  // ouvert/fermé de chaque commerce du panier (mêmes règles que le serveur).
  const now = useCurrentTime(30_000);
  // ── Contrôle à distance : si l'admin coupe les commandes, on bloque ici aussi
  const ordersEnabled = useFeatureEnabled('orders');

  /** Référence de l'adresse courante, lisible depuis les callbacks stables. */
  const addressRef = useRef(address);
  addressRef.current = address;

  /** Adresse enregistrée actuellement sélectionnée (si la saisie n'a pas été modifiée). */
  const selectedAddress = savedAddresses.find((a) => a.id === savedAddressId) ?? null;

  const syncStockFromCart = useCallback(async (c: CartState) => {
    try {
      const results = await Promise.all(
        c.segments.map(async (seg) => {
          const [products, ent] = await Promise.all([
            fetchProductsForEnterprise(seg.enterpriseId),
            fetchEnterpriseById(seg.enterpriseId).catch(() => null),
          ]);
          return { segId: seg.enterpriseId, products, ent };
        })
      );
      const stock: Record<string, number> = {};
      const pmap: Record<string, ProductPublic> = {};
      const emap: Record<string, EnterprisePublic | null> = {};
      for (const r of results) {
        emap[r.segId] = r.ent;
        for (const p of r.products) {
          pmap[p.id] = p;
          stock[p.id] = effectiveStockCap(p);
        }
      }
      setStockByProduct(stock);
      setProductById(pmap);
      setEnterpriseById(emap);
    } catch {
      setStockByProduct({});
      setProductById({});
      setEnterpriseById({});
    }
  }, []);

  const loadSavedAddresses = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) return;
      const rows = await fetchUserAddresses(token);
      setSavedAddresses(rows);
      const principal = rows.find((a) => a.est_principale) ?? rows[0];
      if (!principal) return;
      // Une adresse enregistrée déjà sélectionnée reste sélectionnée.
      const current = addressRef.current;
      const isEmpty = !current.quartier.trim() && !current.ligne1.trim();
      // Si l'utilisateur vient d'enregistrer son adresse dans « Mes adresses »,
      // la saisie courante correspond à une adresse enregistrée : on la
      // sélectionne automatiquement (l'adresse de livraison s'affiche).
      // Sinon (panier vierge), on pré-remplit avec l'adresse principale.
      const match = !isEmpty
        ? (rows.find(
            (r) =>
              String(r.quartier || '').trim() === current.quartier.trim() &&
              String(r.ligne1 || '').trim() === current.ligne1.trim(),
          ) ?? null)
        : null;
      const target = match ?? (isEmpty ? principal : null);
      setSavedAddressId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return target?.id ?? null;
      });
      if (target) {
        if (match) {
          // La saisie correspond déjà (quartier + adresse) : on récupère les
          // champs optionnels de l'adresse enregistrée SANS écraser ce que
          // l'utilisateur a déjà tapé (repère / instructions…).
          const saved = addressFromSaved(target);
          setAddress((prev) => ({
            ...prev,
            point_reperes: prev.point_reperes?.trim()
              ? prev.point_reperes
              : (saved.point_reperes ?? ''),
            instructions: prev.instructions?.trim()
              ? prev.instructions
              : (saved.instructions ?? ''),
            ville: prev.ville || saved.ville,
            pays: prev.pays || saved.pays,
          }));
        } else {
          setAddress(addressFromSaved(target));
        }
      }
    } catch {
      /* pas d'adresse enregistrée */
    }
  }, []);

  /** Sélection d'une adresse enregistrée → pré-remplit le formulaire. */
  const selectSavedAddress = useCallback((a: UserAddress) => {
    setSavedAddressId(a.id);
    setAddress(addressFromSaved(a));
  }, []);

  /** Édition manuelle des champs : tant que le cœur (arrondissement + adresse)
      reste identique à l'adresse sélectionnée, le lien est conservé ;
      dès qu'il change, on désélectionne pour que la commande reflète la saisie. */
  const handleAddressChange = useCallback(
    (next: DeliveryAddressFields) => {
      setAddress(next);
      if (!savedAddressId) return;
      const selected = savedAddresses.find((a) => a.id === savedAddressId);
      if (
        selected &&
        (next.quartier.trim() !== (selected.quartier || '').trim() ||
          next.ligne1.trim() !== (selected.ligne1 || '').trim())
      ) {
        setSavedAddressId(null);
      }
    },
    [savedAddressId, savedAddresses],
  );

  const refreshMeta = useCallback(async (c: CartState | null) => {
    // Ne pas re-fetch le pricing à chaque focus — TTL 60s
    if (!pricing) {
      void fetchPublicPricing().then(setPricing).catch(() => undefined);
    }
    if (c && c.segments.length > 0) {
      void syncStockFromCart(c);
      void loadSavedAddresses();
    } else {
      setStockByProduct({});
      setProductById({});
      setEnterpriseById({});
    }
  }, [syncStockFromCart, loadSavedAddresses, pricing]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
      void syncCartWithServer().then(() => syncFromMemory());
      void refreshMeta(useCart.getState().cart);
    }, [hydrate, syncFromMemory, refreshMeta])
  );

  const segmentCount = cart?.segments.length ?? 0;
  const subtotal = useMemo(() => (cart ? cartTotal(cart) : 0), [cart]);
  const deliveryFeeForSegment = useCallback(
    (enterpriseId: string) => {
      const p = pricing ?? DEFAULT_PUBLIC_PRICING;
      if (p.zones?.zones?.length && address.quartier.trim()) {
        return deliveryFeeForQuartier(address.quartier, p);
      }
      const ent = enterpriseById[enterpriseId];
      return displayDeliveryFeeFcfa(ent?.frais_livraison, p);
    },
    [enterpriseById, pricing, address.quartier],
  );

  const zoneDeliveryHint = useMemo(() => {
    const p = pricing ?? DEFAULT_PUBLIC_PRICING;
    if (!address.quartier.trim() || !p.zones?.zones?.length) return null;
    const fee = deliveryFeeForQuartier(address.quartier, p);
    // ⚡ Temps de livraison dynamique (GoLivra) selon le quartier choisi.
    const minutes = deliveryMinutesForQuartier(address.quartier, p);
    return `Livraison : ${formatFcfa(fee)}${minutes != null ? ` (environ ${minutes} min)` : ''}`;
  }, [address.quartier, pricing]);

  const deliveryFeeTotal = useMemo(() => {
    if (!cart || segmentCount === 0) return 0;
    return cart.segments.reduce((acc, seg) => acc + deliveryFeeForSegment(seg.enterpriseId), 0);
  }, [cart, segmentCount, deliveryFeeForSegment]);
  const promoRemise = appliedPromo?.remise ?? 0;
  const grandTotal = Math.max(0, subtotal + deliveryFeeTotal - promoRemise);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code || !cart) return;
    const token = await getSessionToken();
    if (!token) {
      showError('Connexion requise', 'Reconnectez-vous pour utiliser un code promo.');
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const result = await validatePromoCode(token, code, {
        orderSubtotal: subtotal,
        deliveryTotal: deliveryFeeTotal,
        segments: cart.segments.map((seg) => ({
          entrepriseId: seg.enterpriseId,
          establishmentType:
            (seg.enterpriseType ?? enterpriseById[seg.enterpriseId]?.type ?? 'restaurant') as
              | 'restaurant'
              | 'boutique',
        })),
      });
      setAppliedPromo(result);
      setPromoInput(result.code);
    } catch (e) {
      setAppliedPromo(null);
      setPromoError(e instanceof Error ? e.message : 'Code promo invalide.');
    } finally {
      setPromoLoading(false);
    }
  };

  const clearPromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const stockCap = useCallback(
    (productId: string, lineStock?: number) => {
      const live = stockByProduct[productId];
      if (live !== undefined) return live;
      return lineStock ?? UNLIMITED_STOCK_CAP;
    },
    [stockByProduct]
  );

  const changeQty = (enterpriseId: string, productId: string, q: number, lineStock?: number) => {
    if (!cart) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cap = stockCap(productId, lineStock);
    const next = updateLineQuantitySync(cart, enterpriseId, productId, q, cap);
    void saveCart(next);
  };

  const removeLine = (enterpriseId: string, productId: string) => {
    if (!cart) return;
    const next = removeProductLineSync(cart, enterpriseId, productId);
    void saveCart(next);
  };

  const clearCartAction = () => {
    if (!cart || cart.segments.length === 0) return;
    const total = cart.segments.reduce(
      (n, s) => n + s.lines.reduce((m, l) => m + l.quantite, 0),
      0,
    );
    showConfirm({
      title: 'Vider le panier',
      message: `${total} article${total > 1 ? 's' : ''} dans ${cart.segments.length} commerce${cart.segments.length > 1 ? 's' : ''}. Tout sera supprimé.`,
      primaryLabel: 'Vider',
      secondaryLabel: 'Annuler',
      onPrimary: () => {
        void saveCart(null);
        clearPromo();
        setStockByProduct({});
        setProductById({});
        setEnterpriseById({});
        setAddress(emptyAddressForm());
        setSavedAddressId(null);
        showSuccess('Panier vidé', 'Tous les articles ont été retirés.');
      },
    });
  };

  const [confirmOpen, setConfirmOpen] = useState(false);

  const submitOrder = async () => {
    if (!cart || cart.segments.length === 0) return;
    if (orderInFlight.current || submitting) return;
    const addrErr = deliveryAddressError(address);
    if (addrErr) {
      showError('Adresse invalide', addrErr);
      return;
    }
    // Afficher un récapitulatif de confirmation avant envoi (C2).
    setConfirmOpen(true);
  };

  const confirmAndSendOrder = async () => {
    if (!cart || cart.segments.length === 0) return;
    setConfirmOpen(false);
    if (orderInFlight.current || submitting) return;
    // Capture GPS en arrière-plan en même temps que la validation
    // (jamais bloquante — 5 s max, si échoue on passe sans).
    const gpsPromise = savedAddressId ? Promise.resolve(null) : captureCurrentPosition();
    const adressePayload = snapshotFromFields(address);
    const adresseText = formatDeliveryAddressText(address);
    const token = await getSessionToken();
    if (!token) {
      showError('Connexion requise', 'Reconnectez-vous pour passer commande.');
      return;
    }
    orderInFlight.current = true;
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }>('/api/orders', {
        method: 'POST',
        token,
        // Timeout long : une commande peut légitimement prendre 45 s quand le
        // serveur se réveille (cold start Render) — on ne veut pas la couper.
        timeoutMs: 45_000,
        jsonBody: {
          adresseLivraison: adresseText,
          adresse: {
            ...adressePayload,
            // On attend le GPS (5 s max) puis on l'ajoute au payload.
            // Le backend le stocke dans le snapshot pour calculer la distance livreur→client.
            ...(await Promise.race([
              gpsPromise,
              new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
            ])) || {},
          },
          ...(savedAddressId ? { adresseLivraisonId: savedAddressId } : {}),
          methodePaiement,
          ...(appliedPromo?.code ? { codePromo: appliedPromo.code } : {}),
          // Envoyer le total côté client pour éviter les divergences de calcul
          // entre panier, confirmation et suivi (C1).
          clientTotal: grandTotal,
          clientSubtotal: subtotal,
          clientDeliveryFee: deliveryFeeTotal,
          segments: cart.segments.map((seg) => ({
            entrepriseId: seg.enterpriseId,
            establishmentType:
              seg.enterpriseType ?? enterpriseById[seg.enterpriseId]?.type ?? 'restaurant',
            articles: seg.lines.map((l) => ({
              itemId: l.productId,
              quantite: l.quantite,
            })),
          })),
        },
      });
      // Nouveau parcours : AUCUN paiement à la commande — le client paiera après
      // acceptation du commerce (5 min pour accepter, 5 min ensuite pour payer).
      await saveCart(null);
      clearPromo();
      setAddress(emptyAddressForm());
      setSavedAddressId(null);
      await refreshMeta(null);
      const trackingHref = `/order-tracking/${created.id}` as Href;
      // Invalider le cache des commandes pour rafraîchir immédiatement (I1).
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['active-orders'] });
      showSuccess(
        'Commande envoyée !',
        segmentCount > 1
          ? `En attente de confirmation des ${segmentCount} commerces (5 min). Vous paierez après acceptation.`
          : 'En attente de confirmation du commerce (5 min). Vous paierez après acceptation.',
        {
          primaryLabel: 'Suivre ma commande',
          onPrimary: () => router.push(trackingHref),
        },
      );
    } catch (e) {
      showError('Commande impossible', e instanceof Error ? e.message : 'Échec de la commande.');
    } finally {
      orderInFlight.current = false;
      setSubmitting(false);
    }
  };

  const isDesktop = useIsWebDesktop();
  const bottomPad = isDesktop ? 24 : Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  const hasItems = cart && cart.segments.some((s) => s.lines.length > 0);
  const addressOk = !deliveryAddressError(address);

  // ⚡ Un commerce fermé (ou « trop tard pour commander ») dans le panier →
  // le bouton « Passer la commande » est désactivé et le segment concerné
  // affiche la raison (bannière à la place de l'estimation de livraison).
  const anySegmentBlocked = useMemo(() => {
    if (!cart) return false;
    return cart.segments.some((seg) => {
      const ent = enterpriseById[seg.enterpriseId];
      const status = computeLiveStatus(ent?.horaires ?? [], {
        prepMinutes: enterprisePrepMinutes(ent),
        kind:
          (ent?.type ?? seg.enterpriseType ?? 'restaurant') === 'boutique'
            ? 'boutique'
            : 'restaurant',
        fermeManuellement: ent?.ouvert === false,
        sansHoraires: ent?.accepte_commandes === false,
      }, now);
      return status.commandesBloquees;
    });
  }, [cart, enterpriseById, now]);

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, {
            paddingTop: Math.max(insets.top, 14),
            paddingBottom: bottomPad,
            paddingHorizontal: isDesktop ? DESKTOP_PADDING : 16,
            maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          }]}>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
              Votre panier
            </ThemedText>
            {hasItems ? (
              <Pressable
                style={({ pressed }) => [
                  styles.clearBtn,
                  { borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface },
                ]}
                onPress={clearCartAction}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Vider le panier">
                <Trash2 size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.clearBtnText, { color: colors.error }]}>Vider</ThemedText>
              </Pressable>
            ) : null}
          </View>

          {!hydrated && !hasItems ? (
            <View style={styles.bootRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : !hasItems ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Illustration : boîte ouverte + halos décoratifs */}
              <View style={styles.emptyArt}>
                <View style={[styles.emptyHalo, { backgroundColor: colors.primarySoft }]} />
                <View style={[styles.emptyIconRing, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                  <PackageOpen size={40} color={colors.primary} strokeWidth={1.6} />
                </View>
                <View style={[styles.emptySpark, styles.emptySparkA, { backgroundColor: colors.primary }]}>
                  <Sparkles size={11} color={colors.onPrimary} strokeWidth={2.2} />
                </View>
                <View style={[styles.emptyDot, styles.emptyDotB, { backgroundColor: colors.primary }]} />
                <View style={[styles.emptyDot, styles.emptyDotC, { backgroundColor: colors.primarySoft }]} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.primaryDeep }]}>Votre panier est vide</ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>
                Découvrez les restaurants et boutiques pour commencer vos achats.
              </ThemedText>
              <PressableScale
                style={[styles.cta, { backgroundColor: colors.primary }]}
                scaleTo={0.97}
                onPress={() => router.navigate('/(tabs)')}>
                <ThemedText style={[styles.ctaText, { color: colors.onPrimary }]}>Voir les commerces</ThemedText>
              </PressableScale>
            </View>
          ) : (
            <>
              {cart && cart.segments.length > 1 ? (
                <Pressable
                  style={[styles.multiBanner, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}
                  onPress={() => router.push('/how-multi-delivery' as Href)}
                  android_ripple={{ color: colors.primarySoft }}>
                  <Truck size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={[styles.multiBannerTitle, { color: colors.primaryDeep }]}>
                      {cart.segments.length} livraisons séparées
                    </ThemedText>
                    <ThemedText style={[styles.multiBannerBody, { color: colors.textMuted }]}>
                      Chaque commerce est préparé et livré indépendamment. Frais de livraison par commande.
                    </ThemedText>
                  </View>
                  <Info size={20} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              ) : null}

              {cart?.segments.map((seg) => {
                const ent = enterpriseById[seg.enterpriseId];
                const label = segmentLabel(seg, ent ?? undefined);
                const merchantName = seg.enterpriseNom ?? ent?.nom ?? 'Commerce';
                // ⏱ Estimation du temps par commerce : préparation (commerce) + livraison (zone GoLivra).
                const eta = etaEstimateForEnterprise(
                  ent ?? { type: seg.enterpriseType ?? 'restaurant' },
                  address.quartier,
                  pricing ?? DEFAULT_PUBLIC_PRICING,
                );
                // ⚡ Statut ouvert/fermé recalculé EN DIRECT à l'heure locale :
                // si le commerce est fermé (ou qu'il est trop tard), on affiche
                // clairement l'avertissement au lieu d'une estimation de
                // livraison contradictoire (« prévue dans 1h15 » alors que la
                // commande ne peut pas être passée).
                const liveStatus = computeLiveStatus(ent?.horaires ?? [], {
                  prepMinutes: eta.prepMinutes,
                  kind: (ent?.type ?? seg.enterpriseType ?? 'restaurant') === 'boutique'
                    ? 'boutique'
                    : 'restaurant',
                  fermeManuellement: ent?.ouvert === false,
                  sansHoraires: ent?.accepte_commandes === false,
                }, now);

                return (
                  <View key={seg.enterpriseId} style={styles.segmentBlock}>
                    <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
                      {label} · {merchantName}
                    </ThemedText>
                    {liveStatus.commandesBloquees ? (
                      <View
                        style={[
                          styles.segClosedBanner,
                          {
                            backgroundColor:
                              liveStatus.tone === 'warning' ? colors.warningSoft : colors.errorSoft,
                            borderColor: liveStatus.tone === 'warning' ? colors.warning : colors.error,
                          },
                        ]}>
                        <Clock
                          size={15}
                          color={liveStatus.tone === 'warning' ? colors.warning : colors.error}
                          strokeWidth={LUCIDE_STROKE}
                        />
                        <ThemedText
                          style={[
                            styles.segClosedTxt,
                            {
                              color: liveStatus.tone === 'warning' ? colors.warning : colors.error,
                            },
                          ]}>
                          {liveStatus.messageCommande ?? liveStatus.messageFermeture}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={[styles.segEta, { color: colors.textSecondary }]}>
                        {eta.deliveryMinutes != null
                          ? `Estimation livraison : environ ${formatHumanMinutes(eta.totalMinutes)}`
                          : `Estimation : préparation en environ ${eta.prepMinutes} min`}
                      </ThemedText>
                    )}

                    {seg.lines.map((line) => {
                      const cap = stockCap(line.productId, line.stockSnapshot);
                      const prod = productById[line.productId];
                      const imgUrl = resolveRemoteImageUrl(prod?.image_url, {
                        width: 120,
                        format: 'webp',
                        quality: 75,
                      });
                      const subtitleParts = [line.nom, prod?.description?.trim()].filter(Boolean);
                      const subtitle = subtitleParts.join(' · ') || line.nom;
                      const lineTotal = line.prixUnitaire * line.quantite;

                      return (
                        <View key={`${seg.enterpriseId}-${line.productId}`} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.itemTop}>
                            {imgUrl ? (
                              <ZoomableImage source={{ uri: imgUrl }} style={styles.thumb} contentFit="cover" />
                            ) : (
                              <View style={[styles.thumb, styles.thumbPh, { backgroundColor: colors.primarySoft, borderColor: colors.border }]} />
                            )}
                            <View style={styles.itemTextCol}>
                              <ThemedText type="defaultSemiBold" style={[styles.itemMerchant, { color: colors.text }]} numberOfLines={2}>
                                {merchantName}
                              </ThemedText>
                              <ThemedText style={[styles.itemDesc, { color: colors.textMuted }]} numberOfLines={2}>
                                {subtitle}
                              </ThemedText>
                            </View>
                          </View>
                          <View style={styles.itemBottom}>
                            <View style={styles.qtyRow}>
                              <Pressable
                                style={[styles.qtyCircle, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                                onPress={() =>
                                  line.quantite <= 1
                                    ? removeLine(seg.enterpriseId, line.productId)
                                    : changeQty(seg.enterpriseId, line.productId, line.quantite - 1, line.stockSnapshot)
                                }>
                                <Minus size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                              </Pressable>
                              <ThemedText style={[styles.qtyVal, { color: colors.text }]}>{line.quantite}</ThemedText>
                              <Pressable
                                style={[styles.qtyCircle, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                                onPress={() =>
                                  changeQty(seg.enterpriseId, line.productId, line.quantite + 1, line.stockSnapshot)
                                }
                                disabled={line.quantite >= cap}>
                                <Plus size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                              </Pressable>
                            </View>
                            <View style={styles.linePriceCol}>
                              {prod ? (
                                <ProductPrice product={prod} size="sm" showDuration={false} />
                              ) : null}
                              <ThemedText type="defaultSemiBold" style={[styles.linePriceRight, { color: colors.text }]}>
                                {formatFcfa(lineTotal)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              <View style={[styles.checkoutSection, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <View style={styles.checkoutSectionHead}>
                  <ThemedText type="defaultSemiBold" style={[styles.checkoutSectionTitle, { color: colors.primaryDeep }]}>
                    Adresse de livraison
                  </ThemedText>
                  <Pressable
                    style={styles.manageLink}
                    onPress={() => router.push('/my-addresses' as Href)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Gérer mes adresses">
                    <ThemedText style={[styles.manageLinkText, { color: colors.primary }]}>Gérer</ThemedText>
                    <ChevronRight size={15} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </Pressable>
                </View>

                {savedAddresses.length > 0 ? (
                  <View style={styles.addrList}>
                    {savedAddresses.map((a) => {
                      const on = savedAddressId === a.id;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => selectSavedAddress(a)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`Adresse ${addressLabel(a.libelle)}`}
                          style={[
                            styles.addrCard,
                            {
                              borderColor: on ? colors.primary : colors.border,
                              backgroundColor: on ? colors.primarySoft : colors.surface,
                            },
                          ]}>
                          <Home size={18} color={on ? colors.primary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                          <View style={styles.addrCardBody}>
                            <View style={styles.addrCardTitleRow}>
                              <ThemedText type="defaultSemiBold" style={[styles.addrCardTitle, { color: colors.text }]} numberOfLines={1}>
                                {addressLabel(a.libelle)}
                              </ThemedText>
                              {a.est_principale ? (
                                <ThemedText style={[styles.addrPrincipal, { color: colors.primary }]}>Principale</ThemedText>
                              ) : null}
                            </View>
                            <ThemedText style={[styles.addrCardText, { color: colors.textSecondary }]} numberOfLines={2}>
                              {formatDeliveryAddressText({
                                quartier: a.quartier || '',
                                ligne1: a.ligne1,
                                point_reperes: a.point_reperes,
                                instructions: a.instructions,
                                ville: a.ville,
                                pays: a.pays,
                              })}
                            </ThemedText>
                          </View>
                          <View
                            style={[
                              styles.addrCheck,
                              on ? { borderColor: colors.primary, backgroundColor: colors.primary } : null,
                            ]}>
                            {on ? <Check size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <ThemedText style={[styles.noAddrHint, { color: colors.textMuted }]}>
                    Aucune adresse enregistrée — vous pouvez saisir votre adresse ci-dessous, ou l&apos;ajouter dans « Mes adresses » pour la réutiliser.
                  </ThemedText>
                )}

                {selectedAddress ? (
                  <View style={[styles.livrerRow, { backgroundColor: colors.accentSoft }]}>
                    <Home size={15} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                    <ThemedText style={[styles.livrerText, { color: colors.primaryDeep }]} numberOfLines={1}>
                      Livrer à : {addressLabel(address.libelle)}
                    </ThemedText>
                  </View>
                ) : null}
                <DeliveryAddressForm value={address} onChange={handleAddressChange} compact hideLibelle />
                {!addressOk ? (
                  <ThemedText style={[styles.checkoutWarn, { color: colors.warning }]}>Quartier + description requis pour commander.</ThemedText>
                ) : zoneDeliveryHint ? (
                  <ThemedText style={[styles.checkoutWarn, { color: colors.primary }]}>{zoneDeliveryHint}</ThemedText>
                ) : null}
              </View>

              <View style={[styles.checkoutSection, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold" style={[styles.checkoutSectionTitle, { color: colors.primaryDeep }]}>
                  Paiement après acceptation
                </ThemedText>
                <ThemedText style={[styles.payHint, { color: colors.textMuted }]}>
                  Aucun débit maintenant : le commerce a 5 min pour accepter votre commande, puis vous
                  payez par Airtel Money ou MTN Mobile Money.
                </ThemedText>
              </View>

              <View style={styles.summary}>
                {cart?.segments.map((seg) => (
                  <View key={`sum-${seg.enterpriseId}`} style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      Total articles · {seg.enterpriseNom}
                    </ThemedText>
                    <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.text }]}>
                      {formatFcfa(segmentSubtotal(seg))}
                    </ThemedText>
                  </View>
                ))}
                <View style={styles.summaryRow}>
                  <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    Frais de livraison
                    {segmentCount > 1 ? ` (${segmentCount} commandes)` : ''}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.text }]}>
                    {formatFcfa(deliveryFeeTotal)}
                  </ThemedText>
                </View>
                <View style={[styles.promoBox, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                  <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Code promo</ThemedText>
                  <View style={styles.promoInputRow}>
                    <TextInput
                      style={[styles.promoInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                      placeholder="Ex. GOLIVRA10"
                      placeholderTextColor={colors.textMuted}
                      value={promoInput}
                      onChangeText={(t) => {
                        setPromoInput(t);
                        if (appliedPromo) setAppliedPromo(null);
                        setPromoError(null);
                      }}
                      autoCapitalize="characters"
                      editable={!promoLoading && !submitting}
                    />
                    {appliedPromo ? (
                      <Pressable style={[styles.promoBtn, { borderColor: colors.border }]} onPress={clearPromo}>
                        <ThemedText style={[styles.promoBtnText, { color: colors.textSecondary }]}>Retirer</ThemedText>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.promoBtn, { backgroundColor: colors.primary }, promoLoading && styles.submitBtnDisabled]}
                        disabled={promoLoading || !promoInput.trim()}
                        onPress={() => void applyPromo()}>
                        {promoLoading ? (
                          <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                          <ThemedText style={[styles.promoBtnText, { color: colors.onPrimary }]}>Appliquer</ThemedText>
                        )}
                      </Pressable>
                    )}
                  </View>
                  {promoError ? (
                    <ThemedText style={[styles.promoErr, { color: colors.error }]}>{promoError}</ThemedText>
                  ) : null}
                  {appliedPromo ? (
                    <ThemedText style={[styles.promoOk, { color: colors.success }]}>
                      {appliedPromo.description || appliedPromo.code} — −{formatFcfa(appliedPromo.remise)}
                    </ThemedText>
                  ) : (
                    <ThemedText style={[styles.promoHint, { color: colors.textMuted }]}>
                      Essayez GOLIVRA10 ou LIVRAISON500
                    </ThemedText>
                  )}
                </View>
                {promoRemise > 0 ? (
                  <View style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: colors.success }]}>Réduction promo</ThemedText>
                    <ThemedText type="defaultSemiBold" style={[styles.summaryValue, { color: colors.success }]}>
                      −{formatFcfa(promoRemise)}
                    </ThemedText>
                  </View>
                ) : null}
                <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold" style={[styles.totalLabel, { color: colors.text }]}>
                    Total
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={[styles.totalAmount, { color: colors.text }]}>
                    {formatFcfa(grandTotal)}
                  </ThemedText>
                </View>
              </View>

              {!ordersEnabled ? (
                <View style={[styles.ordersOffBanner, { backgroundColor: colors.error + '18', borderColor: colors.error }]}>
                  <ThemedText style={[styles.ordersOffText, { color: colors.error }]}>
                    Les commandes sont temporairement désactivées par l&apos;administrateur. Réessayez plus tard.
                  </ThemedText>
                </View>
              ) : (
                <PressableScale
                  style={[styles.submitBtn, { backgroundColor: colors.primaryDeep }, (submitting || !addressOk || anySegmentBlocked) && styles.submitBtnDisabled]}
                  scaleTo={0.98}
                  disabled={submitting || !addressOk || anySegmentBlocked}
                  onPress={() => void submitOrder()}>
                  {submitting ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <ThemedText style={[styles.submitText, { color: colors.onPrimary }]}>
                      {segmentCount > 1 ? `Commander (${segmentCount} commerces)` : 'Passer la commande'}
                    </ThemedText>
                  )}
                </PressableScale>
              )}

              <Pressable onPress={() => router.push('/how-multi-delivery' as Href)} style={styles.footerLink}>
                <ThemedText style={[styles.footerLinkText, { color: colors.primary }]}>Comment fonctionnent les livraisons multiples ?</ThemedText>
              </Pressable>

              <ThemedText style={[styles.legalHint, { color: colors.textMuted }]}>
                Commande groupée : chaque restaurant ou boutique prépare et livre sa partie séparément.
              </ThemedText>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Modal de confirmation avant envoi (C2) ── */}
      {confirmOpen && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>}
            <ThemedText type="defaultSemiBold" style={[styles.confirmTitle, { color: colors.text }]}>}
              Récapitulatif de la commande
            </ThemedText>
            {cart?.segments.map((seg) => {
              const ent = enterpriseById[seg.enterpriseId];
              return (
                <View key={seg.enterpriseId} style={[styles.confirmSegment, { borderBottomColor: colors.border }]}>}
                  <ThemedText style={[styles.confirmEntName, { color: colors.text }]}>}
                    {ent?.nom ?? 'Commerce'}
                  </ThemedText>
                  {seg.lines.map((l) => {
                    const prod = productById[l.productId];
                    return (
                      <ThemedText key={l.productId} style={[styles.confirmItem, { color: colors.textMuted }]}>}
                        {l.quantite}× {prod?.nom ?? l.productId}
                      </ThemedText>
                    );
                  })}
                </View>
              );
            })}
            <View style={[styles.confirmRow, { borderTopColor: colors.border }]}>}
              <ThemedText style={{ color: colors.textMuted }}>Articles</ThemedText>
              <ThemedText style={{ color: colors.text }}>{formatFcfa(subtotal)}</ThemedText>
            </View>
            <View style={styles.confirmRow}>}
              <ThemedText style={{ color: colors.textMuted }}>Livraison</ThemedText>
              <ThemedText style={{ color: colors.text }}>{formatFcfa(deliveryFeeTotal)}</ThemedText>
            </View>
            {promoRemise > 0 && (
              <View style={styles.confirmRow}>}
                <ThemedText style={{ color: colors.success }}>Réduction</ThemedText>
                <ThemedText style={{ color: colors.success }}>−{formatFcfa(promoRemise)}</ThemedText>
              </View>
            )}
            <View style={[styles.confirmRow, styles.confirmTotal, { borderTopColor: colors.border }]}>}
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>Total</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>{formatFcfa(grandTotal)}</ThemedText>
            </View>
            <View style={styles.confirmAddr}>}
              <ThemedText style={[styles.confirmAddrLabel, { color: colors.textMuted }]}>Adresse :</ThemedText>
              <ThemedText style={{ color: colors.text }}>{formatDeliveryAddressText(address)}</ThemedText>
            </View>
            <ThemedText style={[styles.confirmHint, { color: colors.textMuted }]}>}
              Paiement par Mobile Money après acceptation du commerce.
            </ThemedText>
            <View style={styles.confirmActions}>}
              <PressableScale
                style={[styles.confirmBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={() => setConfirmOpen(false)}
                scaleTo={0.97}>
                <ThemedText style={{ color: colors.text }}>Annuler</ThemedText>
              </PressableScale>
              <PressableScale
                style={[styles.confirmBtn, styles.confirmBtnPrimary, { backgroundColor: colors.primaryDeep }]}
                onPress={() => void confirmAndSendOrder()}
                scaleTo={0.97}>
                <ThemedText style={{ color: colors.onPrimary, fontWeight: '800' }}>Envoyer la commande</ThemedText>
              </PressableScale>
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 20 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 13, fontWeight: '700' },
  bootRow: { alignItems: 'center', paddingVertical: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  muted: { fontSize: 14 },
  multiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  multiBannerTitle: { fontSize: 13 },
  multiBannerBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  segmentBlock: { marginBottom: 4 },
  segEta: { fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 10, lineHeight: 16 },
  segClosedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: -8,
    marginBottom: 10,
  },
  segClosedTxt: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  emptyCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  emptyArt: {
    width: 132,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyHalo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    opacity: 0.5,
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  emptySpark: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySparkA: { top: 4, right: 12 },
  emptyDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  emptyDotB: { bottom: 12, left: 18 },
  emptyDotC: { bottom: 2, right: 26 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  cta: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ctaText: { fontWeight: '800', fontSize: 14 },
  checkoutSection: {
    marginTop: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkoutSectionTitle: { fontSize: 14 },
  checkoutSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  manageLink: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingLeft: 10 },
  manageLinkText: { fontSize: 13, fontWeight: '800' },
  addrList: { gap: 8, marginBottom: 10 },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  addrCardBody: { flex: 1, gap: 3 },
  addrCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addrCardTitle: { fontSize: 13, flexShrink: 1 },
  addrPrincipal: { fontSize: 11, fontWeight: '800' },
  addrCardText: { fontSize: 13, lineHeight: 18 },
  addrCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAddrHint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  livrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  livrerText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  checkoutWarn: { fontSize: 12, marginTop: 10, fontWeight: '600' },
  payHint: { fontSize: 12, marginBottom: 12, lineHeight: 17 },
  payChoices: { flexDirection: 'row', gap: 10 },
  payChoice: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 2,
  },
  payChoiceLabel: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 12,
    marginTop: 8,
  },
  itemCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  itemTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  thumbPh: { borderWidth: 1 },
  itemTextCol: { flex: 1, gap: 6 },
  itemMerchant: { fontSize: 14 },
  itemDesc: { fontSize: 12, lineHeight: 16 },
  itemBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyVal: { fontSize: 14, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  linePriceCol: { alignItems: 'flex-end', gap: 2 },
  linePriceRight: { fontSize: 14 },
  summary: {
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: { fontSize: 13, flex: 1 },
  summaryValue: { fontSize: 13 },
  promoBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginVertical: 4,
  },
  promoInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
    fontWeight: '700',
  },
  promoBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
  promoBtnText: { fontSize: 13, fontWeight: '800' },
  promoErr: { fontSize: 12, fontWeight: '600' },
  promoOk: { fontSize: 13, fontWeight: '700' },
  promoHint: { fontSize: 12 },
  totalRow: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: { fontSize: 15 },
  totalAmount: { fontSize: 17 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.75 },
  ordersOffBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  ordersOffText: { fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  submitText: { fontWeight: '800', fontSize: 14 },
  footerLink: { marginBottom: 10, alignSelf: 'center', paddingVertical: 4 },
  footerLinkText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  legalHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 8 },
  // Confirmation modal
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  confirmModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  confirmTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  confirmSegment: { paddingBottom: 8, borderBottomWidth: 1, marginBottom: 4 },
  confirmEntName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  confirmItem: { fontSize: 13, marginLeft: 8 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  confirmTotal: { borderTopWidth: 1, paddingTop: 8 },
  confirmAddr: { marginTop: 4 },
  confirmAddrLabel: { fontSize: 12, marginBottom: 2 },
  confirmHint: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  confirmBtnPrimary: { borderWidth: 0 },
});
