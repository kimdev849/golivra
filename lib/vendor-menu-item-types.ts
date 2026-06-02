import type { ProductOptionGroup } from '@/lib/vendor-product-types';

export const MENU_ITEM_STEPS = ['Infos', 'Prix', 'Photo', 'Options', 'Publier'] as const;

export const ALLERGENE_CHOICES = [
  'arachide',
  'gluten',
  'lait',
  'œuf',
  'poisson',
  'crustacés',
  'soja',
  'fruits à coque',
  'sésame',
  'céleri',
  'moutarde',
  'sulfites',
] as const;

export type MenuItemFormValues = {
  nom: string;
  description: string;
  categorieId: string | null;
  prix: string;
  prixPromo: string;
  promoDebutAt: string;
  promoFinAt: string;
  estDisponible: boolean;
  enVedette: boolean;
  /** Facultatif : activer pour limiter la quantité (ex. plat du jour). */
  limiterQuantite: boolean;
  stock: string;
  tagsText: string;
  allergenes: string[];
  optionGroups: ProductOptionGroup[];
  mainImageUri: string | null;
  mainImageDataUrl: string | null;
  gallery: { uri: string; dataUrl: string }[];
};

export const DEFAULT_MENU_ITEM_FORM: MenuItemFormValues = {
  nom: '',
  description: '',
  categorieId: null,
  prix: '',
  prixPromo: '',
  promoDebutAt: '',
  promoFinAt: '',
  estDisponible: true,
  enVedette: false,
  limiterQuantite: false,
  stock: '',
  tagsText: '',
  allergenes: [],
  optionGroups: [],
  mainImageUri: null,
  mainImageDataUrl: null,
  gallery: [],
};
