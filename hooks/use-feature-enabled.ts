import { useEffect, useState } from 'react';
import { fetchAppStatus, type AppStatus } from '@/lib/app-status';

type Feature = 'orders' | 'payments' | 'delivery';

const FIELD_BY_FEATURE: Record<Feature, keyof AppStatus> = {
  orders: 'orders_enabled',
  payments: 'payments_enabled',
  delivery: 'delivery_enabled',
};

/**
 * État des fonctionnalités de l'application (chargé depuis /api/settings/status).
 * Par défaut tout est activé (filet de sécurité hors-ligne).
 */
export function useAppStatus() {
  const [status, setStatus] = useState<AppStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetchAppStatus().then((s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

/** true si la fonctionnalité est activée (défaut : true). */
export function useFeatureEnabled(feature: Feature): boolean {
  const status = useAppStatus();
  if (!status) return true;
  return Boolean(status[FIELD_BY_FEATURE[feature]]);
}

/** Message d'annonce affiché par l'admin (vide si aucun). */
export function useAppAnnouncement(): string {
  const status = useAppStatus();
  return status?.announcement?.trim() ?? '';
}
