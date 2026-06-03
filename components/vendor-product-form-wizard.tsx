import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react-native';

import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { MAX_GALLERY_PHOTOS, OptionGroupsEditor, pickMultipleVendorImages, pickVendorImageAsset } from '@/components/vendor-form-shared';
import { ThemedText } from '@/components/themed-text';
import { InlineFormError } from '@/components/inline-form-error';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { uploadImageBase64 } from '@/lib/uploads';
import { buildProductApiBody } from '@/lib/vendor-product-payload';
import {
  createArticleCategory,
  createVendorProduct,
  fetchArticleCategories,
  updateVendorProduct,
} from '@/lib/vendor-api';
import {
  DEFAULT_PRODUCT_FORM,
  UNITE_CHOICES,
  generateProductReference,
  type ArticleCategory,
  type ProductCondition,
  type ProductTypeKind,
  type VendorProductFormValues,
} from '@/lib/vendor-product-types';
import type { VendorProduct } from '@/lib/vendor-types';
import { validateCommerceName, validateDescription, validatePrice, validateProductName, validatePromoBlock, validateStock } from '@/lib/form-validation';

const STEPS = ['Essentiel', 'Détails', 'Variantes', 'Publication'] as const;

const TYPE_CHOICES: { key: ProductTypeKind; label: string }[] = [
  { key: 'physique', label: 'Physique' },
  { key: 'numerique', label: 'Numérique' },
  { key: 'service', label: 'Service' },
];

const ETAT_CHOICES: { key: ProductCondition; label: string }[] = [
  { key: 'neuf', label: 'Neuf' },
  { key: 'occasion', label: 'Occasion' },
  { key: 'reconditionne', label: 'Reconditionné' },
];

type Props = {
  enterpriseId: string;
  palette: { primary: string; primaryDeep: string };
  mode: 'create' | 'edit';
  initialValues?: VendorProductFormValues;
  productId?: string;
  onSaved: (product: VendorProduct) => void;
  onCancel: () => void;
};

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  accent,
  colors,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accent: string;
  colors: { border: string; surface: string; text: string; onPrimary: string };
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => onChange(o.key)}>
            <ThemedText style={[styles.chipTxt, on && styles.chipTxtOn, { color: on ? colors.onPrimary : colors.text }]}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function VendorProductFormWizard({
  enterpriseId,
  palette,
  mode,
  initialValues,
  productId,
  onSaved,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { showSuccess, showError, FeedbackOverlay } = useActionFeedback();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<VendorProductFormValues>(initialValues ?? DEFAULT_PRODUCT_FORM);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string | null>>({});

  const patch = (p: Partial<VendorProductFormValues>) => setValues((v) => ({ ...v, ...p }));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getSessionToken();
        if (!token) return;
        const list = await fetchArticleCategories(token, enterpriseId);
        if (alive) setCategories(list);
      } catch {
        if (alive) setCategories([]);
      } finally {
        if (alive) setCatLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enterpriseId]);

  const selectedCategory = categories.find((c) => c.id === values.categorieId) ?? null;

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      const e1 = validateProductName(values.nom);
      if (!e1.ok) return e1.message;
      const e2 = validatePrice(values.prix);
      if (!e2.ok) return e2.message;
      if (!values.mainImageUri && !values.mainImageDataUrl) {
        return 'Ajoutez au moins une photo principale.';
      }
    }
    if (s === 1) {
      const e3 = validateDescription(values.description, 500);
      if (!e3.ok) return e3.message;
      if (!values.stockIllimite) {
        const e4 = validateStock(values.stock, false);
        if (!e4.ok) return e4.message;
      }
    }
    if (s === 3) {
      const prixNum = Number(values.prix);
      const promoCheck = validatePromoBlock({
        prixNormal: prixNum,
        prixPromo: values.prixPromo,
        promoDebutAt: values.promoDebutAt,
        promoFinAt: values.promoFinAt,
      });
      if (!promoCheck.ok) return promoCheck.message;
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      showError('Champ manquant', err);
      const fieldErrs: Record<string, string | null> = {};
      if (step === 0) {
        const e1 = validateProductName(values.nom);
        if (!e1.ok) fieldErrs.nom = e1.message;
        const e2 = validatePrice(values.prix);
        if (!e2.ok) fieldErrs.prix = e2.message;
      }
      if (step === 1 && !values.stockIllimite) {
        const e3 = validateStock(values.stock, false);
        if (!e3.ok) fieldErrs.stock = e3.message;
      }
      if (step === 3) {
        const promoCheck = validatePromoBlock({
          prixNormal: Number(values.prix),
          prixPromo: values.prixPromo,
          promoDebutAt: values.promoDebutAt,
          promoFinAt: values.promoFinAt,
        });
        if (!promoCheck.ok) fieldErrs[promoCheck.field] = promoCheck.message;
      }
      setStepErrors(fieldErrs);
      return;
    }
    setStepErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) onCancel();
    else setStep((s) => s - 1);
  };

  const uploadAllImages = async (token: string) => {
    let mainUrl: string | undefined;
    const galleryUrls: string[] = [];

    if (values.mainImageDataUrl) {
      const up = await uploadImageBase64(token, { dataUrl: values.mainImageDataUrl, folder: 'products' });
      mainUrl = up.url;
    } else if (values.mainImageUri?.startsWith('http')) {
      mainUrl = values.mainImageUri;
    }

    for (const item of values.gallery) {
      const up = await uploadImageBase64(token, { dataUrl: item.dataUrl, folder: 'products' });
      galleryUrls.push(up.url);
    }

    return { mainUrl, galleryUrls };
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s);
      if (err) {
        showError('Vérification', err);
        setStep(s);
        return;
      }
    }

    setSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const uploaded = await uploadAllImages(token);
      const body = buildProductApiBody(values, uploaded);

      const saved =
        mode === 'edit' && productId
          ? await updateVendorProduct(token, enterpriseId, productId, body)
          : await createVendorProduct(token, enterpriseId, body);
      showSuccess(
        mode === 'edit' ? 'Produit mis à jour !' : 'Produit créé !',
        'Votre article est enregistré dans le catalogue.',
        { onPrimary: () => onSaved(saved) },
      );
    } catch (e) {
      showError('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const createCategory = async () => {
    const e = validateCommerceName(newCatName);
    if (!e.ok) {
      showError('Nom invalide', e.message);
      return;
    }
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const created = await createArticleCategory(token, enterpriseId, { nom: newCatName.trim() });
      setCategories((prev) => [...prev, created]);
      patch({ categorieId: created.id });
      setNewCatOpen(false);
      setNewCatName('');
      showSuccess('Catégorie créée', `"${created.nom}" est disponible pour vos produits.`);
    } catch (e) {
      showError('Catégorie non créée', e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <View style={styles.root}>
      <FeedbackOverlay />
      <View style={[styles.stepBar, { borderBottomColor: colors.border }]}>
        {STEPS.map((label, i) => {
          const reached = i <= step;
          const current = i === step;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Aller à l'étape ${i + 1} : ${label}`}
              onPress={() => {
                if (i === step) return;
                setStepErrors({});
                setStep(i);
              }}
              style={({ pressed }) => [styles.stepItem, pressed && { opacity: 0.6 }]}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: colors.border },
                  reached && { backgroundColor: palette.primary },
                  current && { borderWidth: 2, borderColor: colors.success },
                ]}
              />
              <ThemedText style={[styles.stepLabel, current && { color: colors.text, fontWeight: '800' }]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {step === 0 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Informations principales</ThemedText>
            <Pressable
              style={[styles.heroImage, { backgroundColor: colors.surfaceMuted }]}
              onPress={async () => {
                const img = await pickVendorImageAsset();
                if (img) patch({ mainImageUri: img.uri, mainImageDataUrl: img.dataUrl });
              }}>
              {values.mainImageUri ? (
                <Image source={{ uri: values.mainImageUri }} style={styles.heroImg} contentFit="cover" />
              ) : (
                <ThemedText style={[styles.photoHint, { color: colors.textMuted }]}>+ Photo principale *</ThemedText>
              )}
            </Pressable>
            <View style={styles.galleryHeader}>
              <ThemedText style={[styles.galleryLabel, { color: colors.textSecondary }]}>
                Galerie ({values.gallery.length}/{MAX_GALLERY_PHOTOS})
              </ThemedText>
              {values.gallery.length < MAX_GALLERY_PHOTOS ? (
                <Pressable
                  style={[styles.galleryAddBtn, { borderColor: palette.primary, backgroundColor: colors.surface }]}
                  onPress={async () => {
                    const remaining = MAX_GALLERY_PHOTOS - values.gallery.length;
                    const picked = await pickMultipleVendorImages(remaining);
                    if (picked.length) {
                      patch({ gallery: [...values.gallery, ...picked] });
                    }
                  }}>
                  <Plus size={16} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.galleryAddTxt, { color: palette.primary }]}>
                    {values.gallery.length === 0 ? 'Ajouter des photos' : 'Compléter'}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            {values.gallery.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryRow}>
                {values.gallery.map((g, i) => (
                  <View key={`${i}-${g.uri}`} style={styles.thumbWrap}>
                    <Image source={{ uri: g.uri }} style={styles.thumb} contentFit="cover" />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => patch({ gallery: values.gallery.filter((_, j) => j !== i) })}>
                      <X size={14} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <ThemedText style={[styles.galleryEmpty, { color: colors.textMuted }]}>
                Aucune photo complémentaire. Vous pouvez en ajouter jusqu'à {MAX_GALLERY_PHOTOS} en une fois.
              </ThemedText>
            )}
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Nom du produit *</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.nom}
              onChangeText={(t) => { patch({ nom: t }); setStepErrors((s) => ({ ...s, nom: null })); }}
              placeholder="Ex. iPhone 13 Pro, Riz 25kg…"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.nom} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Prix (FCFA) *</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.prix}
              onChangeText={(t) => { patch({ prix: t }); setStepErrors((s) => ({ ...s, prix: null })); }}
              keyboardType="numeric"
              placeholder="15000"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.prix} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Catégorie boutique</ThemedText>
            <Pressable style={[styles.selectCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => setCatPickerOpen(true)} disabled={catLoading}>
              <ThemedText style={[styles.selectTxt, { color: colors.text }]}>
                {catLoading
                  ? 'Chargement…'
                  : selectedCategory?.nom ?? 'Choisir ou créer une catégorie'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setNewCatOpen(true)}>
              <ThemedText style={[styles.linkTxt, { color: palette.primary }]}>+ Nouvelle catégorie</ThemedText>
            </Pressable>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Détails</ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.description}
              onChangeText={(t) => patch({ description: t })}
              multiline
              placeholder="Décrivez votre produit pour rassurer le client…"
              placeholderTextColor={colors.placeholder}
            />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Marque</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.marque}
              onChangeText={(t) => patch({ marque: t })}
              placeholder="Samsung, Nike, Dior…"
              placeholderTextColor={colors.placeholder}
            />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Type de produit</ThemedText>
            <ChipRow options={TYPE_CHOICES} value={values.typeProduit} onChange={(t) => patch({ typeProduit: t })} accent={palette.primary} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>État</ThemedText>
            <ChipRow options={ETAT_CHOICES} value={values.etatProduit} onChange={(e) => patch({ etatProduit: e })} accent={palette.primary} colors={colors} />
            <View style={styles.switchRow}>
              <ThemedText style={[styles.labelInline, { color: colors.text }]}>Stock illimité</ThemedText>
              <Switch
                value={values.stockIllimite}
                onValueChange={(v) => patch({ stockIllimite: v, stock: v ? '' : values.stock })}
                trackColor={{ false: colors.borderStrong, true: colors.success }}
                thumbColor={values.stockIllimite ? palette.primary : colors.surfaceMuted}
              />
            </View>
            {!values.stockIllimite ? (
              <>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Quantité en stock</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                  value={values.stock}
                  onChangeText={(t) => { patch({ stock: t }); setStepErrors((s) => ({ ...s, stock: null })); }}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor={colors.placeholder}
                />
                <InlineFormError message={stepErrors.stock} colors={colors} />
              </>
            ) : null}
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Référence / SKU</ThemedText>
            <View style={styles.refRow}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                value={values.reference}
                onChangeText={(t) => patch({ reference: t })}
                placeholder="SKU-001"
                placeholderTextColor={colors.placeholder}
              />
              <Pressable
                style={[styles.miniBtn, { backgroundColor: colors.primarySoft }]}
                onPress={() => patch({ reference: generateProductReference() })}>
                <ThemedText style={[styles.miniBtnTxt, { color: palette.primaryDeep }]}>Auto</ThemedText>
              </Pressable>
            </View>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Unité de vente</ThemedText>
            <View style={styles.chipRow}>
              {UNITE_CHOICES.map((u) => {
                const on = values.unite === u;
                return (
                  <Pressable
                    key={u}
                    style={[styles.chip, on && { backgroundColor: palette.primary, borderColor: palette.primary }, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => patch({ unite: u })}>
                    <ThemedText style={[styles.chipTxt, on && styles.chipTxtOn, { color: on ? colors.onPrimary : colors.text }]}>{u}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep, marginTop: 16 }]}>
              Livraison (optionnel)
            </ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Poids (kg)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.poidsKg}
              onChangeText={(t) => patch({ poidsKg: t })}
              keyboardType="decimal-pad"
              placeholder="0.5"
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.dimRow}>
              <TextInput
                style={[styles.input, styles.dimInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                value={values.longueurCm}
                onChangeText={(t) => patch({ longueurCm: t })}
                keyboardType="numeric"
                placeholder="L (cm)"
                placeholderTextColor={colors.placeholder}
              />
              <TextInput
                style={[styles.input, styles.dimInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                value={values.largeurCm}
                onChangeText={(t) => patch({ largeurCm: t })}
                keyboardType="numeric"
                placeholder="l (cm)"
                placeholderTextColor={colors.placeholder}
              />
              <TextInput
                style={[styles.input, styles.dimInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                value={values.hauteurCm}
                onChangeText={(t) => patch({ hauteurCm: t })}
                keyboardType="numeric"
                placeholder="H (cm)"
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Variantes & options</ThemedText>
            <OptionGroupsEditor
              groups={values.optionGroups}
              onChange={(optionGroups) => patch({ optionGroups })}
              accent={palette.primary}
              colors={colors}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Publication</ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Prix promo (FCFA)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.prixPromo}
              onChangeText={(t) => { patch({ prixPromo: t }); setStepErrors((s) => ({ ...s, prixPromo: null, promoDebutAt: null, promoFinAt: null })); }}
              keyboardType="numeric"
              placeholder="Optionnel"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.prixPromo} colors={colors} />
            {values.prixPromo.trim() ? (
              <>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Début promo</ThemedText>
                <DateField
                  value={values.promoDebutAt || null}
                  onChange={(v) => { patch({ promoDebutAt: v || '' }); setStepErrors((s) => ({ ...s, promoDebutAt: null, promoFinAt: null })); }}
                  placeholder="Choisir la date de début"
                  accent={palette.primary}
                  colors={colors}
                />
                <InlineFormError message={stepErrors.promoDebutAt} colors={colors} />
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Fin promo</ThemedText>
                <DateField
                  value={values.promoFinAt || null}
                  onChange={(v) => { patch({ promoFinAt: v || '' }); setStepErrors((s) => ({ ...s, promoFinAt: null, promoDebutAt: null })); }}
                  placeholder="Choisir la date de fin"
                  minimumDate={values.promoDebutAt ? new Date(`${values.promoDebutAt}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0))}
                  accent={palette.primary}
                  colors={colors}
                />
                <InlineFormError message={stepErrors.promoFinAt} colors={colors} />
              </>
            ) : null}
            <View style={styles.switchRow}>
              <ThemedText style={[styles.labelInline, { color: colors.text }]}>Produit disponible</ThemedText>
              <Switch
                value={values.estDisponible}
                onValueChange={(v) => patch({ estDisponible: v })}
                trackColor={{ false: colors.borderStrong, true: colors.success }}
                thumbColor={values.estDisponible ? palette.primary : colors.surfaceMuted}
              />
            </View>
            <View style={styles.switchRow}>
              <ThemedText style={[styles.labelInline, { color: colors.text }]}>Mettre en vedette</ThemedText>
              <Switch
                value={values.enVedette}
                onValueChange={(v) => patch({ enVedette: v })}
                trackColor={{ false: colors.borderStrong, true: colors.success }}
                thumbColor={values.enVedette ? palette.primary : colors.surfaceMuted}
              />
            </View>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Tags (séparés par des virgules)</ThemedText>
            <TextInput
              style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.tagsText}
              onChangeText={(t) => patch({ tagsText: t })}
              multiline
              placeholder="samsung, promo, gaming…"
              placeholderTextColor={colors.placeholder}
            />
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable style={styles.footerBack} onPress={goBack}>
          <ChevronLeft size={20} color={colors.text} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={{ color: colors.text, fontWeight: '700' }}>
            {step === 0 ? 'Annuler' : 'Retour'}
          </ThemedText>
        </Pressable>
        {step < STEPS.length - 1 ? (
          <View style={styles.footerRightCluster}>
            {mode === 'edit' ? (
              <Pressable
                style={[styles.footerSaveNow, { borderColor: palette.primary }]}
                onPress={() => void submit()}
                disabled={saving}
                accessibilityLabel="Enregistrer maintenant">
                {saving ? (
                  <ActivityIndicator color={palette.primary} />
                ) : (
                  <ThemedText style={[styles.footerSaveNowTxt, { color: palette.primary }]}>Enregistrer</ThemedText>
                )}
              </Pressable>
            ) : null}
            <Pressable style={[styles.footerNext, { backgroundColor: palette.primary }]} onPress={goNext}>
              <ThemedText style={styles.footerNextTxt}>Suivant</ThemedText>
              <ChevronRight size={20} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.footerNext, { backgroundColor: palette.primaryDeep, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void submit()}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <ThemedText style={styles.footerNextTxt}>{mode === 'edit' ? 'Enregistrer' : 'Publier'}</ThemedText>
            )}
          </Pressable>
        )}
      </View>

      <CategoryPicker
        visible={catPickerOpen}
        title="Catégorie produit"
        categories={categories.map((c) => ({ id: c.id, nom: c.nom, description: c.description ?? undefined }))}
        selectedId={values.categorieId}
        onSelect={(c) => patch({ categorieId: c.id })}
        onClose={() => setCatPickerOpen(false)}
      />

      <Modal visible={newCatOpen} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setNewCatOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="defaultSemiBold" style={[styles.modalTitle, { color: colors.text }]}>
              Nouvelle catégorie
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Ex. Smartphones"
              placeholderTextColor={colors.placeholder}
            />
            <Pressable
              style={[styles.footerNext, { backgroundColor: palette.primary, marginTop: 12 }]}
              onPress={() => void createCategory()}>
              <ThemedText style={styles.footerNextTxt}>Créer</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  stepLabel: { fontSize: 10, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  labelInline: { fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  heroImage: {
    height: 180,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroImg: { width: '100%', height: '100%' },
  photoHint: { fontWeight: '700' },
  galleryRow: { flexDirection: 'row', marginBottom: 8, minHeight: 72 },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 2,
  },
  thumbAdd: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  galleryLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  galleryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  galleryAddTxt: { fontSize: 13, fontWeight: '800' },
  galleryEmpty: { fontSize: 12, lineHeight: 17, marginBottom: 8, fontStyle: 'italic' },
  selectCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  selectTxt: { fontSize: 15 },
  linkTxt: { fontWeight: '700', fontSize: 13, marginTop: 8 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  chipTxtOn: {},
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  refRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  miniBtnTxt: { fontWeight: '800', fontSize: 12 },
  dimRow: { flexDirection: 'row', gap: 8 },
  dimInput: { flex: 1 },
  variantBlock: { gap: 12 },
  variantCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choicePrice: { width: 72 },
  linkBtn: { alignSelf: 'flex-start' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  outlineTxt: { fontWeight: '800', fontSize: 14 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBack: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 },
  footerRightCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerNext: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 15,
  },
  footerNextTxt: { fontWeight: '800', fontSize: 15 },
  footerSaveNow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  footerSaveNowTxt: { fontWeight: '800', fontSize: 14 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: { marginBottom: 12, fontSize: 17 },
});
