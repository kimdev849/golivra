/**
 * Notifications web temps réel (Navigation API navigateur + son).
 *
 * Le web n'a pas de push natif (pas de token Expo navigateur) : on surveille
 * donc la liste des notifications par polling léger (15 s) tant qu'une session
 * est active. À chaque nouvelle notification reçue côté serveur :
 *   - une notification navigateur est affichée (si permission accordée),
 *   - un bip court est joué (Web Audio).
 *
 * Repère anti-annonce : la première notification vue sert de base — on n'annonce
 * que ce qui arrive APRÈS, jamais ce qui existait déjà avant l'ouverture.
 *
 * No-op sur natif (les push FCM/APNs gèrent déjà tout là-bas).
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getSessionToken } from '@/lib/auth';
import { fetchNotifications } from '@/lib/notifications-api';
import {
  requestNotificationPermission,
  showWebNotification,
} from '@/lib/notifications-service';
import { safeGetItem, safeSetItem } from '@/lib/safe-store';

const LAST_SEEN_KEY = 'golivra_web_last_seen_notif_v1';
const POLL_MS = 15_000;

export function useWebNotifications(): void {
  const baseline = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          baseline.current = false;
          return;
        }
        const { items } = await fetchNotifications(token, { limit: 1 });
        const latest = items[0];

        // Aucune notification : on pose simplement le repère.
        if (!latest) {
          baseline.current = true;
          return;
        }

        const lastSeen = await safeGetItem(LAST_SEEN_KEY);

        // 1er passage : base de référence, sans annoncer ce qui existait déjà.
        if (!baseline.current) {
          baseline.current = true;
          await safeSetItem(LAST_SEEN_KEY, latest.id);
          return;
        }

        // Nouvelle notification depuis le dernier passage → on l'annonce.
        if (lastSeen !== latest.id) {
          await safeSetItem(LAST_SEEN_KEY, latest.id);
          void showWebNotification(
            latest.titre,
            latest.corps ?? '',
            latest.data ?? undefined,
          );
        }
      } catch {
        /* silencieux : le polling reprend au tour suivant */
      }
    };

    // Permission navigateur : demandée une seule fois si jamais tranchée.
    void requestNotificationPermission();
    void check();
    timer = setInterval(() => void check(), POLL_MS);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);
}
