import type { ProductOptionGroup } from '@/lib/vendor-product-types';
import { parseTagsText } from '@/lib/vendor-product-types';
import type { MenuItemFormValues } from '@/lib/vendor-menu-item-types';
import type { VendorProductWriteBody } from '@/lib/vendor-api';

function cleanOptionGroups(groups: ProductOptionGroup[]): ProductOptionGroup[] | null {
  const cleaned = groups
    .map((g) => ({
      nom: g.nom.trim(),
      requis: g.requis !== false,
      choix: g.choix
        .map((c) => ({
          label: c.label.trim(),
          prix_sup: Number(c.prix_sup) || 0,
        }))
        .filter((c) => c.label),
    }))
    .filter((g) => g.nom && g.choix.length);
  return cleaned.length ? cleaned : null;
}

export function buildMenuItemApiBody(
  values: MenuItemFormValues,
  uploaded: { mainUrl?: string; galleryUrls?: string[] },
): VendorProductWriteBody {
  const prix = Number(values.prix);
  const prixPromo = values.prixPromo.trim() ? Number(values.prixPromo) : null;
  const gallery = uploaded.galleryUrls ?? [];
  const allUrls = [
    ...(uploaded.mainUrl ? [uploaded.mainUrl] : []),
    ...gallery.filter((u) => u !== uploaded.mainUrl),
  ];

  return {
    nom: values.nom.trim(),
    description: values.description.trim() || undefined,
    prix,
    prixPromo: prixPromo && prixPromo > 0 ? prixPromo : null,
    stockIllimite: !values.limiterQuantite,
    stock: values.limiterQuantite && values.stock.trim()
      ? Math.max(0, Math.floor(Number(values.stock)))
      : null,
    imageUrl: uploaded.mainUrl,
    imagesUrls: allUrls.length ? allUrls : undefined,
    categorieId: values.categorieId,
    estEnVedette: values.enVedette,
    estDisponible: values.estDisponible,
    options: cleanOptionGroups(values.optionGroups),
    unite: values.unite.trim() || 'pièce',
    tags: parseTagsText(values.tagsText),
    allergenes: values.allergenes.length ? values.allergenes : undefined,
    promoDebutAt: values.promoDebutAt.trim() || null,
    promoFinAt: values.promoFinAt.trim() || null,
  };
}
