import { apiFetch } from '@/lib/api';
import { dedupeLines, type CartSegment, type CartState } from '@/lib/cart-local';

export type RemoteCartResponse = {
  panier_id?: string;
  segments: CartSegment[];
  expire_at?: string;
};

export async function fetchRemoteCart(token: string): Promise<RemoteCartResponse> {
  return apiFetch<RemoteCartResponse>('/api/cart', { method: 'GET', token });
}

export async function pushRemoteCart(token: string, segments: CartSegment[]): Promise<RemoteCartResponse> {
  return apiFetch<RemoteCartResponse>('/api/cart', {
    method: 'PUT',
    token,
    jsonBody: { segments },
  });
}

export async function clearRemoteCart(token: string): Promise<RemoteCartResponse> {
  return apiFetch<RemoteCartResponse>('/api/cart', { method: 'DELETE', token });
}

/** Fusionne le panier local avec le serveur (union des lignes par commerce). */
export function mergeCartStates(local: CartState | null, remote: CartState | null): CartState | null {
  if (!local?.segments?.length && !remote?.segments?.length) return null;
  if (!local?.segments?.length) {
    return {
      segments: (remote?.segments ?? [])
        .map((s) => ({ ...s, lines: dedupeLines(s.lines) }))
        .filter((s) => s.lines.length > 0),
    };
  }
  if (!remote?.segments?.length) return local;

  const map = new Map<string, CartSegment>();

  for (const seg of remote.segments) {
    map.set(seg.enterpriseId, {
      ...seg,
      lines: dedupeLines(seg.lines),
    });
  }

  for (const seg of local.segments) {
    const existing = map.get(seg.enterpriseId);
    if (!existing) {
      map.set(seg.enterpriseId, { ...seg, lines: seg.lines.map((l) => ({ ...l })) });
      continue;
    }
    for (const line of seg.lines) {
      const idx = existing.lines.findIndex((l) => l.productId === line.productId);
      if (idx >= 0) {
        existing.lines[idx] = {
          ...existing.lines[idx],
          quantite: Math.max(existing.lines[idx].quantite, line.quantite),
        };
      } else {
        existing.lines.push({ ...line });
      }
    }
  }

  const segments = [...map.values()].filter((s) => s.lines.length > 0);
  return segments.length ? { segments } : null;
}
