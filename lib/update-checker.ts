import * as Updates from 'expo-updates';
import { AppState, Platform } from 'react-native';

import { showToast } from '@/lib/app-toast';

let started = false;
let lastCheckAt = 0;

/**
 * Vérifie en arrière-plan (au lancement + à chaque retour au premier plan) si
 * une mise à jour OTA est disponible sur le canal du build. Si oui, elle est
 * téléchargée silencieusement et s'appliquera au prochain lancement.
 *
 * Un petit toast informe l'utilisateur qu'une mise à jour a bien été reçue :
 * c'est la preuve visible que « modifier sans rebuilder » fonctionne.
 *
 * Throttle : au plus 1 vérification réseau toutes les 2 min (le lancement
 * d'expo-updates fait déjà sa propre vérification automatique au démarrage).
 */
export function startUpdateChecker(): void {
  if (Platform.OS === 'web' || started) return;
  started = true;

  const check = async (): Promise<void> => {
    const now = Date.now();
    if (now - lastCheckAt < 120_000) return;
    lastCheckAt = now;

    try {
      if (!Updates.isEnabled()) return;
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;
      await Updates.fetchUpdateAsync();
      showToast({
        message: 'Mise à jour reçue ✓ elle s\u2019appliquera au prochain lancement.',
        variant: 'info',
        duration: 3200,
      });
    } catch {
      /* non bloquant : jamais bloquant pour l'utilisateur */
    }
  };

  void check();

  AppState.addEventListener('change', (state) => {
    if (state === 'active') void check();
  });
}
