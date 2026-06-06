import { apiFetch } from '@/lib/api';

/**
 * Interface pour l'intégration PawaPay (Mobile Money Congo).
 * L'implémentation repose sur le backend GoLivra qui fait le pont avec l'API PawaPay.
 */

export type PawapayDepositPayload = {
  amount: number;
  phone: string;
  provider: 'MTN' | 'AIRTEL';
  description: string;
  orderId: string;
};

export type PawapayDepositResponse = {
  depositId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  redirectUrl?: string; // Si Pawapay demande une redirection (ex: 3DS ou portail externe)
};

/**
 * Initie un dépôt (collecte) via PawaPay.
 * Le backend GoLivra doit implémenter cet endpoint en appelant l'API PawaPay /deposits.
 */
export async function initiatePawapayPayment(token: string, payload: PawapayDepositPayload): Promise<PawapayDepositResponse> {
  return apiFetch<PawapayDepositResponse>('/api/payments/pawapay/deposit', {
    method: 'POST',
    token,
    jsonBody: payload,
  });
}

/**
 * Vérifie le statut d'un paiement PawaPay.
 */
export async function checkPawapayStatus(token: string, depositId: string): Promise<PawapayDepositResponse> {
  return apiFetch<PawapayDepositResponse>(`/api/payments/pawapay/status/${depositId}`, {
    method: 'GET',
    token,
  });
}
