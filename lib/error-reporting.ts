import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getApiOrigin } from '@/lib/config';
import { createRequestId } from '@/lib/request-id';

export type IncidentReportPayload = {
  requestId?: string;
  title: string;
  message: string;
  category?: string;
  severity?: 'error' | 'warn' | 'info';
  stack?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
  code?: string;
  metadata?: Record<string, unknown>;
};

let reporting = false;

function appVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

function deviceInfo() {
  return {
    platform: Platform.OS,
    version: Platform.Version,
  };
}

/**
 * Envoie un incident au backend (fire-and-forget).
 * N'utilise pas apiFetch pour éviter une boucle infinie en cas d'échec.
 */
export async function reportAppIncident(payload: IncidentReportPayload): Promise<void> {
  if (reporting) return;
  reporting = true;
  const requestId = payload.requestId || createRequestId();

  try {
    const token = await import('@/lib/auth').then((m) => m.getSessionToken()).catch(() => null);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'X-Request-Id': requestId,
      'X-Client-Source': 'mobile',
      'X-App-Version': appVersion(),
    };
    if (token) headers.authorization = `Bearer ${token}`;

    await fetch(`${getApiOrigin()}/api/observability/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        request_id: requestId,
        source: 'mobile',
        severity: payload.severity ?? 'error',
        category: payload.category ?? 'unknown',
        title: payload.title.slice(0, 500),
        message: payload.message.slice(0, 4000),
        stack: payload.stack?.slice(0, 12000),
        http_method: payload.httpMethod,
        http_path: payload.httpPath,
        http_status: payload.httpStatus,
        platform: Platform.OS,
        app_version: appVersion(),
        device_info: deviceInfo(),
        metadata: {
          ...(payload.metadata || {}),
          code: payload.code,
        },
      }),
    });
  } catch {
    /* silencieux — ne pas casser l'UX */
  } finally {
    reporting = false;
  }
}

export function installGlobalErrorReporting(): void {
  const ErrorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => (e: Error, f?: boolean) => void; setGlobalHandler?: (h: (e: Error, f?: boolean) => void) => void } }).ErrorUtils;
  if (!ErrorUtils?.getGlobalHandler || !ErrorUtils?.setGlobalHandler) return;

  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    void reportAppIncident({
      title: isFatal ? 'Crash application' : 'Erreur JavaScript',
      message: error?.message || 'Erreur inconnue',
      stack: error?.stack,
      category: 'crash',
      severity: 'error',
      metadata: { isFatal: Boolean(isFatal) },
    });
    previous?.(error, isFatal);
  });
}
