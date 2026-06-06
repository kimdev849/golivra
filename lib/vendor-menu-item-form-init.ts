import type { VendorProduct } from '@/lib/vendor-types';
import { tagsToText } from '@/lib/vendor-product-types';
import { DEFAULT_MENU_ITEM_FORM, type MenuItemFormValues } from '@/lib/vendor-menu-item-types';
import { galleryAssetsFromUrls, splitMainAndGalleryUrls } from '@/lib/vendor-image-urls';

export function menuItemToFormValues(product: VendorProduct): MenuItemFormValues {
  const { main, gallery } = splitMainAndGalleryUrls(product.imageUrl, product.imagesUrls);
  return {
    ...DEFAULT_MENU_ITEM_FORM,
    nom: product.nom,
    description: product.description ?? '',
    categorieId: product.categorieId ?? null,
    prix: String(product.prix),
    prixPromo: product.prixPromo != null ? String(product.prixPromo) : '',
    promoDebutAt: product.promoDebutAt ? product.promoDebutAt.slice(0, 10) : '',
    promoFinAt: product.promoFinAt ? product.promoFinAt.slice(0, 10) : '',
    estDisponible: product.enLigne,
    enVedette: product.enVedette === true,
    limiterQuantite: product.stockIllimite !== true,
    stock: product.stockIllimite ? '' : String(product.stock),
    tagsText: tagsToText(product.tags),
    allergenes: Array.isArray(product.allergenes) ? [...product.allergenes] : [],
    optionGroups: product.optionGroups?.length ? product.optionGroups : [],
    mainImageUri: main,
    mainImageDataUrl: null,
    gallery: galleryAssetsFromUrls(gallery),
  };
}
