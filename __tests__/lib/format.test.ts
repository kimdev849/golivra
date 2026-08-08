import { formatFcfa, formatHumanMinutes } from '@/lib/format';

describe('formatHumanMinutes', () => {
  test('moins d\'une heure -> "X min"', () => {
    expect(formatHumanMinutes(15)).toBe('15 min');
    expect(formatHumanMinutes(45)).toBe('45 min');
    expect(formatHumanMinutes(59)).toBe('59 min');
  });

  test('heure exacte -> "X h"', () => {
    expect(formatHumanMinutes(60)).toBe('1 h');
    expect(formatHumanMinutes(120)).toBe('2 h');
  });

  test('heures + minutes -> "X h YY"', () => {
    expect(formatHumanMinutes(90)).toBe('1 h 30');
    expect(formatHumanMinutes(85)).toBe('1 h 25');
    expect(formatHumanMinutes(185)).toBe('3 h 05');
  });

  test('null / invalide / négatif -> « quelques minutes »', () => {
    expect(formatHumanMinutes(null)).toBe('quelques minutes');
    expect(formatHumanMinutes(undefined)).toBe('quelques minutes');
    expect(formatHumanMinutes(0)).toBe('quelques minutes');
    expect(formatHumanMinutes(-5)).toBe('quelques minutes');
  });
});

describe('formatFcfa', () => {
  test('formate le montant en FCFA avec séparateur français', () => {
    // toLocaleString('fr-FR') utilise une espace fine insécable (U+202F).
    expect(formatFcfa(1200)).toMatch(/1\u202f200 FCFA/);
    expect(formatFcfa(0)).toBe('0 FCFA');
  });

  test('montant invalide -> tiret', () => {
    expect(formatFcfa(Number.NaN)).toBe('—');
  });
});
