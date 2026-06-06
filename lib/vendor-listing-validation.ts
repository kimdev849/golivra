import {
  validateListingBrand,
  validateListingDescription,
  validateListingOptionGroups,
  validateListingTagsText,
  validateListingText,
} from '@/lib/content-policy';
import type { MenuItemFormValues } from '@/lib/vendor-menu-item-types';
import type { VendorProductFormValues } from '@/lib/vendor-product-types';
import {
  validatePrice,
  validateProductName,
  validatePromoBlock,
  validateStock,
} from '@/lib/form-validation';

export type ListingFieldErrors = Record<string, string | null>;

function policyOnName(nom: string): string | null {
  const base = validateProductName(nom);
  if (!base.ok) return base.message;
  const policy = validateListingText(base.value, { fieldLabel: 'Le nom', maxLength: 100 });
  return policy.ok ? null : policy.message;
}

export function validateMenuItemStep(values: MenuItemFormValues, step: number): ListingFieldErrors {
  const errors: ListingFieldErrors = {};

  if (step === 0) {
    const nomErr = policyOnName(values.nom);
    if (nomErr) errors.nom = nomErr;
    const desc = validateListingDescription(values.description);
    if (!desc.ok) errors.description = desc.message;
  }

  if (step === 1) {
    const prix = validatePrice(values.prix);
    if (!prix.ok) errors.prix = prix.message;
    const promoCheck = validatePromoBlock({
      prixNormal: Number(values.prix),
      prixPromo: values.prixPromo,
      promoDebutAt: values.promoDebutAt,
      promoFinAt: values.promoFinAt,
    });
    if (!promoCheck.ok) errors[promoCheck.field] = promoCheck.message;
  }

  if (step === 2) {
    if (!values.mainImageUri && !values.mainImageDataUrl) {
      errors.mainImage = 'Ajoutez une photo du plat.';
    }
  }

  if (step === 3) {
    const opts = validateListingOptionGroups(values.optionGroups);
    if (!opts.ok) errors.options = opts.message;
  }

  if (step === 4) {
    const tags = validateListingTagsText(values.tagsText);
    if (!tags.ok) errors.tagsText = tags.message;
    if (values.limiterQuantite) {
      const stock = validateStock(values.stock, true);
      if (!stock.ok) errors.stock = stock.message;
    }
  }

  if (step === 5) {
    const prior = validateAllMenuItemSteps(values, 5);
    if (prior) return prior.errors;
  }

  return errors;
}

export function validateProductStep(values: VendorProductFormValues, step: number): ListingFieldErrors {
  const errors: ListingFieldErrors = {};

  if (step === 0) {
    const nomErr = policyOnName(values.nom);
    if (nomErr) errors.nom = nomErr;
    const prix = validatePrice(values.prix);
    if (!prix.ok) errors.prix = prix.message;
    if (!values.mainImageUri && !values.mainImageDataUrl) {
      errors.mainImage = 'Ajoutez au moins une photo principale.';
    }
  }

  if (step === 1) {
    const desc = validateListingDescription(values.description);
    if (!desc.ok) errors.description = desc.message;
    const brand = validateListingBrand(values.marque);
    if (!brand.ok) errors.marque = brand.message;
    if (!values.stockIllimite) {
      const stock = validateStock(values.stock, false);
      if (!stock.ok) errors.stock = stock.message;
    }
  }

  if (step === 2) {
    const opts = validateListingOptionGroups(values.optionGroups);
    if (!opts.ok) errors.options = opts.message;
  }

  if (step === 3) {
    const promoCheck = validatePromoBlock({
      prixNormal: Number(values.prix),
      prixPromo: values.prixPromo,
      promoDebutAt: values.promoDebutAt,
      promoFinAt: values.promoFinAt,
    });
    if (!promoCheck.ok) errors[promoCheck.field] = promoCheck.message;
    const tags = validateListingTagsText(values.tagsText);
    if (!tags.ok) errors.tagsText = tags.message;
  }

  if (step === 4) {
    const prior = validateAllProductSteps(values, 4);
    if (prior) return prior.errors;
  }

  return errors;
}

export function firstListingError(errors: ListingFieldErrors): string | null {
  for (const msg of Object.values(errors)) {
    if (msg) return msg;
  }
  return null;
}

export function validateAllMenuItemSteps(values: MenuItemFormValues, stepCount: number): { step: number; errors: ListingFieldErrors } | null {
  for (let s = 0; s < stepCount; s++) {
    const errors = validateMenuItemStep(values, s);
    const err = firstListingError(errors);
    if (err) return { step: s, errors };
  }
  return null;
}

export function validateAllProductSteps(values: VendorProductFormValues, stepCount: number): { step: number; errors: ListingFieldErrors } | null {
  for (let s = 0; s < stepCount; s++) {
    const errors = validateProductStep(values, s);
    const err = firstListingError(errors);
    if (err) return { step: s, errors };
  }
  return null;
}
