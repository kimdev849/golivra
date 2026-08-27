import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Hook qui empêche les navigations multiples (double-tap, double-ripple).
 * Utiliser `safePush` au lieu de `router.push` partout dans l'app.
 *
 * Exemple :
 *   const { safePush } = useSafeNavigation();
 *   <Pressable onPress={() => safePush('/product/123')}>
 */
export function useSafeNavigation(delayMs = 600) {
  const router = useRouter();
  const busy = useRef(false);

  const safePush = useCallback(
    (href: string) => {
      if (busy.current) return;
      busy.current = true;
      router.push(href as never);
      setTimeout(() => {
        busy.current = false;
      }, delayMs);
    },
    [router, delayMs],
  );

  const safeReplace = useCallback(
    (href: string) => {
      if (busy.current) return;
      busy.current = true;
      router.replace(href as never);
      setTimeout(() => {
        busy.current = false;
      }, delayMs);
    },
    [router, delayMs],
  );

  const safeBack = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    router.back();
    setTimeout(() => {
      busy.current = false;
    }, delayMs);
  }, [router, delayMs]);

  return { safePush, safeReplace, safeBack, router };
}
