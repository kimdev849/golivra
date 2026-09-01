/**
 * Drop-in replacement for `useRouter` from expo-router.
 *
 * Adds debounce protection so that rapid double-taps / multiple presses
 * don't push the same screen twice (which causes the back button to
 * require multiple presses to return).
 *
 * Usage — identical to expo-router:
 *   import { useRouter } from '@/hooks/use-safe-router';
 *   const router = useRouter();
 *   router.push('/product/123');
 */

import { useRouter as useExpoRouter, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Cooldown in ms between two navigation actions. */
const NAV_COOLDOWN_MS = 500;

/**
 * Wraps every navigation method with a cooldown guard so rapid successive
 * calls (double-tap, double-ripple, accidental repeat) are silently dropped.
 */
export function useRouter() {
  const router = useExpoRouter();
  const busy = useRef(false);

  const guard = useCallback(
    (fn: () => void) => {
      if (busy.current) return;
      busy.current = true;
      fn();
      setTimeout(() => {
        busy.current = false;
      }, NAV_COOLDOWN_MS);
    },
    [],
  );

  const push = useCallback(
    (href: Href) => guard(() => router.push(href)),
    [router, guard],
  );

  const replace = useCallback(
    (href: Href) => guard(() => router.replace(href)),
    [router, guard],
  );

  const navigate = useCallback(
    (href: Href) => guard(() => router.navigate(href)),
    [router, guard],
  );

  const back = useCallback(
    () => guard(() => router.back()),
    [router, guard],
  );

  const canGoBack = useCallback(() => router.canGoBack(), [router]);

  // Expose the original router for properties we don't override
  return {
    ...router,
    push,
    replace,
    navigate,
    back,
    canGoBack,
  };
}
