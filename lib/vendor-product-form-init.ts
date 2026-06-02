import type { VendorProduct } from '@/lib/vendor-types';
import {
  DEFAULT_PRODUCT_FORM,
  tagsToText,
  type VendorProductFormValues,
} from '@/lib/vendor-product-types';

export function productToFormValues(product: VendorProduct): VendorProductFormValues {
  const dims = product.dimensions;
  const existing = Array.isArray(product.imagesUrls) ? product.imagesUrls : [];
  return {
    ...DEFAULT_PRODUCT_FORM,
    nom: product.nom,
    description: product.description ?? '',
    categorieId: product.categorieId ?? null,
    marque: product.marque ?? '',
    typeProduit: (product.typeProduit as VendorProductFormValues['typeProduit']) || 'physique',
    etatProduit: (product.etatProduit as VendorProductFormValues['etatProduit']) || 'neuf',
    prix: String(product.prix),
    prixPromo: product.prixPromo != null ? String(product.prixPromo) : '',
    promoDebutAt: product.promoDebutAt ? product.promoDebutAt.slice(0, 10) : '',
    promoFinAt: product.promoFinAt ? product.promoFinAt.slice(0, 10) : '',
    stock: product.stockIllimite ? '' : String(product.stock),
    stockIllimite: product.stockIllimite === true,
    reference: product.reference ?? '',
    unite: product.unite ?? 'pièce',
    poidsKg: product.poidsKg != null ? String(product.poidsKg) : '',
    longueurCm: dims?.l != null ? String(dims.l) : '',
    largeurCm: dims?.w != null ? String(dims.w) : '',
    hauteurCm: dims?.h != null ? String(dims.h) : '',
    estDisponible: product.enLigne,
    enVedette: product.enVedette === true,
    tagsText: tagsToText(product.tags),
    optionGroups: product.optionGroups?.length ? product.optionGroups : [],
    mainImageUri: product.imageUrl ?? null,
    mainImageDataUrl: null,
    // Pré-remplir avec les URLs déjà uploadées (dataUrl vide = déjà sur le serveur).
    gallery: existing.map((uri) => ({ uri, dataUrl: '' })),
  };
}
