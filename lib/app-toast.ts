import { create } from 'zustand';

/**
 * Toast / Snackbar global, NON-BLOQUANT.
 *
 * Contrairement à `ActionFeedbackOverlay` (Modal plein écran qui interrompt
 * le flux), ce toast s'affiche 1.6s en bas de l'écran puis disparaît tout
 * seul, sans exiger aucune action. Idéal pour les feedbacks d'ajout au
 * panier (standard Uber Eats / Glovo).
 *
 * Usage :
 *   import { showToast } from '@/lib/app-toast';
 *   showToast({ message: 'Ajouté au panier', action: { label: 'Voir', onPress: () => {} } });
 */

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastConfig = {
  message: string;
  variant?: ToastVariant;
  /** Bouton optionnel (ex. "Voir le panier"). Ne force jamais le clic. */
  action?: ToastAction;
  /** Durée d'affichage en ms. Défaut 1800. */
  duration?: number;
};

type ToastState = ToastConfig & {
  visible: boolean;
  /** Identifiant incrémental pour forcer le re-montage (et rejouer l'anim). */
  token: number;
  show: (config: ToastConfig) => void;
  hide: () => void;
};

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  token: 0,
  message: '',
  variant: 'success',
  show: (config) => {
    seq += 1;
    set({ ...config, visible: true, token: seq });
  },
  hide: () => set((s) => ({ ...s, visible: false })),
}));

/**
 * Affiche un toast non-bloquant. API simple (hors composant).
 * Sécuritaire : n'oublie pas d'effacer le timeout si un nouveau toast arrive.
 */
export function showToast(config: ToastConfig): void {
  useToastStore.getState().show(config);
}
