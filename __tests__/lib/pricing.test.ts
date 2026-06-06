import { deliveryFeeForQuartier, displayDeliveryFeeFcfa, type PublicPricing } from '@/lib/pricing';

describe('pricing lib', () => {
  const mockPricing: PublicPricing = {
    frais_livraison_base_fcfa: 1000,
    frais_livraison_min_fcfa: 800,
    frais_livraison_max_fcfa: 2500,
    montant_min_commande_fcfa: 1000,
    zones: {
      zones: [
        { id: 'z1', name: 'A', label: 'Zone A', price_base: 1200, is_active: true },
      ],
      arrondissements: [
        { id: 'arr1', name: 'Poto-Poto', zone_id: 'z1' },
      ],
      price_by_arrondissement: {
        'Poto-Poto': 1200,
        'Moungali': 1500,
      },
      default_price_fcfa: 1000,
    },
  };

  describe('deliveryFeeForQuartier', () => {
    test('should return zone price if quartier exists in mapping', () => {
      expect(deliveryFeeForQuartier('Poto-Poto', mockPricing)).toBe(1200);
      expect(deliveryFeeForQuartier('Moungali', mockPricing)).toBe(1500);
    });

    test('should return base price if quartier not found', () => {
      expect(deliveryFeeForQuartier('Inconnu', mockPricing)).toBe(1000);
    });

    test('should return base price if no zones configured', () => {
      const simplePricing: PublicPricing = { ...mockPricing, zones: null };
      expect(deliveryFeeForQuartier('Poto-Poto', simplePricing)).toBe(1000);
    });
  });

  describe('displayDeliveryFeeFcfa', () => {
    test('should respect min and max bounds', () => {
      expect(displayDeliveryFeeFcfa(500, mockPricing)).toBe(1000); // Below min (800) -> returns base (1000)
      expect(displayDeliveryFeeFcfa(1200, mockPricing)).toBe(1200); // Within bounds
      expect(displayDeliveryFeeFcfa(3000, mockPricing)).toBe(2500); // Above max (2500) -> returns max (2500)
    });

    test('should return base fee if no commerce fee provided', () => {
      expect(displayDeliveryFeeFcfa(null, mockPricing)).toBe(1000);
      expect(displayDeliveryFeeFcfa(undefined, mockPricing)).toBe(1000);
    });
  });
});
