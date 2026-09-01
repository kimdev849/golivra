import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

// ── Web : navigator.onLine est plus fiable que NetInfo ──────────────
// NetInfo sur le web retourne souvent isInternetReachable = null ou
// false alors que la connexion est bonne → faux positifs "hors ligne".
// navigator.onLine du navigateur est simple et fiable.
const IS_WEB = Platform.OS === 'web';

let latest: NetworkStatus = { isConnected: true, isInternetReachable: true };
const listeners = new Set<(status: NetworkStatus) => void>();

function applyState(state: NetInfoState): void {
  const next: NetworkStatus = {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable,
  };
  latest = next;
  listeners.forEach((fn) => fn(next));
}

// Sur web : utilise navigator.onLine au lieu de NetInfo.
function applyWebState(): void {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const next: NetworkStatus = { isConnected: online, isInternetReachable: online };
  latest = next;
  listeners.forEach((fn) => fn(next));
}

let subscribed = false;

function ensureSubscription(): void {
  if (subscribed) return;
  subscribed = true;

  if (IS_WEB) {
    // Init avec navigator.onLine.
    applyWebState();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', applyWebState);
      window.addEventListener('offline', applyWebState);
    }
    return;
  }

  // Natif : NetInfo fiable.
  void NetInfo.fetch().then(applyState);
  NetInfo.addEventListener(applyState);
}

export function getNetworkStatus(): NetworkStatus {
  ensureSubscription();
  return latest;
}

export function isOffline(): boolean {
  const s = getNetworkStatus();
  if (!s.isConnected) return true;
  if (s.isInternetReachable === false) return true;
  return false;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => getNetworkStatus());

  useEffect(() => {
    ensureSubscription();
    setStatus(getNetworkStatus());
    listeners.add(setStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  return status;
}

export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  if (!isConnected) return true;
  if (isInternetReachable === false) return true;
  return false;
}
