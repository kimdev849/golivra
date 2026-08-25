/**
 * Logistics API client for mobile.
 * Mirrors the web logistics-api.ts exactly.
 */

import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'NORMAL' | 'A_SURVEILLER' | 'RETARD' | 'INCIDENT' | 'CRITIQUE';
export type IncidentLevel = 'niveau_1' | 'niveau_2' | 'niveau_3' | null;

export interface IncidentTimelineEvent {
  titre: string;
  date: string;
  date_label: string;
  type: string;
  details?: string | null;
}

export interface IncidentOperatorAction {
  id: string;
  action: string;
  action_label: string;
  operateur_nom: string;
  details?: string | null;
  created_at: string;
  created_at_label: string;
}

export interface IncidentDelivery {
  id: string;
  statut: string;
  type_livraison: string;
  created_at: string;
  attribuee_at?: string | null;
  collectee_at?: string | null;
  livree_at?: string | null;
  montant_total?: number | null;
  note?: string | null;
  livreur?: {
    id: string;
    nom: string;
    telephone?: string | null;
    type_vehicule?: string | null;
    position?: { latitude: number; longitude: number; at?: string } | null;
    derniere_activite_at?: string | null;
  } | null;
  client?: {
    nom?: string | null;
    telephone?: string | null;
    id?: string | null;
  } | null;
  commerce?: {
    id: string;
    type?: string | null;
    nom?: string | null;
    telephone?: string | null;
  } | null;
  adresse_livraison: string;
  adresse_retrait: string;
  delay_minutes: number;
  delay_label: string;
  risk_level: RiskLevel;
  risk_info: { label: string; color: string; emoji: string };
  incident_level: IncidentLevel;
  incident_since?: string | null;
  incident_reason?: string | null;
  last_activity_ago?: number | null;
  delay_reason?: string | null;
  delay_reason_detail?: string | null;
  timeline: IncidentTimelineEvent[];
  operator_actions: IncidentOperatorAction[];
}

export interface IncidentStats {
  total_incidents: number;
  niveau_1: number;
  niveau_2: number;
  niveau_3: number;
  total_active: number;
  risk_breakdown: Record<RiskLevel, number>;
  livraisons: IncidentDelivery[];
  mis_a_jour_le: string;
}

// ── API functions ──────────────────────────────────────────────────────────

/** GET /api/logistics/incidents — list incidents for logistics company */
export async function fetchIncidents(token: string): Promise<IncidentDelivery[]> {
  const data = await apiFetch<IncidentDelivery[]>('/api/logistics/incidents', {
    method: 'GET',
    token,
  });
  return Array.isArray(data) ? data : [];
}

/** GET /api/logistics/incidents/stats — incident stats */
export async function fetchIncidentStats(token: string): Promise<IncidentStats> {
  return apiFetch<IncidentStats>('/api/logistics/incidents/stats', {
    method: 'GET',
    token,
  });
}

/** GET /api/logistics/incidents/:deliveryId — incident detail */
export async function fetchIncidentDetail(token: string, deliveryId: string): Promise<IncidentDelivery> {
  return apiFetch<IncidentDelivery>(`/api/logistics/incidents/${deliveryId}`, {
    method: 'GET',
    token,
  });
}

/** PATCH /api/logistics/incidents/:deliveryId/resolve — resolve incident */
export async function resolveIncident(token: string, deliveryId: string, raison: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/logistics/incidents/${deliveryId}/resolve`, {
    method: 'PATCH',
    token,
    jsonBody: { raison },
  });
}

/** PATCH /api/logistics/incidents/:deliveryId/cancel — cancel delivery */
export async function cancelDelivery(token: string, deliveryId: string, raison: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/logistics/incidents/${deliveryId}/cancel`, {
    method: 'PATCH',
    token,
    jsonBody: { raison },
  });
}

/** POST /api/logistics/incidents/:deliveryId/note — add note */
export async function addIncidentNote(token: string, deliveryId: string, note: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/logistics/incidents/${deliveryId}/note`, {
    method: 'POST',
    token,
    jsonBody: { note },
  });
}

/** PATCH /api/logistics/incidents/:deliveryId/escalate — escalate incident */
export async function escalateIncident(token: string, deliveryId: string): Promise<{ success: boolean; new_level: string }> {
  return apiFetch(`/api/logistics/incidents/${deliveryId}/escalate`, {
    method: 'PATCH',
    token,
  });
}

/** GET /api/logistics/active-deliveries — all active deliveries with risk */
export async function fetchActiveDeliveries(token: string): Promise<IncidentDelivery[]> {
  const data = await apiFetch<IncidentDelivery[]>('/api/logistics/active-deliveries', {
    method: 'GET',
    token,
  });
  return Array.isArray(data) ? data : [];
}

/** GET /api/logistics/stats — logistics stats */
export async function fetchLogisticsStats(token: string): Promise<Record<string, unknown>> {
  return apiFetch('/api/logistics/stats', { method: 'GET', token });
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map risk level to color */
export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITIQUE': return '#DC2626';
    case 'INCIDENT': return '#EF4444';
    case 'RETARD': return '#F97316';
    case 'A_SURVEILLER': return '#F59E0B';
    case 'NORMAL': return '#22C55E';
    default: return '#6B7280';
  }
}

/** Map risk level to label */
export function riskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'CRITIQUE': return 'Critique';
    case 'INCIDENT': return 'Incident';
    case 'RETARD': return 'Retard';
    case 'A_SURVEILLER': return 'À surveiller';
    case 'NORMAL': return 'Normal';
    default: return level;
  }
}

/** Map incident level to label */
export function incidentLevelLabel(level: IncidentLevel): string {
  switch (level) {
    case 'niveau_3': return '🔴 Incident';
    case 'niveau_2': return '🟠 Retard significatif';
    case 'niveau_1': return '🟡 Retard léger';
    default: return '—';
  }
}

/** Map incident level to color */
export function incidentLevelColor(level: IncidentLevel): string {
  switch (level) {
    case 'niveau_3': return '#EF4444';
    case 'niveau_2': return '#F97316';
    case 'niveau_1': return '#F59E0B';
    default: return '#6B7280';
  }
}

/** Delay reasons available for couriers */
export const DELAY_REASONS = [
  { key: 'trafic', label: 'Trafic important', emoji: '🚗' },
  { key: 'client_difficile', label: 'Client difficile à trouver', emoji: '🏠' },
  { key: 'adresse_incorrecte', label: 'Adresse incorrecte', emoji: '📍' },
  { key: 'probleme_vehicule', label: 'Problème véhicule', emoji: '🛵' },
  { key: 'client_injoignable', label: 'Client injoignable', emoji: '📞' },
  { key: 'autre', label: 'Autre problème', emoji: '⚠️' },
] as const;
