import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';

import { apiFetch } from '@/lib/api';
import {
  fetchCourierMissions,
  fetchCourierProfile,
  sendCourierPosition,
  setCourierAvailability,
  type CourierMission,
  type CourierProfile,
} from '@/lib/courier-api';

/** Statuts pendant lesquels le livreur partage sa position au client. */
const ACTIVE_MISSION_STATUTS = new Set(['attribuee', 'en_collecte', 'collectee', 'en_route']);

/** Fréquence de partage normale : un point toutes les 30 s pendant la course. */
const POSITION_SHARE_MS = 30_000;

/** Fréquence accélérée quand le livreur approche de l'adresse de livraison. */
const POSITION_SHARE_FAST_MS = 15_000;

/** En dessous de cette distance (km), on accélère le partage. */
const PROCHAIN_THRESHOLD_KM = 1;

/** Distance Haversine (km) entre deux points GPS. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  /** Rafraîchit uniquement les missions, sans écran de chargement (actions de course). */
  refreshMissions: () => Promise<void>;
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

/** Recalcule le résumé (missions en cours / aujourd'hui) à partir des missions. */
function withResume(prof: CourierProfile, missions: CourierMission[]): CourierProfile {
  const active = missions.filter((m) => m.statut !== 'livree' && m.statut !== 'annulee');
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return {
    ...prof,
    resume: {
      missions_actives: active.length,
      missions_aujourdhui: missions.filter((m) => m.created_at >= d.toISOString()).length,
      total_historique: Number(prof.livreur.nb_livraisons_total ?? prof.resume?.total_historique ?? 0),
      reussies_historique: Number(prof.livreur.nb_livraisons_reussies ?? prof.resume?.reussies_historique ?? 0),
    },
  };
}

export const useCourier = create<CourierStore>((set, get) => ({
  profile: null,
  missions: [],
  loading: true,
  error: null,
  refresh: async () => {
    // L'écran de chargement n'apparaît qu'au tout premier chargement :
    // dès que des données existent, un refresh reste silencieux.
    const hasData = get().profile !== null || get().missions.length > 0;
    set({ error: null });
    if (!hasData) set({ loading: true });
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
      const updated = withResume(prof, deduped);
      set({ profile: updated, missions: deduped, loading: false });
    } catch (e) {
      // En refresh silencieux (données déjà affichées), on ne pollue pas l'UI
      // avec un bandeau d'erreur : les données actuelles restent affichées.
      if (!hasData) set({ error: e instanceof Error ? e.message : 'Erreur.', loading: false });
      throw e;
    }
  },
  refreshMissions: async () => {
    const { getSessionToken } = await import('@/lib/auth');
    const token = await getSessionToken();
    if (!token) return;
    try {
      const rows = await fetchCourierMissions(token);
      const deduped = dedupeCourierMissions(rows);
      set((state) => ({
        missions: deduped,
        profile: state.profile ? withResume(state.profile, deduped) : state.profile,
      }));
    } catch {
      // Silencieux : on conserve les données actuelles en cas d'échec réseau.
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
  const missions = useCourier((s) => s.missions);

  useEffect(() => {
    void useCourier.getState().refresh();
  }, []);

  // Partage de position pendant une course active (best-effort, jamais bloquant) :
  // - ne tourne QUE s'il y a une course en cours (attribuée → en route) ;
  // - s'arrête automatiquement dès que la course est livrée / annulée ;
  // - fréquence adaptative : 30 s normalement, 15 s quand le livreur approche
  //   de l'adresse de livraison (< 1 km) — batterie et data préservées ;
  // - échec réseau silencieux, le tick suivant réessaie.
  useEffect(() => {
    const activeMission = missions.find((m) => ACTIVE_MISSION_STATUTS.has(m.statut));
    if (!activeMission) return;

    let stopped = false;
    let sending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (stopped) return;
      timer = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      if (stopped || sending) return;
      sending = true;
      try {
        const { getSessionToken } = await import('@/lib/auth');
        const token = await getSessionToken();
        if (!token) return;
        const { captureCurrentPosition } = await import('@/lib/location');
        const pos = await captureCurrentPosition();
        if (pos) {
          await sendCourierPosition(token, pos.latitude, pos.longitude);
          // Proche de l'adresse de livraison → partage plus fréquent.
          let next = POSITION_SHARE_MS;
          const destLat = Number(activeMission.latitude_livraison);
          const destLng = Number(activeMission.longitude_livraison);
          if (Number.isFinite(destLat) && Number.isFinite(destLng)) {
            const dist = haversineKm(pos.latitude, pos.longitude, destLat, destLng);
            if (dist < PROCHAIN_THRESHOLD_KM) next = POSITION_SHARE_FAST_MS;
          }
          schedule(next);
          return;
        }
      } catch {
        // Silencieux : le client garde la dernière position connue.
      } finally {
        sending = false;
      }
      // Pas de position (permission refusée / GPS indisponible) : on réessaie
      // à la fréquence normale, sans spammer.
      schedule(POSITION_SHARE_MS);
    };

    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [missions]);

  return <>{children}</>;
}

