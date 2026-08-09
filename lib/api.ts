import { getApiOrigin } from '@/lib/config';
import { createRequestId } from '@/lib/request-id';
import { reportAppIncident } from '@/lib/error-reporting';
import { showToast } from '@/lib/app-toast';
import { UX_ERRORS, friendlyErrorMessage } from '@/lib/ux-copy';

export { getApiOrigin };

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalizedPath.startsWith('/api/') ? normalizedPath : `/api${normalizedPath}`;
  return `${getApiOrigin()}${apiPath}`;
}

import { z } from 'zod';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

export type ApiFetchOptions<T = unknown> = RequestInit & {
  token?: string | null;
  jsonBody?: unknown;
  schema?: z.ZodSchema<T>;
  /** Ne pas remonter l'incident à l'admin (ex. rapport observability). */
  skipIncidentReport?: boolean;
};

function extractErrorMessage(parsed: unknown, text: string, status: number): string {
  if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
    return friendlyErrorMessage(String((parsed as { message: unknown }).message));
  }
  const trimmed = text.trim();
  // Express renvoie « Cannot GET/PUT/… » en HTML 404 quand une route n'existe
  // pas encore (API pas redéployée). On montre un message clair au lieu du générique.
  if (/cannot (get|put|post|patch|delete)\b/i.test(trimmed)) {
    return UX_ERRORS.serverOutdated;
  }
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return UX_ERRORS.generic;
  }
  if (status === 401) return UX_ERRORS.session;
  if (status === 403) return UX_ERRORS.forbidden;
  return friendlyErrorMessage(trimmed || UX_ERRORS.generic);
}

function extractErrorCode(parsed: unknown): string | undefined {
  if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) {
    const code = (parsed as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function networkErrorMessage(cause: unknown): string {
  return friendlyErrorMessage(cause, UX_ERRORS.network);
}

let lastSlowToastAt = 0;
/** Démarrage de l'app : les premiers chargements sont attendus, pas d'alerte. */
const appStartTime = Date.now();

/**
 * Signale que la connexion est réellement lente (une requête GET a dépassé 3 s).
 *
 * Gardes pour ne pas spammer :
 *  - au plus une fois toutes les 25 s ;
 *  - jamais pendant les 8 premières secondes (chargement de démarrage) ;
 *  - jamais en arrière-plan.
 */
function notifySlowConnection(): void {
  const now = Date.now();
  if (now - lastSlowToastAt < 25_000) return;
  if (now - appStartTime < 8_000) return;
  if (AppState.currentState !== 'active') return;
  lastSlowToastAt = now;
  showToast({
    message: 'Connexion lente… les données peuvent mettre un moment à s\u2019afficher.',
    variant: 'info',
    duration: 2600,
  });
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions<T> = {}): Promise<T> {
  const { token, jsonBody, headers: initHeaders, body, schema, skipIncidentReport, ...rest } = options;
  const headers = new Headers(initHeaders);
  const requestId = createRequestId();

  headers.set('X-Request-Id', requestId);
  headers.set('X-Client-Source', 'mobile');
  headers.set('X-App-Version', Constants.expoConfig?.version ?? '1.0.0');
  headers.set('X-Platform', Platform.OS);

  let finalBody = body;
  if (jsonBody !== undefined) {
    headers.set('content-type', 'application/json');
    finalBody = JSON.stringify(jsonBody);
  }

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const url = apiUrl(path);
  const method = (rest.method || 'GET').toUpperCase();
  const fetchStart = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      body: finalBody,
    });
  } catch (cause) {
    const message = networkErrorMessage(cause);
    if (!skipIncidentReport) {
      void reportAppIncident({
        requestId,
        title: 'API injoignable',
        message,
        category: 'network',
        httpMethod: method,
        httpPath: path,
        severity: 'error',
        metadata: { url },
      });
    }
    throw new Error(message);
  }

  if (method === 'GET' && Date.now() - fetchStart >= 3000) {
    notifySlowConnection();
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  const responseRequestId =
    (typeof parsed === 'object' &&
      parsed !== null &&
      'requestId' in parsed &&
      typeof (parsed as { requestId: unknown }).requestId === 'string' &&
      (parsed as { requestId: string }).requestId) ||
    res.headers.get('X-Request-Id') ||
    requestId;

  if (!res.ok) {
    const message = extractErrorMessage(parsed, text, res.status);
    const code = extractErrorCode(parsed);
    if (!skipIncidentReport && res.status !== 401) {
      void reportAppIncident({
        requestId: responseRequestId,
        title: `Erreur API ${res.status}`,
        message,
        code,
        httpMethod: method,
        httpPath: path,
        httpStatus: res.status,
        category: res.status >= 500 ? 'api' : 'validation',
        severity: res.status >= 500 ? 'error' : 'warn',
      });
    }
    const err = new Error(message) as Error & { requestId?: string; code?: string };
    err.requestId = responseRequestId;
    err.code = code;
    throw err;
  }

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.warn(`[Zod Error] ${path}:`, result.error.format());
      return parsed as T;
    }
    return result.data;
  }

  return parsed as T;
}
