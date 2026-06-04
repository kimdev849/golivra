import { useFocusEffect } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { Info, Minus, Plus, ShoppingBag, Smartphone, Truck } from 'lucide-react-native';

import { DeliveryAddressForm, type DeliveryAddressFormValue } from '@/components/delivery-address-form';
import { ProductPrice } from '@/components/product-price';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCart } from '@/contexts/cart-context';
import { LUCIDE_STROKE } from '@/constants/icons';
import { TAB_BAR_CONTENT_PADDING_BOTTOM } from '@/constants/layout';
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
import { fetchUserAddresses } from '@/lib/addresses';
import { deliveryAddressError, formatDeliveryAddressText, snapshotFromFields } from '@/lib/format-address';
import { formatFcfa } from '@/lib/format';
import { CLIENT_PAYMENT_METHODS, type ClientPaymentMethodId } from '@/lib/payment-methods';
import { resolveRemoteImageUrl } from '@/lib/images';
import {
  DEFAULT_PUBLIC_PRICING,
  deliveryFeeForQuartier,
  displayDeliveryFeeFcfa,
  fetchPublicPricing,
  zoneLabelForQuartier,
  type PublicPricing,
} from '@/lib/pricing';
import { validatePromoCode, type PromoValidation } from '@/lib/promo-api';
import { effectiveStockCap, UNLIMITED_STOCK_CAP } from '@/lib/product-stock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';

function segmentLabel(seg: CartSegment, ent: EnterprisePublic | null | undefined): string {
  const t = ent?.type ?? seg.enterpriseType;
  if (t === 'boutique') return 'Boutique';
  if (t === 'restaurant') return 'Restaurant';
  return 'Commerce';
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const { cart, hydrated, hydrate, syncFromMemory } = useCart();
  const [address, setAddress] = useState<DeliveryAddressFormValue>({
    quartier: '',
    ligne1: '',
    instructions: '',
    point_reperes: '',
    ville: 'Brazzaville',
    pays: 'Congo',
  });
  const [savedAddressId, setSavedAddressId] = useState<string | null>(null);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  const [productById, setProductById] = useState<Record<string, ProductPublic>>({});
  const [enterpriseById, setEnterpriseById] = useState<Record<string, EnterprisePublic | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [methodePaiement, setMethodePaiement] = useState<ClientPaymentMethodId>('airtel_money');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PublicPricing | null>(null);
  const orderInFlight = useRef(false);

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

  const loadPrincipalAddress = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) return;
      const rows = await fetchUserAddresses(token);
      const principal = rows.find((a) => a.est_principale) ?? rows[0];
      if (!principal) return;
      setSavedAddressId(principal.id);
      setAddress({
        quartier: principal.quartier || '',
        ligne1: principal.ligne1 || '',
        instructions: principal.instructions ?? '',
        point_reperes: principal.point_reperes ?? '',
        ville: principal.ville || 'Brazzaville',
        pays: principal.pays || 'Congo',
      });
    } catch {
      /* pas d'adresse enregistrée */
    }
  }, []);

  const refreshMeta = useCallback(async (c: CartState | null) => {
    void fetchPublicPricing().then(setPricing).catch(() => undefined);
    if (c && c.segments.length > 0) {
      void syncStockFromCart(c);
      void loadPrincipalAddress();
    } else {
      setStockByProduct({});
      setProductById({});
      setEnterpriseById({});
    }
  }, [syncStockFromCart, loadPrincipalAddress]);

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
    const label = zoneLabelForQuartier(address.quartier, p);
    const fee = deliveryFeeForQuartier(address.quartier, p);
    return label ? `${label} · ${formatFcfa(fee)} / livraison` : `${formatFcfa(fee)} / livraison`;
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
    const cap = stockCap(productId, lineStock);
    const next = updateLineQuantitySync(cart, enterpriseId, productId, q, cap);
    void saveCart(next);
  };

  const removeLine = (enterpriseId: string, productId: string) => {
    if (!cart) return;
    const next = removeProductLineSync(cart, enterpriseId, productId);
    void saveCart(next);
  };

  const submitOrder = async () => {
    if (!cart || cart.segments.length === 0) return;
    if (orderInFlight.current || submitting) return;
    const addrErr = deliveryAddressError(address);
    if (addrErr) {
      showError('Adresse invalide', addrErr);
      return;
    }
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
        jsonBody: {
          adresseLivraison: adresseText,
          adresse: adressePayload,
          ...(savedAddressId ? { adresseLivraisonId: savedAddressId } : {}),
          methodePaiement,
          ...(appliedPromo?.code ? { codePromo: appliedPromo.code } : {}),
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
      await apiFetch(`/api/orders/${created.id}/pay`, {
        method: 'POST',
        token,
        jsonBody: {
          provider: methodePaiement === 'mtn_money' ? 'mtn' : 'airtel',
        },
      });
      const rows = cart.segments.map((s, i) => ({
        enterpriseNom: s.enterpriseNom,
        minutesEstimate: Math.min(30 + i * 15, 90),
        kind:
          s.enterpriseType === 'boutique'
            ? ('boutique' as const)
            : s.enterpriseType === 'restaurant'
              ? ('restaurant' as const)
              : ('commerce' as const),
      }));
      await saveCart(null);
      clearPromo();
      setAddress({
        quartier: '',
        ligne1: '',
        instructions: '',
        point_reperes: '',
        ville: 'Brazzaville',
        pays: 'Congo',
      });
      setSavedAddressId(null);
      await refreshMeta(null);
      const summaryHref = {
        pathname: '/order-deliveries-summary',
        params: { data: encodeURIComponent(JSON.stringify(rows)) },
      } as unknown as Href;
      showSuccess(
        'Commande bien passée !',
        segmentCount > 1
          ? `Votre paiement est confirmé. ${segmentCount} livraisons sont en cours de préparation.`
          : 'Votre paiement est confirmé. Le commerce prépare votre commande.',
        {
          primaryLabel: 'Voir le suivi',
          onPrimary: () => router.push(summaryHref),
        },
      );
    } catch (e) {
      showError('Commande impossible', e instanceof Error ? e.message : 'Échec de la commande.');
    } finally {
      orderInFlight.current = false;
      setSubmitting(false);
    }
  };

  const bottomPad = Math.max(insets.bottom, 12) + TAB_BAR_CONTENT_PADDING_BOTTOM;

  const hasItems = cart && cart.segments.some((s) => s.lines.length > 0);
  const addressOk = !deliveryAddressError(address);

  return (
    <ThemedView style={styles.screen}>
      <FeedbackOverlay />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 14), paddingBottom: bottomPad }]}>
          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            Votre panier
          </ThemedText>

          {!hydrated && !hasItems ? (
            <View style={styles.bootRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : !hasItems ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                <ShoppingBag size={28} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.primaryDeep }]}>Votre panier est vide</ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>
                Ajoutez des articles depuis une fiche commerce du marketplace.
              </ThemedText>
              <Pressable
                style={[styles.cta, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/marketplace')}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
                <ThemedText style={[styles.ctaText, { color: colors.onPrimary }]}>Voir les commerces</ThemedText>
              </Pressable>
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

                return (
                  <View key={seg.enterpriseId} style={styles.segmentBlock}>
                    <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: colors.text }]}>
                      {label} · {merchantName}
                    </ThemedText>

                    {seg.lines.map((line) => {
                      const cap = stockCap(line.productId, line.stockSnapshot);
                      const prod = productById[line.productId];
                      const imgUrl = resolveRemoteImageUrl(prod?.image_url);
                      const subtitleParts = [line.nom, prod?.description?.trim()].filter(Boolean);
                      const subtitle = subtitleParts.join(' · ') || line.nom;
                      const lineTotal = line.prixUnitaire * line.quantite;

                      return (
                        <View key={`${seg.enterpriseId}-${line.productId}`} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.itemTop}>
                            {imgUrl ? (
                              <Image source={{ uri: imgUrl }} style={styles.thumb} contentFit="cover" />
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
                <ThemedText type="defaultSemiBold" style={[styles.checkoutSectionTitle, { color: colors.primaryDeep }]}>
                  Adresse de livraison
                </ThemedText>
                <DeliveryAddressForm value={address} onChange={setAddress} compact />
                {!addressOk ? (
                  <ThemedText style={[styles.checkoutWarn, { color: colors.warning }]}>Quartier + description requis pour commander.</ThemedText>
                ) : zoneDeliveryHint ? (
                  <ThemedText style={[styles.checkoutWarn, { color: colors.primary }]}>{zoneDeliveryHint}</ThemedText>
                ) : null}
              </View>

              <View style={[styles.checkoutSection, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold" style={[styles.checkoutSectionTitle, { color: colors.primaryDeep }]}>
                  Paiement Mobile Money
                </ThemedText>
                <ThemedText style={[styles.payHint, { color: colors.textMuted }]}>
                  Airtel Money ou MTN — paiement validé automatiquement en mode test.
                </ThemedText>
                <View style={styles.payChoices}>
                  {CLIENT_PAYMENT_METHODS.map((m) => {
                    const on = methodePaiement === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        style={[styles.payChoice, { backgroundColor: colors.surface, borderColor: colors.border }, on && { borderColor: colors.primary, backgroundColor: colors.primary }]}
                        onPress={() => setMethodePaiement(m.id)}>
                        <Smartphone size={22} color={on ? colors.onPrimary : colors.primary} strokeWidth={LUCIDE_STROKE} />
                        <ThemedText style={[styles.payChoiceLabel, { color: colors.primaryDeep }, on && { color: colors.onPrimary }]}>{m.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.summary}>
                {cart?.segments.map((seg) => (
                  <View key={`sum-${seg.enterpriseId}`} style={styles.summaryRow}>
                    <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                      Sous-total · {seg.enterpriseNom}
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

              <Pressable
                style={[styles.submitBtn, { backgroundColor: colors.primaryDeep }, (submitting || !addressOk) && styles.submitBtnDisabled]}
                disabled={submitting || !addressOk}
                onPress={() => void submitOrder()}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <ThemedText style={[styles.submitText, { color: colors.onPrimary }]}>
                    {segmentCount > 1 ? `Commander (${segmentCount} commerces)` : 'Passer la commande'}
                  </ThemedText>
                )}
              </Pressable>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 20 },
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
  multiBannerTitle: { fontSize: 15 },
  multiBannerBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  segmentBlock: { marginBottom: 4 },
  emptyCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  cta: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ctaText: { fontWeight: '800', fontSize: 15 },
  checkoutSection: {
    marginTop: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  checkoutSectionTitle: { fontSize: 16, marginBottom: 4 },
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
    fontSize: 17,
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
  itemMerchant: { fontSize: 16 },
  itemDesc: { fontSize: 13, lineHeight: 18 },
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
  qtyVal: { fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  linePriceCol: { alignItems: 'flex-end', gap: 2 },
  linePriceRight: { fontSize: 16 },
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
  summaryLabel: { fontSize: 15, flex: 1 },
  summaryValue: { fontSize: 15 },
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
    fontSize: 15,
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
  totalLabel: { fontSize: 17 },
  totalAmount: { fontSize: 20 },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.75 },
  submitText: { fontWeight: '800', fontSize: 16 },
  footerLink: { marginBottom: 10, alignSelf: 'center', paddingVertical: 4 },
  footerLinkText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  legalHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 8 },
});
