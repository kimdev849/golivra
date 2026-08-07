import { useEffect, useMemo, useState } from 'react';
import {
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

import {
  CircleDollarSign,
  Image as ImageIcon,
  Info,
  Settings2,
  ToggleLeft,
} from 'lucide-react-native';

import { CategoryPicker } from '@/components/category-picker';
import {
  MAX_GALLERY_PHOTOS,
  OptionGroupsEditor,
  pickMultipleVendorImages,
  VendorPhotoGalleryField,
  type VendorImageAsset,
} from '@/components/vendor-form-shared';
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
import {
  createArticleCategory,
  createVendorProduct,
  fetchArticleCategories,
  updateVendorProduct,
} from '@/lib/vendor-api';
import type { ArticleCategory } from '@/lib/vendor-product-types';
import type { VendorProduct } from '@/lib/vendor-types';
import { validateCommerceName } from '@/lib/form-validation';
import {
  firstListingError,
  validateMenuItemStep,
  type ListingFieldErrors,
} from '@/lib/vendor-listing-validation';
import { showToast } from '@/lib/app-toast';

const DESC_MAX = 500;

/** Nombre d'étapes de validation existantes — utilisées pour valider tout le formulaire d'un coup. */
const VALIDATION_STEPS = 6;

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
  const [values, setValues] = useState<MenuItemFormValues>(initialValues ?? DEFAULT_MENU_ITEM_FORM);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ListingFieldErrors>({});

  const patch = (p: Partial<MenuItemFormValues>) => setValues((v) => ({ ...v, ...p }));
  const clearFieldError = (field: string) =>
    setErrors((s) => ({ ...s, [field]: null }));

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

  const createCategory = async () => {
    const e = validateCommerceName(newCatName);
    if (!e.ok) {
      showToast({ message: e.message, variant: 'error', duration: 2500 });
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
      showToast({ message: 'Catégorie créée ✓', variant: 'success' });
    } catch (e) {
      showError('Catégorie non créée', e instanceof Error ? e.message : undefined);
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

          {/* INFOS */}
          <SectionTitle accent={palette.primary} Icon={Info}>Infos</SectionTitle>
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
          <ThemedText style={[styles.label, { color: colors.text }]}>Catégorie du menu</ThemedText>
          <Pressable
            style={[styles.selectCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={() => setCatPickerOpen(true)}
            disabled={catLoading}>
            <ThemedText style={[styles.selectTxt, { color: colors.text }]}>
              {catLoading ? 'Chargement…' : selectedCategory?.nom ?? 'Choisir ou créer une catégorie'}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setNewCatOpen(true)}>
            <ThemedText style={[styles.linkTxt, { color: palette.primary }]}>+ Nouvelle catégorie</ThemedText>
          </Pressable>

          {/* PRIX */}
          <SectionTitle accent={palette.primary} Icon={CircleDollarSign}>Prix</SectionTitle>
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

          {/* OPTIONS */}
          <SectionTitle accent={palette.primary} Icon={Settings2}>Options</SectionTitle>
          <InlineFormError message={errors.options} colors={colors} />
          <OptionGroupsEditor
            groups={values.optionGroups}
            onChange={(optionGroups) => {
              patch({ optionGroups });
              clearFieldError('options');
            }}
            accent={palette.primary}
            groupLabel="options"
            colors={colors}
          />

          {/* DISPONIBILITÉ */}
          <SectionTitle accent={palette.primary} Icon={ToggleLeft}>Disponibilité</SectionTitle>
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
              <ThemedText style={[styles.label, { color: colors.text }]}>
                Quantité disponible (optionnel — ex. plat du jour)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                value={values.stock}
                onChangeText={(t) => {
                  patch({ stock: t });
                  clearFieldError('stock');
                }}
                keyboardType="numeric"
                placeholder="20"
                placeholderTextColor={colors.placeholder}
              />
              <InlineFormError message={errors.stock} colors={colors} />
            </>
          ) : (
            <ThemedText style={[styles.stockHint, { color: colors.textMuted }]}>
              Sans limite de stock.
            </ThemedText>
          )}
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
