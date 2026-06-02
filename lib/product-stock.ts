/** Cap pratique quand le stock n'est pas suivi (plats, articles illimités). */
export const UNLIMITED_STOCK_CAP = 9999;

/** Valeurs placeholder souvent saisies par défaut — traitées comme illimité côté client. */
const PLACEHOLDER_STOCK = new Set([999, 9999]);

export type ProductStockFields = {
  stock?: number | string | null;
  stock_illimite?: boolean;
  est_disponible?: boolean;
  kind?: 'plat' | 'article' | string;
};

type StockContext = {
  enterpriseType?: 'restaurant' | 'boutique';
};

function isPlatProduct(p: ProductStockFields, ctx?: StockContext): boolean {
  return ctx?.enterpriseType === 'restaurant' || p.kind === 'plat';
}

export function isStockUnlimited(p: ProductStockFields, ctx?: StockContext): boolean {
  if (isPlatProduct(p, ctx)) return true;
  if (p.stock_illimite === true) return true;
  if (p.stock === null || p.stock === undefined) return true;
  const n = Math.floor(Number(p.stock));
  if (!Number.isFinite(n)) return true;
  if (PLACEHOLDER_STOCK.has(n)) return true;
  return false;
}

export function isProductOrderable(p: ProductStockFields, ctx?: StockContext): boolean {
  if (p.est_disponible === false) return false;
  if (isPlatProduct(p, ctx)) return true;
  if (isStockUnlimited(p, ctx)) return true;
  const n = Math.floor(Number(p.stock));
  return Number.isFinite(n) && n > 0;
}

export function effectiveStockCap(p: ProductStockFields, ctx?: StockContext): number {
  if (p.est_disponible === false) return 0;
  if (isPlatProduct(p, ctx) || isStockUnlimited(p, ctx)) return UNLIMITED_STOCK_CAP;
  const n = Math.floor(Number(p.stock));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Libellé client style marketplace — pas de « Stock : 999 ».
 * `null` = ne rien afficher (disponible normalement).
 */
export function stockDisplayLabel(p: ProductStockFields, ctx?: StockContext): string | null {
  if (isPlatProduct(p, ctx)) return null;
  if (isStockUnlimited(p, ctx)) return null;
  const n = Math.floor(Number(p.stock));
  if (!Number.isFinite(n) || n <= 0) return 'Rupture de stock';
  if (n <= 5) return `Plus que ${n} disponible${n > 1 ? 's' : ''}`;
  return null;
}

/**
 * Libellé court pour le tableau de bord vendeur (toujours une chaîne).
 * - Illimité / non suivi → « Illimité »
 * - 0 → « Rupture »
 * - sinon → nombre
 */
export function vendorStockLabel(p: ProductStockFields, ctx?: StockContext): string {
  if (isPlatProduct(p, ctx)) return 'Illimité';
  if (isStockUnlimited(p, ctx)) return 'Illimité';
  const n = Math.floor(Number(p.stock));
  if (!Number.isFinite(n) || n <= 0) return 'Rupture';
  return String(n);
}
