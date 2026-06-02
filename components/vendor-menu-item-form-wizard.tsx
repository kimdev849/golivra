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
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { CategoryPicker } from '@/components/category-picker';
import { DateField } from '@/components/date-field';
import { MAX_GALLERY_PHOTOS, OptionGroupsEditor, pickMultipleVendorImages, pickVendorImageAsset } from '@/components/vendor-form-shared';
import { ThemedText } from '@/components/themed-text';
import { InlineFormError } from '@/components/inline-form-error';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { formatFcfa } from '@/lib/format';
import { getSessionToken } from '@/lib/auth';
import { uploadImageBase64 } from '@/lib/uploads';
import { buildMenuItemApiBody } from '@/lib/vendor-menu-item-payload';
import {
  ALLERGENE_CHOICES,
  DEFAULT_MENU_ITEM_FORM,
  MENU_ITEM_STEPS,
  type MenuItemFormValues,
} from '@/lib/vendor-menu-item-types';
import {
  createArticleCategory,
  createVendorProduct,
  fetchArticleCategories,
  updateVendorProduct,
} from '@/lib/vendor-api';
import type { ArticleCategory } from '@/lib/vendor-product-types';
import type { VendorProduct } from '@/lib/vendor-types';
import { validateCommerceName, validateDescription, validatePrice, validateProductName, validatePromoBlock, validateStock } from '@/lib/form-validation';

type Props = {
  enterpriseId: string;
  palette: { primary: string; primaryDeep: string };
  mode: 'create' | 'edit';
  initialValues?: MenuItemFormValues;
  productId?: string;
  onSaved: (product: VendorProduct) => void;
  onCancel: () => void;
};

export function VendorMenuItemFormWizard({
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
  const [values, setValues] = useState<MenuItemFormValues>(initialValues ?? DEFAULT_MENU_ITEM_FORM);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string | null>>({});

  const patch = (p: Partial<MenuItemFormValues>) => setValues((v) => ({ ...v, ...p }));

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
      const e2 = validateDescription(values.description, 500);
      if (!e2.ok) return e2.message;
    }
    if (s === 1) {
      const e3 = validatePrice(values.prix);
      if (!e3.ok) return e3.message;
      const prixNum = Number(values.prix);
      const promoCheck = validatePromoBlock({
        prixNormal: prixNum,
        prixPromo: values.prixPromo,
        promoDebutAt: values.promoDebutAt,
        promoFinAt: values.promoFinAt,
      });
      if (!promoCheck.ok) return promoCheck.message;
    }
    if (s === 2) {
      if (!values.mainImageUri && !values.mainImageDataUrl) {
        return 'Ajoutez une photo du plat.';
      }
    }
    if (s === 4 && values.limiterQuantite) {
      const e5 = validateStock(values.stock, true);
      if (!e5.ok) return e5.message;
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
        const e2 = validateDescription(values.description, 500);
        if (!e2.ok) fieldErrs.description = e2.message;
      }
      if (step === 1) {
        const e3 = validatePrice(values.prix);
        if (!e3.ok) fieldErrs.prix = e3.message;
        const promoCheck = validatePromoBlock({
          prixNormal: Number(values.prix),
          prixPromo: values.prixPromo,
          promoDebutAt: values.promoDebutAt,
          promoFinAt: values.promoFinAt,
        });
        if (!promoCheck.ok) fieldErrs[promoCheck.field] = promoCheck.message;
      }
      if (step === 4 && values.limiterQuantite) {
        const e5 = validateStock(values.stock, true);
        if (!e5.ok) fieldErrs.stock = e5.message;
      }
      setStepErrors(fieldErrs);
      return;
    }
    setStepErrors({});
    setStep((s) => Math.min(s + 1, MENU_ITEM_STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) onCancel();
    else setStep((s) => s - 1);
  };

  const toggleAllergene = (key: string) => {
    patch({
      allergenes: values.allergenes.includes(key)
        ? values.allergenes.filter((a) => a !== key)
        : [...values.allergenes, key],
    });
  };

  const submit = async () => {
    for (let s = 0; s < MENU_ITEM_STEPS.length; s++) {
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

      let mainUrl: string | undefined;
      if (values.mainImageDataUrl) {
        const up = await uploadImageBase64(token, { dataUrl: values.mainImageDataUrl, folder: 'products' });
        mainUrl = up.url;
      } else if (values.mainImageUri?.startsWith('http')) {
        mainUrl = values.mainImageUri;
      }

      const galleryUrls: string[] = [];
      for (const item of values.gallery) {
        if (item.dataUrl) {
          const up = await uploadImageBase64(token, { dataUrl: item.dataUrl, folder: 'products' });
          galleryUrls.push(up.url);
        } else if (item.uri.startsWith('http')) {
          galleryUrls.push(item.uri);
        }
      }

      const body = buildMenuItemApiBody(values, { mainUrl, galleryUrls });
      const saved =
        mode === 'edit' && productId
          ? await updateVendorProduct(token, enterpriseId, productId, body)
          : await createVendorProduct(token, enterpriseId, body);
      showSuccess(
        mode === 'edit' ? 'Plat mis à jour !' : 'Plat ajouté !',
        'Votre article est enregistré dans le menu.',
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
      showSuccess('Catégorie créée', `"${created.nom}" est disponible pour votre menu.`);
    } catch (e) {
      showError('Catégorie non créée', e instanceof Error ? e.message : undefined);
    }
  };

  const prixNum = Number(values.prix) || 0;
  const promoNum = values.prixPromo.trim() ? Number(values.prixPromo) : null;
  const stepTitle = MENU_ITEM_STEPS[step] ?? '';

  return (
    <View style={styles.root}>
      <FeedbackOverlay />
      <View style={styles.progressWrap}>
        <ThemedText style={[styles.progressTitle, { color: palette.primaryDeep }]}>
          Étape {step + 1} / {MENU_ITEM_STEPS.length} — {stepTitle}
        </ThemedText>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / MENU_ITEM_STEPS.length) * 100}%`, backgroundColor: palette.primary },
            ]}
          />
        </View>
      </View>
      <View style={styles.stepBar}>
        {MENU_ITEM_STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                { backgroundColor: colors.border },
                i <= step && { backgroundColor: palette.primary },
                i === step && { borderWidth: 2, borderColor: colors.success, transform: [{ scale: 1.25 }] },
              ]}>
              <ThemedText style={[styles.stepNum, i <= step && { color: colors.onPrimary }]}>{i + 1}</ThemedText>
            </View>
            <ThemedText style={[styles.stepLabel, i === step && { color: colors.text, fontWeight: '800' }]}>
              {label}
            </ThemedText>
          </View>
        ))}
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
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Identité du plat</ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Nom du plat *</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.nom}
              onChangeText={(t) => { patch({ nom: t }); setStepErrors((s) => ({ ...s, nom: null })); }}
              placeholder="Ex. Poulet braisé"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.nom} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.description}
              onChangeText={(t) => { patch({ description: t }); setStepErrors((s) => ({ ...s, description: null })); }}
              multiline
              placeholder="Ingrédients, accompagnements…"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.description} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Catégorie du menu</ThemedText>
            <Pressable style={[styles.selectCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => setCatPickerOpen(true)} disabled={catLoading}>
              <ThemedText style={[styles.selectTxt, { color: colors.text }]}>
                {catLoading ? 'Chargement…' : selectedCategory?.nom ?? 'Choisir ou créer une catégorie'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setNewCatOpen(true)}>
              <ThemedText style={[styles.linkTxt, { color: palette.primary }]}>+ Nouvelle catégorie</ThemedText>
            </Pressable>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Prix</ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Prix normal (FCFA) *</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.prix}
              onChangeText={(t) => { patch({ prix: t }); setStepErrors((s) => ({ ...s, prix: null })); }}
              keyboardType="numeric"
              placeholder="2500"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={stepErrors.prix} colors={colors} />
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
          </>
        ) : null}

        {step === 2 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Photo du plat</ThemedText>
            <Pressable
              style={[styles.heroImage, { backgroundColor: colors.surfaceMuted }]}
              onPress={async () => {
                const img = await pickVendorImageAsset();
                if (img) patch({ mainImageUri: img.uri, mainImageDataUrl: img.dataUrl });
              }}>
              {values.mainImageUri ? (
                <Image source={{ uri: values.mainImageUri }} style={styles.heroImg} contentFit="cover" />
              ) : (
                <ThemedText style={[styles.photoHint, { color: colors.textMuted }]}>+ Ajouter une photo *</ThemedText>
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
          </>
        ) : null}

        {step === 3 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Options du plat</ThemedText>
            <OptionGroupsEditor
              groups={values.optionGroups}
              onChange={(optionGroups) => patch({ optionGroups })}
              accent={palette.primary}
              groupLabel="options"
              colors={colors}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: palette.primaryDeep }]}>Publication</ThemedText>
            <View style={styles.switchRow}>
              <ThemedText style={[styles.labelInline, { color: colors.text }]}>Plat disponible</ThemedText>
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
            <View style={styles.switchRow}>
              <ThemedText style={[styles.labelInline, { color: colors.text }]}>Limiter la quantité</ThemedText>
              <Switch
                value={values.limiterQuantite}
                onValueChange={(v) => patch({ limiterQuantite: v, stock: v ? values.stock : '' })}
                trackColor={{ false: colors.borderStrong, true: colors.success }}
                thumbColor={values.limiterQuantite ? palette.primary : colors.surfaceMuted}
              />
            </View>
            {values.limiterQuantite ? (
              <>
                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                  Quantité disponible (optionnel — ex. plat du jour)
                </ThemedText>
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
            ) : (
              <ThemedText style={[styles.stockHint, { color: colors.textMuted }]}>
                Sans limite de stock — le plat reste commandable tant qu’il est marqué disponible.
              </ThemedText>
            )}
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Tags (séparés par des virgules)</ThemedText>
            <TextInput
              style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.tagsText}
              onChangeText={(t) => patch({ tagsText: t })}
              multiline
              placeholder="épicé, populaire, nouveau…"
              placeholderTextColor={colors.placeholder}
            />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Allergènes</ThemedText>
            <View style={styles.chipRow}>
              {ALLERGENE_CHOICES.map((a) => {
                const on = values.allergenes.includes(a);
                return (
                  <Pressable
                    key={a}
                    style={[styles.chip, on && { backgroundColor: palette.primary, borderColor: palette.primary }, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => toggleAllergene(a)}>
                    <ThemedText style={[styles.chipTxt, on && styles.chipTxtOn, { color: on ? colors.onPrimary : colors.text }]}>{a}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.previewCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <ThemedText style={[styles.previewTitle, { color: colors.textSecondary }]}>Aperçu</ThemedText>
              {values.mainImageUri ? (
                <Image source={{ uri: values.mainImageUri }} style={styles.previewImg} contentFit="cover" />
              ) : null}
              <ThemedText type="defaultSemiBold" style={[styles.previewNom, { color: colors.text }]}>
                {values.nom.trim() || '—'}
              </ThemedText>
              {selectedCategory ? (
                <ThemedText style={[styles.previewMeta, { color: colors.textMuted }]}>{selectedCategory.nom}</ThemedText>
              ) : null}
              <ThemedText style={[styles.previewPrice, { color: colors.text }]}>
                {promoNum && promoNum > 0 ? (
                  <>
                    <ThemedText style={[styles.promoPrice, { color: colors.success }]}>{formatFcfa(promoNum)}</ThemedText>
                    {'  '}
                    <ThemedText style={[styles.oldPrice, { color: colors.textMuted }]}>{formatFcfa(prixNum)}</ThemedText>
                  </>
                ) : (
                  formatFcfa(prixNum)
                )}
              </ThemedText>
              {values.optionGroups.length > 0 ? (
                <ThemedText style={[styles.previewMeta, { color: colors.textMuted }]}>
                  {values.optionGroups.length} groupe(s) d'options
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.previewCard}>
              <ThemedText style={styles.previewTitle}>Aperçu</ThemedText>
              {values.mainImageUri ? (
                <Image source={{ uri: values.mainImageUri }} style={styles.previewImg} contentFit="cover" />
              ) : null}
              <ThemedText type="defaultSemiBold" style={styles.previewNom}>
                {values.nom.trim() || '—'}
              </ThemedText>
              {selectedCategory ? (
                <ThemedText style={styles.previewMeta}>{selectedCategory.nom}</ThemedText>
              ) : null}
              <ThemedText style={styles.previewPrice}>
                {promoNum && promoNum > 0 ? (
                  <>
                    <ThemedText style={styles.promoPrice}>{formatFcfa(promoNum)}</ThemedText>
                    {'  '}
                    <ThemedText style={styles.oldPrice}>{formatFcfa(prixNum)}</ThemedText>
                  </>
                ) : (
                  formatFcfa(prixNum)
                )}
              </ThemedText>
              {values.optionGroups.length > 0 ? (
                <ThemedText style={styles.previewMeta}>
                  {values.optionGroups.length} groupe(s) d’options
                </ThemedText>
              ) : null}
            </View>
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
        {step < MENU_ITEM_STEPS.length - 1 ? (
          <Pressable style={[styles.footerNext, { backgroundColor: palette.primary }]} onPress={goNext}>
            <ThemedText style={styles.footerNextTxt}>Suivant</ThemedText>
            <ChevronRight size={20} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
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
        title="Catégorie du menu"
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
              placeholder="Ex. Plats principaux"
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
  progressWrap: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 11, fontWeight: '800' },
  stepNumOn: {},
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
    height: 200,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroImg: { width: '100%', height: '100%' },
  photoHint: { fontWeight: '700' },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
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
  selectCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  selectTxt: { fontSize: 15 },
  linkTxt: { fontWeight: '700', fontSize: 13, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  chipTxtOn: {},
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  stockHint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  previewCard: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  previewTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  previewImg: { width: '100%', height: 120, borderRadius: 10 },
  previewNom: { fontSize: 17 },
  previewMeta: { fontSize: 13 },
  previewPrice: { fontSize: 16, fontWeight: '800' },
  promoPrice: { fontSize: 16, fontWeight: '800' },
  oldPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBack: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 },
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
