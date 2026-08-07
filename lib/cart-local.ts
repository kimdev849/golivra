import { safeGetItem, safeSetItem, safeDeleteItem } from '@/lib/safe-store';

const STORAGE_KEY = 'golivra_cart_v1';

type CartListener = () => void;
const cartListeners = new Set<CartListener>();

/** Panier en mémoire — source de vérité instantanée pour l'UI. */
let memoryCart: CartState | null = null;
let memoryHydrated = false;

export let currentCartCount = 0;

/** Nombre total d'articles (somme des quantités). */
export function getCartItemCount(cart: CartState | null): number {
  if (!cart?.segments?.length) return 0;
  return cart.segments.reduce(
    (sum, seg) => sum + seg.lines.reduce((lineSum, l) => lineSum + l.quantite, 0),
    0
  );
}

export function getCartSync(): CartState | null {
  return memoryCart;
}

export function isCartHydrated(): boolean {
  return memoryHydrated;
}

export function subscribeCart(listener: CartListener): () => void {
  cartListeners.add(listener);
  return () => cartListeners.delete(listener);
}

function notifyCartChanged(): void {
  currentCartCount = getCartItemCount(memoryCart);
  const g = global as unknown as { updateCartState?: () => void; updateCartCount?: (n: number) => void };
  if (typeof global !== 'undefined' && g.updateCartState) {
    g.updateCartState();
  } else if (typeof global !== 'undefined' && g.updateCartCount) {
    g.updateCartCount(currentCartCount);
  }
  cartListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error in cart listener:', e);
    }
  });
}

function setMemoryCart(state: CartState | null): void {
  memoryCart = state;
  notifyCartChanged();
}

export type CartLine = {
  productId: string;
  nom: string;
  prixUnitaire: number;
  quantite: number;
  /** Stock observé au dernier ajout (plafonne les quantités dans le panier). */
  stockSnapshot?: number;
};

export type CartSegment = {
  enterpriseId: string;
  enterpriseNom: string;
  enterpriseType?: 'restaurant' | 'boutique';
  lines: CartLine[];
};

export type CartState = {
  segments: CartSegment[];
};

type LegacyCartV1 = {
  enterpriseId: string;
  enterpriseNom: string;
  lines: unknown;
};

function parseLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is CartLine =>
      typeof l === 'object' &&
      l !== null &&
      typeof (l as CartLine).productId === 'string' &&
      typeof (l as CartLine).nom === 'string' &&
      typeof (l as CartLine).prixUnitaire === 'number' &&
      typeof (l as CartLine).quantite === 'number'
  );
}

function migrateFromV1(o: LegacyCartV1): CartState | null {
  const lines = parseLines(o.lines);
  if (lines.length === 0 || typeof o.enterpriseId !== 'string') return null;
  return {
    segments: [
      {
        enterpriseId: o.enterpriseId,
        enterpriseNom: typeof o.enterpriseNom === 'string' ? o.enterpriseNom : 'Commerce',
        lines,
      },
    ],
  };
}

function parseStoredCart(raw: string): CartState | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    if (Array.isArray(obj.segments)) {
      const segments: CartSegment[] = [];
      for (const s of obj.segments) {
        if (!s || typeof s !== 'object') continue;
        const seg = s as Record<string, unknown>;
        if (typeof seg.enterpriseId !== 'string') continue;
        const lines = parseLines(seg.lines);
        if (lines.length === 0) continue;
        const et = seg.enterpriseType;
        segments.push({
          enterpriseId: seg.enterpriseId,
          enterpriseNom: typeof seg.enterpriseNom === 'string' ? seg.enterpriseNom : 'Commerce',
          enterpriseType: et === 'restaurant' || et === 'boutique' ? et : undefined,
          lines,
        });
      }
      if (segments.length === 0) return null;
      return { segments };
    }

    if (typeof obj.enterpriseId === 'string' && Array.isArray(obj.lines)) {
      return migrateFromV1(obj as LegacyCartV1);
    }
    return null;
  } catch {
    return null;
  }
}

async function readCartFromStorage(): Promise<CartState | null> {
  try {
    const raw = await safeGetItem(STORAGE_KEY);
    if (!raw) return null;
    return parseStoredCart(raw);
  } catch {
    return null;
  }
}

/** Charge SecureStore une fois au démarrage. */
export async function hydrateCart(): Promise<CartState | null> {
  if (memoryHydrated) return memoryCart;
  const loaded = normalizeCart(await readCartFromStorage());
  memoryCart = loaded;
  memoryHydrated = true;
  currentCartCount = getCartItemCount(loaded);
  notifyCartChanged();
  return loaded;
}

export async function loadCart(): Promise<CartState | null> {
  if (memoryHydrated) return memoryCart;
  return hydrateCart();
}

/** Fusionne les lignes en double d'un même produit (garde la quantité max). */
export function dedupeLines(lines: CartLine[]): CartLine[] {
  const byId = new Map<string, CartLine>();
  for (const l of lines) {
    const prev = byId.get(l.productId);
    if (!prev || l.quantite > prev.quantite) byId.set(l.productId, l);
  }
  return [...byId.values()];
}

function normalizeCart(state: CartState | null): CartState | null {
  if (!state) return null;
  const segments = state.segments
    .map((s) => ({ ...s, lines: dedupeLines(s.lines) }))
    .filter((s) => s.lines.length > 0);
  return segments.length > 0 ? { segments } : null;
}

// File du push serveur : sérialise les envois pour éviter les courses
// (« efface puis insère » non atomique côté serveur → doublons).
let pushChain: Promise<void> = Promise.resolve();

function queueServerPush(fn: () => Promise<void>): void {
  pushChain = pushChain.then(fn).catch(() => {});
}

function persistCartAsync(state: CartState | null): void {
  void (async () => {
    try {
      if (!state) {
        await safeDeleteItem(STORAGE_KEY);
      } else {
        await safeSetItem(STORAGE_KEY, JSON.stringify(state));
      }
      // Toujours en file d'attente : jamais deux PUT /api/cart simultanés.
      queueServerPush(() => pushCartToServer(state));
    } catch {
      /* mémoire reste source de vérité */
    }
  })();
}

export function applyCartMutation(updater: (prev: CartState | null) => CartState | null): CartState | null {
  const next = normalizeCart(updater(memoryCart));
  setMemoryCart(next);
  persistCartAsync(next);
  return next;
}

export async function saveCart(state: CartState | null): Promise<void> {
  const next = normalizeCart(state);
  setMemoryCart(next);
  persistCartAsync(next);
}

/** Vide le panier local (mémoire + stockage) sans toucher au serveur. */
export async function clearCart(): Promise<void> {
  memoryCart = null;
  memoryHydrated = true;
  currentCartCount = 0;
  try {
    await safeDeleteItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notifyCartChanged();
}

async function pushCartToServer(state: CartState | null): Promise<void> {
  try {
    const { getSessionToken } = await import('@/lib/auth');
    const token = await getSessionToken();
    if (!token) return;
    const { pushRemoteCart, clearRemoteCart } = await import('@/lib/cart-api');
    if (!state?.segments?.length) {
      await clearRemoteCart(token);
    } else {
      await pushRemoteCart(token, state.segments);
    }
  } catch {
    /* panier local reste source de vérité hors ligne */
  }
}

/** Fusionne avec le serveur en arrière-plan — ne bloque jamais l'UI. */
export async function syncCartWithServer(): Promise<void> {
  try {
    const { getSessionToken } = await import('@/lib/auth');
    const token = await getSessionToken();
    if (!token) return;
    const { fetchRemoteCart, mergeCartStates } = await import('@/lib/cart-api');
    const local = memoryHydrated ? memoryCart : await readCartFromStorage();
    const remote = await fetchRemoteCart(token);
    const merged = mergeCartStates(local, remote.segments?.length ? { segments: remote.segments } : null);
    if (merged) {
      setMemoryCart(merged);
      persistCartAsync(merged);
    } else if (local) {
      void pushCartToServer(local);
    }
  } catch {
    /* ignore */
  }
}

export function segmentSubtotal(seg: CartSegment): number {
  return seg.lines.reduce((sum, l) => sum + l.prixUnitaire * l.quantite, 0);
}

export function cartTotal(state: CartState): number {
  return state.segments.reduce((sum, s) => sum + segmentSubtotal(s), 0);
}

function mergeOrIncrement(
  lines: CartLine[],
  productId: string,
  nom: string,
  prixUnitaire: number,
  stockAvailable: number
): CartLine[] {
  const cap = Math.max(0, Math.floor(stockAvailable));
  const idx = lines.findIndex((l) => l.productId === productId);
  if (idx >= 0) {
    if (cap <= 0) return lines;
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      quantite: Math.min(next[idx].quantite + 1, cap),
      stockSnapshot: stockAvailable,
    };
    return next;
  }
  if (cap <= 0) return lines;
  return [...lines, { productId, nom, prixUnitaire, quantite: 1, stockSnapshot: stockAvailable }];
}

/** Ajoute une unité — mise à jour mémoire instantanée, persistance en arrière-plan. */
export function addProductToCartPrompt(params: {
  enterpriseId: string;
  enterpriseNom: string;
  enterpriseType?: 'restaurant' | 'boutique';
  productId: string;
  nom: string;
  prixUnitaire: number;
  stockAvailable: number;
  onDone?: () => void;
}): void {
  const { enterpriseId, enterpriseNom, enterpriseType, productId, nom, prixUnitaire, stockAvailable, onDone } = params;

  applyCartMutation((existing) => {
    const segments: CartSegment[] = existing?.segments
      ? existing.segments.map((s) => ({ ...s, lines: [...s.lines] }))
      : [];
    const idx = segments.findIndex((s) => s.enterpriseId === enterpriseId);
    const prevLines = idx >= 0 ? segments[idx].lines : [];
    const lines = mergeOrIncrement(prevLines, productId, nom, prixUnitaire, stockAvailable);
    if (lines.length === 0) return existing;

    if (idx >= 0) {
      segments[idx] = {
        ...segments[idx],
        lines,
        enterpriseNom,
        enterpriseType: enterpriseType ?? segments[idx].enterpriseType,
      };
    } else {
      segments.push({ enterpriseId, enterpriseNom, enterpriseType, lines });
    }
    return { segments };
  });

  onDone?.();
}

export function updateLineQuantitySync(
  cart: CartState,
  enterpriseId: string,
  productId: string,
  quantite: number,
  stockAvailable: number
): CartState | null {
  const q = Math.max(0, Math.min(Math.floor(quantite), Math.max(0, stockAvailable)));
  const segments = cart.segments.map((seg) => {
    if (seg.enterpriseId !== enterpriseId) return seg;
    const lines = seg.lines
      .map((l) => (l.productId === productId ? { ...l, quantite: q } : l))
      .filter((l) => l.quantite > 0);
    return { ...seg, lines };
  });
  return normalizeCart({ segments });
}

export async function updateLineQuantity(
  cart: CartState,
  enterpriseId: string,
  productId: string,
  quantite: number,
  stockAvailable: number
): Promise<void> {
  const next = updateLineQuantitySync(cart, enterpriseId, productId, quantite, stockAvailable);
  await saveCart(next);
}

export function removeProductLineSync(cart: CartState, enterpriseId: string, productId: string): CartState | null {
  const segments = cart.segments.map((seg) => {
    if (seg.enterpriseId !== enterpriseId) return seg;
    return { ...seg, lines: seg.lines.filter((l) => l.productId !== productId) };
  });
  return normalizeCart({ segments });
}

export async function removeProductLine(cart: CartState, enterpriseId: string, productId: string): Promise<void> {
  await saveCart(removeProductLineSync(cart, enterpriseId, productId));
}
