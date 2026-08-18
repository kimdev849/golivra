import { apiFetch } from '@/lib/api';

export type OtpRequestResult = {
  message: string;
  testMode?: boolean;
  otpCode?: string;
};

/**
 * Demande un code OTP.
 * @param purpose `'register'` (défaut) ou `'reset_password'` — pour la
 * réinitialisation, le serveur vérifie d'abord que le numéro est lié à un
 * compte existant AVANT d'envoyer le code.
 */
export async function requestOtp(
  telephone: string,
  purpose: 'register' | 'reset_password' = 'register',
): Promise<OtpRequestResult> {
  return apiFetch<OtpRequestResult>('/api/otp/request', {
    method: 'POST',
    jsonBody: purpose === 'reset_password' ? { telephone, purpose } : { telephone },
  });
}

export async function verifyOtp(payload: { telephone: string; code: string }): Promise<{ verified: boolean }> {
  return apiFetch<{ verified: boolean }>('/api/otp/verify', {
    method: 'POST',
    jsonBody: payload,
  });
}
