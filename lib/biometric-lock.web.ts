/**
 * Verrouillage biométrique — version web (no-op).
 *
 * L'authentification biométrique (Face ID / empreinte) n'existe que sur les
 * appareils natifs. Sur le web, ces fonctions retournent des valeurs par
 * défaut inoffensives.
 */

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  return false;
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  return false;
}

export async function setBiometricLockEnabled(_enabled: boolean): Promise<void> {
  /* no-op web */
}

export async function promptBiometricUnlock(_reason: string): Promise<boolean> {
  return true;
}

export async function biometricLockLabel(): Promise<string> {
  return 'Navigateur';
}

export async function clearBiometricLockOnLogout(): Promise<void> {
  /* no-op web */
}
