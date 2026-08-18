import { deliveryAddressError } from '@/lib/format-address';
import { validateLandmark } from '@/lib/form-validation';

const validBase = { quartier: 'Poto-Poto', ligne1: 'Avenue de la Paix, immeuble bleu' };

describe('validateLandmark', () => {
  test('champ vide -> OK (optionnel)', () => {
    expect(validateLandmark('').ok).toBe(true);
  });

  test('vrais repères / instructions acceptés', () => {
    expect(validateLandmark('Face station Puma').ok).toBe(true);
    expect(validateLandmark('Sonner 2 fois').ok).toBe(true);
    expect(validateLandmark('12e étage').ok).toBe(true);
    expect(validateLandmark('En face de la pharmacie, portail vert').ok).toBe(true);
  });

  test('poubelle refusée (« @#####^ », symboles, chiffres seuls, emojis seuls, HTML)', () => {
    expect(validateLandmark('@#####^').ok).toBe(false);
    expect(validateLandmark('!!!').ok).toBe(false);
    expect(validateLandmark('12345').ok).toBe(false);
    expect(validateLandmark('😀😀').ok).toBe(false);
    expect(validateLandmark('<script>x</script>').ok).toBe(false);
    expect(validateLandmark('$%&3ddf').ok).toBe(false);
  });
});

describe('deliveryAddressError — repère / instructions durcis', () => {
  test('rejette un point de repère absurde (« @#####^ »)', () => {
    expect(deliveryAddressError({ ...validBase, point_reperes: '@#####^' })).not.toBeNull();
  });

  test('rejette des instructions absurdes (« !!! »)', () => {
    expect(deliveryAddressError({ ...validBase, instructions: '!!!' })).not.toBeNull();
  });

  test('accepte un vrai repère et de vraies instructions', () => {
    expect(
      deliveryAddressError({ ...validBase, point_reperes: 'Face station Puma', instructions: 'Sonner 2 fois' }),
    ).toBeNull();
  });

  test('champs vides -> aucune erreur (optionnels)', () => {
    expect(deliveryAddressError(validBase)).toBeNull();
  });
});
