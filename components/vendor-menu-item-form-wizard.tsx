import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Image as ImageIcon,
  Info,
  List,
  Settings2,
  type LucideIcon,
} from 'lucide-react-native';

import { CategoryPicker } from '@/components/category-picker';
import {
  MAX_GALLERY_PHOTOS,
  OptionGroupsEditor,
  pickMultipleVendorImages,
  VendorPhotoGalleryField,
  type VendorImageAsset,
} from '@/components/vendor-form-shared';
import { VendorCollapsibleSection } from '@/components/vendor-collapsible-section';
import { VendorFormFooter } from '@/components/vendor-form-footer';
import { ThemedText } from '@/components/themed-text';
import { InlineFormError } from '@/components/inline-form-error';
import { DateField } from '@/components/date-field';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { uploadVendorListingImages } from '@/lib/vendor-image-upload';
import { buildMenuItemApiBody } from '@/lib/vendor-menu-item-payload';
import {
  ALLERGENE_CHOICES,
  DEFAULT_MENU_ITEM_FORM,
  type MenuItemFormValues,
} from '@/lib/vendor-menu-item-types';
import { UNITE_CHOICES } from '@/lib/vendor-product-types';
import {
  createVendorProduct,
  fetchArticleCategories,
  updateVendorProduct,
} from '@/lib/vendor-api';
import type { ArticleCategory } from '@/lib/vendor-product-types';
import type { VendorProduct } from '@/lib/vendor-types';
import {
  firstListingError,
  validateMenuItemStep,
  type ListingFieldErrors,
} from '@/lib/vendor-listing-validation';
import { showToast } from '@/lib/app-toast';
import { MIN_PRICE } from '@/lib/form-validation';

const DESC_MAX = 500;

/** Nombre d'étapes de validation existantes — utilisées pour valider tout le formulaire d'un coup. */
const VALIDATION_STEPS = 6;

/**
 * Champs logés dans la section repliable « Informations supplémentaires » :
 * s'il y a une erreur de validation dessus, on ouvre la section automatiquement.
 */
const EXTRA_FIELD_KEYS = new Set(['options', 'stock', 'tagsText']);

type Props = {
  enterpriseId: string;
  palette: { primary: string; primaryDeep: string };
  mode: 'create' | 'edit';
  initialValues?: MenuItemFormValues;
  productId?: string;
  onSaved: (product: VendorProduct) => void;
  onCancel: () => void;
};

function SectionTitle({
  accent,
  Icon,
  children,
}: {
  accent: string;
  Icon: typeof Info;
  children: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: accent }]}>
        <Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <ThemedText style={[styles.sectionTitle, { color: accent }]}>{children}</ThemedText>
    </View>
  );
}

/** Petit sous-titre à l'intérieur de la section repliable (groupe de champs). */
function SubLabel({
  colors,
  Icon,
  children,
}: {
  colors: ReturnType<typeof useAppColors>;
  Icon: LucideIcon;
  children: string;
}) {
  return (
    <View style={styles.subLabelRow}>
      <Icon size={14} color={colors.textSecondary} strokeWidth={2.2} />
      <ThemedText style={[styles.subLabel, { color: colors.textSecondary }]}>{children}</ThemedText>
    </View>
  );
}

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
  const { showError, FeedbackOverlay } = useActionFeedback();
  const scrollRef = useRef<ScrollView>(null);
  const [extraSectionY, setExtraSectionY] = useState(0);
  const [values, setValues] = useState<MenuItemFormValues>(initialValues ?? DEFAULT_MENU_ITEM_FORM);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ListingFieldErrors>({});
  const [extraOpen, setExtraOpen] = useState(false);

  const patch = (p: Partial<MenuItemFormValues>) => setValues((v) => ({ ...v, ...p }));
  const clearFieldError = (field: string) =>
    setErrors((s) => ({ ...s, [field]: null }));

  const loadCategories = async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const token = await getSessionToken();
      if (!token) {
        setCatError('Session expirée. Reconnectez-vous.');
        return;
      }
      const list = await fetchArticleCategories(token, enterpriseId);
      setCategories(list);
      if (list.length === 0) {
        setCatError('Aucune catégorie reçue. La migration des catégories GoLivra est-elle appliquée ?');
      }
    } catch (e) {
      setCategories([]);
      setCatError(e instanceof Error ? e.message : 'Problème de connexion.');
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterpriseId]);

  const selectedCategory = categories.find((c) => c.id === values.categorieId) ?? null;

  // ── Photos : la première est la principale ────────────────────────────────
  const images = useMemo<VendorImageAsset[]>(() => {
    const main: VendorImageAsset[] =
      values.mainImageUri || values.mainImageDataUrl
        ? [{ uri: values.mainImageUri ?? '', dataUrl: values.mainImageDataUrl ?? '' }]
        : [];
    return [...main, ...values.gallery];
  }, [values.mainImageUri, values.mainImageDataUrl, values.gallery]);

  const addImages = async () => {
    const remaining = MAX_GALLERY_PHOTOS - images.length;
    if (remaining <= 0) {
      showToast({ message: `Maximum ${MAX_GALLERY_PHOTOS} photos`, variant: 'error', duration: 2500 });
      return;
    }
    const picked = await pickMultipleVendorImages(remaining);
    if (!picked.length) return;
    const fresh = picked.filter((p) => !images.some((g) => g.uri === p.uri));
    if (!fresh.length) return;
    if (fresh.length !== picked.length) {
      showToast({ message: 'Certaines photos étaient déjà ajoutées', variant: 'info', duration: 2200 });
    }
    clearFieldError('mainImage');
    clearFieldError('gallery');
    if (values.mainImageUri || values.mainImageDataUrl) {
      patch({ gallery: [...values.gallery, ...fresh] });
    } else {
      const [first, ...rest] = fresh;
      patch({
        mainImageUri: first.uri,
        mainImageDataUrl: first.dataUrl,
        gallery: [...values.gallery, ...rest],
      });
    }
  };

  const removeImage = (index: number) => {
    if (index === 0) {
      // Supprimer la principale → la 2e photo devient la principale.
      const nextMain = values.gallery[0];
      patch({
        mainImageUri: nextMain?.uri ?? null,
        mainImageDataUrl: nextMain?.dataUrl ?? null,
        gallery: values.gallery.slice(1),
      });
    } else {
      patch({ gallery: values.gallery.filter((_, j) => j !== index - 1) });
    }
  };

  /** Réordonne les photos (glisser-déposer) : la 1re devient la principale. */
  const reorderImages = (ordered: VendorImageAsset[]) => {
    const [main, ...gallery] = ordered;
    patch({
      mainImageUri: main?.uri ?? null,
      mainImageDataUrl: main?.dataUrl ?? null,
      gallery,
    });
    clearFieldError('gallery');
  };

  const toggleAllergene = (key: string) => {
    patch({
      allergenes: values.allergenes.includes(key)
        ? values.allergenes.filter((a) => a !== key)
        : [...values.allergenes, key],
    });
  };

  // ── Validation & enregistrement ───────────────────────────────────────────
  const validateAll = (): boolean => {
    const merged: ListingFieldErrors = {};
    for (let s = 0; s < VALIDATION_STEPS; s++) {
      Object.assign(merged, validateMenuItemStep(values, s));
    }
    const first = firstListingError(merged);
    setErrors(merged);
    // Si une erreur est cachée dans « Informations supplémentaires », on déplie
    // et on défile jusqu'à la section pour qu'elle soit visible.
    if (Object.keys(merged).some((k) => EXTRA_FIELD_KEYS.has(k) && merged[k])) {
      setExtraOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, extraSectionY - 16), animated: true });
      });
    }
    if (first) {
      showToast({ message: first, variant: 'error', duration: 3200 });
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validateAll()) return;
    setSaving(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const uploaded = await uploadVendorListingImages(
        token,
        { uri: values.mainImageUri, dataUrl: values.mainImageDataUrl },
        values.gallery,
      );
      const body = buildMenuItemApiBody(values, {
        mainUrl: uploaded.mainUrl,
        galleryUrls: uploaded.allUrls.filter((u) => u !== uploaded.mainUrl),
      });
      const saved =
        mode === 'edit' && productId
          ? await updateVendorProduct(token, enterpriseId, productId, body)
          : await createVendorProduct(token, enterpriseId, body);
      showToast({
        message: mode === 'edit' ? 'Plat mis à jour ✓' : 'Plat publié ✓',
        variant: 'success',
      });
      onSaved(saved);
    } catch (e) {
      showError('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <FeedbackOverlay />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {/* PHOTOS */}
          <SectionTitle accent={palette.primary} Icon={ImageIcon}>Photos</SectionTitle>
          <InlineFormError message={errors.mainImage ?? errors.gallery} colors={colors} />
          <VendorPhotoGalleryField
            images={images}
            onAdd={() => void addImages()}
            onRemove={removeImage}
            onReorder={reorderImages}
            colors={colors}
            accent={palette.primary}
            mainRequired
          />

          {/* INFORMATIONS PRINCIPALES */}
          <SectionTitle accent={palette.primary} Icon={Info}>Informations principales</SectionTitle>
          <ThemedText style={[styles.label, { color: colors.text }]}>Nom du plat *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
            value={values.nom}
            onChangeText={(t) => {
              patch({ nom: t });
              clearFieldError('nom');
            }}
            placeholder="Ex. Poulet braisé"
            placeholderTextColor={colors.placeholder}
          />
          <InlineFormError message={errors.nom} colors={colors} />
          <ThemedText style={[styles.label, { color: colors.text }]}>Prix normal (FCFA) *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
            value={values.prix}
            onChangeText={(t) => {
              patch({ prix: t });
              clearFieldError('prix');
            }}
            keyboardType="numeric"
            placeholder="2500"
            placeholderTextColor={colors.placeholder}
          />
          <InlineFormError message={errors.prix} colors={colors} />
          <ThemedText style={[styles.hintTxt, { color: colors.textMuted }]}>
            Prix minimum : {MIN_PRICE} FCFA.
          </ThemedText>
          <ThemedText style={[styles.label, { color: colors.text }]}>Catégorie du plat</ThemedText>
          <Pressable
            style={[styles.selectCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={() => setCatPickerOpen(true)}
            disabled={catLoading}>
            <ThemedText style={[styles.selectTxt, { color: colors.text }]}>
              {catLoading ? 'Chargement…' : selectedCategory?.nom ?? 'Choisir une catégorie'}
            </ThemedText>
          </Pressable>
          {catError && !catLoading ? (
            <Pressable onPress={() => void loadCategories()}>
              <ThemedText style={[styles.hintTxt, { color: colors.error }]}>
                Catégories indisponibles — appuyez pour réessayer.
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[styles.hintTxt, { color: colors.textMuted }]}>
              Les catégories sont définies par GoLivra — vous choisissez simplement celle qui correspond à votre plat.
            </ThemedText>
          )}
          <ThemedText style={[styles.label, { color: colors.text }]}>Description</ThemedText>
          <TextInput
            style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
            value={values.description}
            onChangeText={(t) => {
              patch({ description: t });
              clearFieldError('description');
            }}
            multiline
            maxLength={DESC_MAX}
            placeholder="Ingrédients, accompagnements…"
            placeholderTextColor={colors.placeholder}
          />
          <InlineFormError message={errors.description} colors={colors} />
          <ThemedText style={[styles.label, { color: colors.text }]}>Prix promo (FCFA)</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
            value={values.prixPromo}
            onChangeText={(t) => {
              patch({ prixPromo: t });
              clearFieldError('prixPromo');
            }}
            keyboardType="numeric"
            placeholder="Optionnel"
            placeholderTextColor={colors.placeholder}
          />
          <InlineFormError message={errors.prixPromo} colors={colors} />
          {values.prixPromo.trim() ? (
            <>
              <ThemedText style={[styles.label, { color: colors.text }]}>Début promo</ThemedText>
              <DateField
                value={values.promoDebutAt || null}
                onChange={(v) => {
                  patch({ promoDebutAt: v || '' });
                  clearFieldError('promoDebutAt');
                }}
                placeholder="Choisir la date de début"
                accent={palette.primary}
                colors={colors}
              />
              <InlineFormError message={errors.promoDebutAt} colors={colors} />
              <ThemedText style={[styles.label, { color: colors.text }]}>Fin promo</ThemedText>
              <DateField
                value={values.promoFinAt || null}
                onChange={(v) => {
                  patch({ promoFinAt: v || '' });
                  clearFieldError('promoFinAt');
                }}
                placeholder="Choisir la date de fin"
                minimumDate={
                  values.promoDebutAt ? new Date(`${values.promoDebutAt}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0))
                }
                accent={palette.primary}
                colors={colors}
              />
              <InlineFormError message={errors.promoFinAt} colors={colors} />
            </>
          ) : null}
          <View style={styles.switchRow}>
            <ThemedText style={[styles.labelInline, { color: colors.text }]}>Plat disponible</ThemedText>
            <Switch
              value={values.estDisponible}
              onValueChange={(v) => patch({ estDisponible: v })}
              trackColor={{ false: colors.borderStrong, true: colors.success }}
              thumbColor={values.estDisponible ? palette.primary : colors.surfaceMuted}
            />
          </View>

          {/* INFORMATIONS SUPPLÉMENTAIRES */}
          <View onLayout={(e) => setExtraSectionY(e.nativeEvent.layout.y)}>
          <VendorCollapsibleSection
            title="Informations supplémentaires"
            accent={palette.primary}
            colors={colors}
            Icon={Settings2}
            open={extraOpen}
            onToggle={() => setExtraOpen((v) => !v)}>
            <SubLabel colors={colors} Icon={List}>Variantes</SubLabel>
            <InlineFormError message={errors.options} colors={colors} />
            <OptionGroupsEditor
              groups={values.optionGroups}
              onChange={(optionGroups) => {
                patch({ optionGroups });
                clearFieldError('options');
              }}
              accent={palette.primary}
              colors={colors}
            />
            <ThemedText style={[styles.label, { color: colors.text }]}>Unité de vente</ThemedText>
            <View style={styles.chipRow}>
              {UNITE_CHOICES.map((u) => {
                const on = values.unite === u;
                return (
                  <Pressable
                    key={u}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      on && { backgroundColor: palette.primary, borderColor: palette.primary },
                    ]}
                    onPress={() => patch({ unite: u })}>
                    <ThemedText
                      style={[
                        styles.chipTxt,
                        on && styles.chipTxtOn,
                        { color: on ? colors.onPrimary : colors.text },
                      ]}>
                      {u}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={[styles.label, { color: colors.text }]}>Tags</ThemedText>
            <TextInput
              style={[styles.input, styles.area, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              value={values.tagsText}
              onChangeText={(t) => {
                patch({ tagsText: t });
                clearFieldError('tagsText');
              }}
              multiline
              placeholder="épicé, populaire…"
              placeholderTextColor={colors.placeholder}
            />
            <InlineFormError message={errors.tagsText} colors={colors} />
            <ThemedText style={[styles.label, { color: colors.text }]}>Allergènes</ThemedText>
            <View style={styles.chipRow}>
              {ALLERGENE_CHOICES.map((a) => {
                const on = values.allergenes.includes(a);
                return (
                  <Pressable
                    key={a}
                    style={[
                      styles.chip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      on && { backgroundColor: palette.primary, borderColor: palette.primary },
                    ]}
                    onPress={() => toggleAllergene(a)}>
                    <ThemedText
                      style={[
                        styles.chipTxt,
                        on && styles.chipTxtOn,
                        { color: on ? colors.onPrimary : colors.text },
                      ]}>
                      {a}
                    </ThemedText>
                  </Pressable>
                );
              })}
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
          </VendorCollapsibleSection>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <VendorFormFooter
        step={0}
        totalSteps={1}
        mode={mode}
        saving={saving}
        onCancel={onCancel}
        onBack={onCancel}
        onNext={() => void submit()}
        colors={colors}
        accent={palette.primary}
        accentDeep={palette.primaryDeep}
        bottomInset={insets.bottom}
      />

      <CategoryPicker
        visible={catPickerOpen}
        title="Catégorie du plat"
        categories={categories.map((c) => ({ id: c.id, nom: c.nom, description: c.description ?? undefined }))}
        selectedId={values.categorieId}
        onSelect={(c) => patch({ categorieId: c.id })}
        onClose={() => setCatPickerOpen(false)}
        loading={catLoading}
        error={catError}
        onRetry={() => void loadCategories()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  subLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 2,
  },
  subLabel: { fontSize: 13, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 10, opacity: 0.92 },
  labelInline: { fontSize: 14, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  selectCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  selectTxt: { fontSize: 15 },
  hintTxt: { fontSize: 12, marginTop: 8, lineHeight: 17, opacity: 0.8 },
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
});
