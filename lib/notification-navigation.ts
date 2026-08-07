import type { Router } from 'expo-router';

import type { AppNotification } from '@/lib/notifications-api';
import { hrefCourierMission } from '@/lib/courier-nav';
import { VENDOR_HREF } from '@/lib/vendor-nav';

function actionFromData(data: AppNotification['data']): string | null {
  if (!data || typeof data !== 'object') return null;
  const action = (data as { action?: unknown }).action;
  return typeof action === 'string' ? action : null;
}

function livraisonIdFromData(data: AppNotification['data']): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as { livraison_id?: unknown }).livraison_id;
  return typeof id === 'string' ? id : null;
}

/** Navigation après ouverture d'une notification in-app. */
export function navigateFromNotification(router: Router, n: AppNotification): void {
  const action = actionFromData(n.data);

  if (action === 'open_delivery') {
    const livId = livraisonIdFromData(n.data);
    if (livId) {
      router.push(hrefCourierMission(livId));
      return;
    }
    router.push('/courier/missions');
    return;
  }

  if (action === 'courier_missions') {
    router.push('/courier/missions');
    return;
  }

  if (action === 'vendor_orders') {
    router.push(VENDOR_HREF.ordersTab);
    return;
  }

  if (action === 'open_orders' || n.type.includes('commande') || n.type.includes('paiement')) {
    router.navigate('/(tabs)/explore');
    return;
  }

  if (n.type.includes('livraison')) {
    router.navigate('/(tabs)/explore');
  }
}
