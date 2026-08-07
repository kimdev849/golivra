import {
  deliveryEstimateForQuartier,
  deliveryFeeForQuartier,
  deliveryMinutesForQuartier,
  displayDeliveryFeeFcfa,
  type PublicPricing,
} from '@/lib/pricing';

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

  const threeZonePricing: PublicPricing = {
    frais_livraison_base_fcfa: 1000,
    frais_livraison_min_fcfa: 800,
    frais_livraison_max_fcfa: 2500,
    montant_min_commande_fcfa: 1000,
    zones: {
      zones: [
        { id: 'z1', name: 'proche', label: 'Zone proche', price_base: 1000, is_active: true },
        { id: 'z2', name: 'moyenne', label: 'Zone moyenne', price_base: 1500, is_active: true },
        { id: 'z3', name: 'loin', label: 'Zone éloignée', price_base: 2200, is_active: true },
      ],
      arrondissements: [
        { id: 'a1', name: 'Bacongo', zone_id: 'z1' },
        { id: 'a2', name: 'Moungali', zone_id: 'z2' },
        { id: 'a3', name: 'Talangaï', zone_id: 'z3' },
      ],
      price_by_arrondissement: {},
      default_price_fcfa: 1000,
    },
  };

  describe('deliveryMinutesForQuartier', () => {
    test('proche zone -> 30 min', () => {
      expect(deliveryMinutesForQuartier('Bacongo', threeZonePricing)).toBe(30);
    });

    test('moyenne zone -> 45 min', () => {
      expect(deliveryMinutesForQuartier('Moungali', threeZonePricing)).toBe(45);
    });

    test('éloignée zone -> 60 min', () => {
      expect(deliveryMinutesForQuartier('Talangaï', threeZonePricing)).toBe(60);
    });

    test('quartier inconnu -> null', () => {
      expect(deliveryMinutesForQuartier('Inconnu', threeZonePricing)).toBeNull();
    });

    test('pas de zones -> null', () => {
      expect(deliveryMinutesForQuartier('Bacongo', { ...threeZonePricing, zones: null })).toBeNull();
    });
  });

  describe('deliveryEstimateForQuartier', () => {
    test('estimation complète zone proche', () => {
      expect(deliveryEstimateForQuartier('Bacongo', threeZonePricing)).toEqual({
        minutes: 30,
        tier: 'proche',
        tierLabel: 'Zone proche',
      });
    });

    test('estimation complète zone moyenne', () => {
      expect(deliveryEstimateForQuartier('Moungali', threeZonePricing)).toEqual({
        minutes: 45,
        tier: 'moyenne',
        tierLabel: 'Zone moyenne',
      });
    });

    test('quartier inconnu -> estimation vide', () => {
      expect(deliveryEstimateForQuartier('Inconnu', threeZonePricing)).toEqual({
        minutes: null,
        tier: null,
        tierLabel: null,
      });
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
