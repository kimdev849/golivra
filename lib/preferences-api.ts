import { apiFetch } from '@/lib/api';

export type UserPreferences = {
  notif_push_enabled: boolean;
  notif_email_enabled: boolean;
  dark_mode: boolean | null;
  langue: string;
};

export async function fetchPreferences(token: string): Promise<UserPreferences> {
  const res = await apiFetch<{ preferences: UserPreferences }>('/api/auth/preferences', {
    method: 'GET',
    token,
  });
  return res.preferences;
}

export async function updatePreferences(
  token: string,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const res = await apiFetch<{ preferences: UserPreferences }>('/api/auth/preferences', {
    method: 'PATCH',
    token,
    jsonBody: patch,
  });
  return res.preferences;
}
