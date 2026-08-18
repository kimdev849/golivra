/**
 * Notifications web — Notification API navigateur + son (Web Audio).
 *
 * Le web ne dispose pas de push natif (pas de token Expo sur navigateur).
 * La réception se fait via `useWebNotifications()` : un polling léger de la
 * liste des notifications quand une session est active → affichage d'une
 * notification navigateur + bip sonore (aucun asset requis).
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

interface WebNotifCtor {
  permission: string;
  requestPermission: () => Promise<string>;
}

/** Récupère le constructeur Notification du navigateur (ou null hors navigateur). */
function browserNotifications(): WebNotifCtor | null {
  try {
    const w = globalThis as { Notification?: WebNotifCtor };
    return w.Notification ?? null;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  try {
    const Ctor = browserNotifications();
    if (!Ctor) return 'denied';
    if (Ctor.permission === 'granted') return 'granted';
    if (Ctor.permission === 'denied') return 'denied';
    const status = await Ctor.requestPermission();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'denied';
  }
}

/** Joue un bip court via Web Audio (aucun asset requis, non bloquant). */
export function playWebNotificationSound(): void {
  try {
    const w = globalThis as {
      AudioContext?: new () => {
        currentTime: number;
        destination: unknown;
        resume?: () => Promise<void>;
        close?: () => Promise<void>;
      };
      webkitAudioContext?: new () => {
        currentTime: number;
        destination: unknown;
        resume?: () => Promise<void>;
        close?: () => Promise<void>;
      };
    };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume?.();
    const audio = ctx as unknown as {
      createOscillator: () => {
        frequency: { value: number };
        type: string;
        connect: (d: unknown) => void;
        start: (t: number) => void;
        stop: (t: number) => void;
      };
      createGain: () => {
        gain: {
          setValueAtTime: (v: number, t: number) => void;
          exponentialRampToValueAtTime: (v: number, t: number) => void;
        };
        connect: (d: unknown) => void;
      };
    };
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.connect(ctx.destination);
    oscillator.connect(gain);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscillator.start(now);
    oscillator.stop(now + 0.4);
    setTimeout(() => {
      try {
        void ctx.close?.();
      } catch {
        /* ignore */
      }
    }, 600);
  } catch {
    /* le son est non bloquant */
  }
}

/** Affiche une notification navigateur (si permission accordée) + son. */
export async function showWebNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    const Ctor = browserNotifications();
    if (!Ctor || Ctor.permission !== 'granted') return;
    const Notif = Ctor as unknown as new (
      t: string,
      opts?: { body?: string; tag?: string },
    ) => { close: () => void; onclick: (() => void) | null };
    const livraisonId =
      data && typeof data.livraison_id === 'string' ? data.livraison_id : undefined;
    const notif = new Notif(title, {
      body: body || undefined,
      tag: livraisonId ? `golivra-${livraisonId}` : 'golivra-notif',
    });
    notif.onclick = () => {
      try {
        (globalThis as { focus?: () => void }).focus?.();
        notif.close();
      } catch {
        /* ignore */
      }
    };
    playWebNotificationSound();
  } catch {
    /* non bloquant */
  }
}

export async function markNotificationHandled(_id: string | null | undefined): Promise<void> {
  /* no-op web */
}

export async function getExpoPushToken(): Promise<string | null> {
  return null;
}

export async function initializeNotifications(): Promise<NotificationPermissionStatus> {
  return 'denied';
}

export async function ensurePushTokenRegistered(): Promise<void> {
  /* no-op web : pas de push natif sur le web */
}

export function handleNotificationNavigation(_data: Record<string, unknown> | null | undefined): void {
  /* no-op web */
}

export function setupNotificationListeners(
  _onReceived?: unknown,
  _onResponse?: unknown,
): () => void {
  return () => undefined;
}

export async function handleInitialNotification(): Promise<void> {
  /* no-op web */
}

export async function cancelAllNotifications(): Promise<void> {
  /* no-op web */
}

export async function sendLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  /* no-op web */
}
