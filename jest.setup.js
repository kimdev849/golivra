/**
 * Setup Jest global : mock officiel d'AsyncStorage.
 *
 * Sans ce mock, les tests qui importent `lib/safe-store` / `lib/cart-local`
 * échouent au chargement (module natif non résolu par jest-expo).
 * Voir https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
