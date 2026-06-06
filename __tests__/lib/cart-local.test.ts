import { getCartItemCount, segmentSubtotal, cartTotal, type CartState } from '@/lib/cart-local';

describe('cart-local lib', () => {
  const mockCart: CartState = {
    segments: [
      {
        enterpriseId: 'ent1',
        enterpriseNom: 'Boutique 1',
        lines: [
          { productId: 'p1', nom: 'Produit 1', prixUnitaire: 1000, quantite: 2 },
          { productId: 'p2', nom: 'Produit 2', prixUnitaire: 500, quantite: 1 },
        ],
      },
      {
        enterpriseId: 'ent2',
        enterpriseNom: 'Resto 1',
        lines: [
          { productId: 'p3', nom: 'Plat 1', prixUnitaire: 2500, quantite: 1 },
        ],
      },
    ],
  };

  test('getCartItemCount should return the sum of all quantities', () => {
    expect(getCartItemCount(mockCart)).toBe(4);
    expect(getCartItemCount(null)).toBe(0);
    expect(getCartItemCount({ segments: [] })).toBe(0);
  });

  test('segmentSubtotal should calculate total for one segment', () => {
    const seg1 = mockCart.segments[0];
    const seg2 = mockCart.segments[1];
    expect(segmentSubtotal(seg1)).toBe(2500); // (1000*2) + (500*1)
    expect(segmentSubtotal(seg2)).toBe(2500); // 2500*1
  });

  test('cartTotal should calculate total for the whole cart', () => {
    expect(cartTotal(mockCart)).toBe(5000);
  });
});
