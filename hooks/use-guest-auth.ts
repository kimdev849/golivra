import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { getSessionToken } from '@/lib/auth';

/**
 * Hook pour gérer le mode invité.
 *
 * Utilise-le sur chaque écran qui nécessite une authentification :
 * - Favoris (ajouter/retirer)
 * - Profil
 * - Commandes
 * - Checkout
 *
 * Utilisation :
 * ```tsx
 * const { requireAuth } = useGuestAuth();
 *
 * // Avant une action protégée :
 * const handleAddFav = async () => {
 *   const ok = await requireAuth();
 *   if (!ok) return;
 *   // ... action protégée
 * };
 * ```
 */
export function useGuestAuth() {
  const router = useRouter();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  /**
   * Vérifie si l'utilisateur est connecté.
   * Si non, affiche le bottom sheet de connexion et retourne false.
   * Si oui, retourne true.
   */
  const requireAuth = useCallback(
    (action?: () => void): Promise<boolean> => {
      return new Promise(async (resolve) => {
        const token = await getSessionToken();
        if (token) {
          resolve(true);
          return;
        }
        // Pas de token → afficher le sheet
        if (action) {
          setPendingAction(() => action);
        }
        setShowLoginSheet(true);
        resolve(false);
      });
    },
    [],
  );

  const goToAuth = useCallback(() => {
    setShowLoginSheet(false);
    setPendingAction(null);
    router.push('/auth');
  }, [router]);

  const goToSignup = useCallback(() => {
    setShowLoginSheet(false);
    setPendingAction(null);
    router.push('/signup');
  }, [router]);

  const dismissSheet = useCallback(() => {
    setShowLoginSheet(false);
    setPendingAction(null);
  }, []);

  return {
    requireAuth,
    showLoginSheet,
    goToAuth,
    goToSignup,
    dismissSheet,
    pendingAction,
  };
}
