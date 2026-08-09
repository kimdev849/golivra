import { apiFetch } from '@/lib/api';
import { getApiOrigin } from '@/lib/config';
import Constants from 'expo-constants';

/**
 * Statut public de l'application renvoyé par GET /api/settings/status.
 * Chaque champ est déterministe côté serveur (même si la base est vide).
 */
export type AppStatus = {
  app_enabled: boolean;
  maintenance_mode: boolean;
  min_app_version: string;
  beta_mode: boolean;
  beta_phones: string[];
  orders_enabled: boolean;
  payments_enabled: boolean;
  delivery_enabled: boolean;
  signups_open: boolean;
  announcement: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: AppStatus | null = null;
let cachedAt = 0;
let inflight: Promise<AppStatus> | null = null;

function defaults(): AppStatus {
  return {
    app_enabled: true,
    maintenance_mode: false,
    min_app_version: '1.0.0',
    beta_mode: false,
    beta_phones: [],
    orders_enabled: true,
    payments_enabled: true,
    delivery_enabled: true,
    signups_open: true,
    announcement: '',
  };
}

/**
 * Version de l'application (expoConfig.version ou fallback package.json).
 */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

function parseVersion(v: string): number[] {
  return String(v || '')
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
}

/** true si la version courante est STRICTEMENT inférieure à la version minimale. */
export function isVersionBelowMin(current: string, min: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(min);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Récupère le statut serveur (avec cache mémoire court). En cas d'échec
 * réseau, renvoie les valeurs par défaut : l'app reste utilisable hors-ligne
 * (filet de sécurité, pas un bloqueur).
 */
export async function fetchAppStatus(options?: { force?: boolean }): Promise<AppStatus> {
  if (options?.force === true) {
    cached = null;
    cachedAt = 0;
  }
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const status = await apiFetch<AppStatus>('/api/settings/status', {
        method: 'GET',
        skipIncidentReport: true,
      });
      cached = { ...defaults(), ...status };
      cachedAt = Date.now();
      return cached;
    } catch {
      // Hors-ligne ou API indisponible → défauts (app utilisable).
      return defaults();
    }
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Vérifie côté serveur si un téléphone est autorisé (bêta fermée). */
export async function isPhoneAllowedInBeta(phone: string | null | undefined): Promise<boolean> {
  if (!phone) return false;
  const normalized = String(phone).replace(/\s+/g, '').replace(/^\+/, '');
  const status = await fetchAppStatus();
  if (!status.beta_mode) return true;
  if (!Array.isArray(status.beta_phones) || status.beta_phones.length === 0) return false;
  return status.beta_phones.some((p) => String(p).replace(/^\+/, '') === normalized);
}

/**
 * Décision de blocage au démarrage.
 * Retourne null si l'app est utilisable, sinon un objet décrivant l'écran.
 * La bêta fermée n'est vérifiée que si un téléphone est connu (session active).
 */
export async function resolveAppGate(): Promise<{
  blocked: boolean;
  reason: 'maintenance' | 'disabled' | 'version';
  status: AppStatus;
}> {
  const status = await fetchAppStatus();

  if (!status.app_enabled) {
    return { blocked: true, reason: 'disabled', status };
  }
  if (status.maintenance_mode) {
    return { blocked: true, reason: 'maintenance', status };
  }
  if (isVersionBelowMin(getAppVersion(), status.min_app_version)) {
    return { blocked: true, reason: 'version', status };
  }
  return { blocked: false, reason: 'version', status };
}

/** URL de l'API (affichée en debug sur l'écran de blocage). */
export function debugApiOrigin(): string {
  return getApiOrigin();
}
