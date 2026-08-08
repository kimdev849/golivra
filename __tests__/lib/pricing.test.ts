import {
  deliveryEstimateForQuartier,
  deliveryFeeForQuartier,
  deliveryMinutesForQuartier,
  displayDeliveryFeeFcfa,
  enterprisePrepMinutes,
  etaEstimateForEnterprise,
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
    test('proche zone -> 25 min', () => {
      expect(deliveryMinutesForQuartier('Bacongo', threeZonePricing)).toBe(25);
    });

    test('moyenne zone -> 35 min', () => {
      expect(deliveryMinutesForQuartier('Moungali', threeZonePricing)).toBe(35);
    });

    test('éloignée zone -> 45 min', () => {
      expect(deliveryMinutesForQuartier('Talangaï', threeZonePricing)).toBe(45);
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
        minutes: 25,
        tier: 'proche',
        tierLabel: 'Zone proche',
      });
    });

    test('estimation complète zone moyenne', () => {
      expect(deliveryEstimateForQuartier('Moungali', threeZonePricing)).toEqual({
        minutes: 35,
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

  describe('enterprisePrepMinutes', () => {
    test('restaurant -> delai_preparation_min', () => {
      expect(enterprisePrepMinutes({ type: 'restaurant', delai_preparation_min: 25 })).toBe(25);
    });

    test('restaurant sans délai -> défaut 20', () => {
      expect(enterprisePrepMinutes({ type: 'restaurant' })).toBe(20);
    });

    test('boutique -> delai_livraison_min (préparation du colis)', () => {
      expect(enterprisePrepMinutes({ type: 'boutique', delai_livraison_min: 45 })).toBe(45);
    });

    test('boutique sans délai -> défaut 30', () => {
      expect(enterprisePrepMinutes({ type: 'boutique' })).toBe(30);
    });

    test('null / inconnu -> défaut restaurant 20', () => {
      expect(enterprisePrepMinutes(null)).toBe(20);
      expect(enterprisePrepMinutes(undefined)).toBe(20);
    });

    test('bornage 5-180 min', () => {
      expect(enterprisePrepMinutes({ type: 'restaurant', delai_preparation_min: 500 })).toBe(180);
      expect(enterprisePrepMinutes({ type: 'restaurant', delai_preparation_min: 2 })).toBe(5);
      expect(enterprisePrepMinutes({ type: 'restaurant', delai_preparation_min: 0 })).toBe(20);
    });
  });

  describe('etaEstimateForEnterprise', () => {
    test('restaurant + zone proche -> préparation + livraison + arrivée', () => {
      expect(
        etaEstimateForEnterprise(
          { type: 'restaurant', delai_preparation_min: 25 },
          'Bacongo',
          threeZonePricing,
        ),
      ).toEqual({
        prepMinutes: 25,
        deliveryMinutes: 25,
        totalMinutes: 50,
        tierLabel: 'Zone proche',
      });
    });

    test('quartier inconnu -> livraison indéterminée', () => {
      expect(
        etaEstimateForEnterprise(
          { type: 'boutique', delai_livraison_min: 40 },
          'Inconnu',
          threeZonePricing,
        ),
      ).toEqual({
        prepMinutes: 40,
        deliveryMinutes: null,
        totalMinutes: null,
        tierLabel: null,
      });
    });

    test('sans config zones -> livraison indéterminée', () => {
      expect(
        etaEstimateForEnterprise(
          { type: 'restaurant', delai_preparation_min: 20 },
          'Bacongo',
          { ...threeZonePricing, zones: null },
        ),
      ).toEqual({
        prepMinutes: 20,
        deliveryMinutes: null,
        totalMinutes: null,
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
