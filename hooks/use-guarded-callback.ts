/**
 * Hook qui protège n'importe quel callback contre les appels multiples
 * (double-tap, double-ripple, envoi en rafale).
 *
 * Usage :
 *   const guarded = useGuardedCallback();
 *   <Pressable onPress={() => guarded(() => void submitOrder())}>
 *     Commander
 *   </Pressable>
 *
 * Le callback peut être synchrone ou async — le flag reste actif pendant
 * `delayMs` ms après l'appel (ou jusqu'à la résolution si async).
 */

import { useCallback, useRef } from 'react';

export function useGuardedCallback(delayMs = 600) {
  const busy = useRef(false);

  return useCallback(
    <T>(fn: () => T): void => {
      if (busy.current) return;
      busy.current = true;

      try {
        const result = fn();
        // Si c'est une Promise, on attend sa résolution avant de libérer.
        const maybePromise = result as { then?: (cb: () => void) => unknown } | undefined;
        if (maybePromise && typeof maybePromise.then === 'function') {
          (maybePromise as unknown as Promise<T>).finally(() => {
            setTimeout(() => {
              busy.current = false;
            }, delayMs);
          });
          return;
        }
      } catch {
        // Erreur synchrone : on libère quand même après le cooldown.
      }

      setTimeout(() => {
        busy.current = false;
      }, delayMs);
    },
    [delayMs],
  );
}
