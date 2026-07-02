import type { ProductPublic } from '@/lib/catalog';
import { resolveRemoteImageUrl, type ResizeOptions } from '@/lib/images';

/** URLs d'images uniques et résolues pour un produit. */
export function getProductGalleryUrls(product: ProductPublic, options?: ResizeOptions): string[] {
  const list: string[] = [];
  if (product.image_url) {
    const resolved = resolveRemoteImageUrl(product.image_url, options);
    if (resolved) list.push(resolved);
  }
  if (Array.isArray(product.images_urls)) {
    for (const u of product.images_urls) {
      const resolved = resolveRemoteImageUrl(u, options);
      if (resolved && !list.includes(resolved)) list.push(resolved);
    }
  }
  return list;
}

export function getProductPrimaryImage(product: ProductPublic, options?: ResizeOptions): string | null {
  return getProductGalleryUrls(product, options)[0] ?? null;
}

export function getProductPhotoCount(product: ProductPublic, options?: ResizeOptions): number {
  return getProductGalleryUrls(product, options).length;
}

export function productKind(product: ProductPublic): 'plat' | 'article' {
  return product.kind === 'article' ? 'article' : 'plat';
}

export function productDetailHref(product: ProductPublic): string {
  const kind = productKind(product);
  return `/(tabs)/product/${product.id}?kind=${kind}`;
}

/** Filtre local par nom, description, vendeur ou tags. */
export function filterProductsByQuery(products: ProductPublic[], query: string): ProductPublic[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => {
    const nom = (p.nom ?? '').toLowerCase();
    const desc = (p.description ?? '').toLowerCase();
    const vendor = (p.enterprise_nom ?? '').toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
    return nom.includes(q) || desc.includes(q) || vendor.includes(q) || tags.includes(q);
  });
}
