import * as LocalAuthentication from 'expo-local-authentication';
import { safeGetItem, safeSetItem, safeDeleteItem } from '@/lib/safe-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'golivra_biometric_lock_enabled';

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const v = await safeGetItem(BIOMETRIC_ENABLED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (enabled) {
    const ok = await promptBiometricUnlock('Activez Face ID / empreinte pour GoLivra');
    if (!ok) throw new Error('Authentification biométrique refusée.');
    await safeSetItem(BIOMETRIC_ENABLED_KEY, '1');
    return;
  }
    await safeDeleteItem(BIOMETRIC_ENABLED_KEY);
}

export async function promptBiometricUnlock(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function biometricLockLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Empreinte digitale';
  }
  return 'Code appareil';
}

export async function clearBiometricLockOnLogout(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
  await safeDeleteItem(BIOMETRIC_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}
