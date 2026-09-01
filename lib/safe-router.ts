/**
 * Debounced singleton router — for use in non-hook contexts (lib/ files).
 *
 * The regular `router` from expo-router can be called multiple times on
 * rapid taps / notification taps. This wrapper gates every navigation
 * action behind a short cooldown.
 *
 * Usage:
 *   import { safeRouter } from '@/lib/safe-router';
 *   safeRouter.push('/product/123');
 */

import { router } from 'expo-router';
import type { Href } from 'expo-router';

/** Cooldown in ms between two navigation actions. */
const NAV_COOLDOWN_MS = 500;

let busy = false;

function guard<T>(fn: () => T): T | undefined {
  if (busy) return undefined;
  busy = true;
  const result = fn();
  setTimeout(() => {
    busy = false;
  }, NAV_COOLDOWN_MS);
  return result;
}

export const safeRouter = {
  push: (href: Href) => guard(() => router.push(href)),
  replace: (href: Href) => guard(() => router.replace(href)),
  navigate: (href: Href) => guard(() => router.navigate(href)),
  back: () => guard(() => router.back()),
  canGoBack: () => router.canGoBack(),
};
