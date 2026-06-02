import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

import { apiFetch } from '@/lib/api';
import {
  fetchCourierMissions,
  fetchCourierProfile,
  setCourierAvailability,
  type CourierMission,
  type CourierProfile,
} from '@/lib/courier-api';

type AuthMeLivreur = {
  id: string;
  nom: string | null;
  telephone: string | null;
  email?: string | null;
  imageUrl?: string | null;
  role?: string | null;
  livreur?: CourierProfile['livreur'] | null;
  entreprise_logistique?: CourierProfile['entreprise'] | null;
};

type CourierStore = {
  profile: CourierProfile | null;
  missions: CourierMission[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setDisponible: (value: boolean) => Promise<void>;
  setMissions: (updater: CourierMission[] | ((prev: CourierMission[]) => CourierMission[])) => void;
};

/** Évite d’afficher plusieurs livraisons en double pour la même sous-commande. */
function dedupeCourierMissions(rows: CourierMission[]): CourierMission[] {
  const byKey = new Map<string, CourierMission>();
  for (const m of rows) {
    const key = m.sous_commande_id || m.id;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, m);
      continue;
    }
    if (m.ouverte && m.statut === 'en_attente') {
      byKey.set(key, m);
      continue;
    }
    if (prev.ouverte && prev.statut === 'en_attente') continue;
    const prevTs = new Date(prev.created_at).getTime();
    const curTs = new Date(m.created_at).getTime();
    if (curTs > prevTs) byKey.set(key, m);
  }
  return [...byKey.values()];
}

function profileFromAuthMe(me: AuthMeLivreur): CourierProfile | null {
  if (!me.livreur) return null;
  return {
    livreur: me.livreur,
    utilisateur: {
      id: me.id,
      nom: me.nom,
      telephone: me.telephone,
      email: me.email ?? null,
      imageUrl: me.imageUrl ?? null,
    },
    entreprise: me.entreprise_logistique ?? null,
    resume: {
      missions_actives: 0,
      missions_aujourdhui: 0,
      total_historique: Number(me.livreur.nb_livraisons_total ?? 0),
      reussies_historique: Number(me.livreur.nb_livraisons_reussies ?? 0),
    },
  };
}

export const useCourier = create<CourierStore>((set, get) => ({
  profile: null,
  missions: [],
  loading: true,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { getSessionToken } = await import('@/lib/auth');
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');

      let prof: CourierProfile | null = null;
      try {
        prof = await fetchCourierProfile(token);
      } catch (e) {
        const me = await apiFetch<AuthMeLivreur>('/api/auth/me', { method: 'GET', token });
        prof = profileFromAuthMe(me);
        if (!prof) {
          throw e instanceof Error ? e : new Error('Profil livreur introuvable.');
        }
      }

      let rows: CourierMission[] = [];
      try {
        rows = await fetchCourierMissions(token);
      } catch {
        rows = [];
      }

      const deduped = dedupeCourierMissions(rows);
      const active = deduped.filter((m) => m.statut !== 'livree' && m.statut !== 'annulee');
      prof = {
        ...prof,
        resume: {
          missions_actives: active.length,
          missions_aujourdhui: deduped.filter((m) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return m.created_at >= d.toISOString();
          }).length,
          total_historique: Number(prof.livreur.nb_livraisons_total ?? prof.resume?.total_historique ?? 0),
          reussies_historique: Number(prof.livreur.nb_livraisons_reussies ?? prof.resume?.reussies_historique ?? 0),
        },
      };

      set({ profile: prof, missions: deduped, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erreur.', loading: false });
      throw e;
    }
  },
  setDisponible: async (value: boolean) => {
    const { getSessionToken } = await import('@/lib/auth');
    const token = await getSessionToken();
    if (!token) throw new Error('Session expirée.');
    await setCourierAvailability(token, value);
    set((state) => ({
      profile: state.profile
        ? {
            ...state.profile,
            livreur: { ...state.profile.livreur, est_disponible: value },
          }
        : state.profile,
    }));
  },
  setMissions: (updater) => {
    set((state) => ({
      missions: typeof updater === 'function' ? updater(state.missions) : updater,
    }));
  },
}));

export function CourierProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useCourier.getState().refresh();
  }, []);

  return <>{children}</>;
}

