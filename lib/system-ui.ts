import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';

/**
 * Synchronise la barre de navigation système Android avec le thème de l'app.
 *
 * L'app tourne en edge-to-edge : le contenu passe derrière les barres système
 * (gérées via les insets) et la barre de navigation devient transparente pour
 * se fondre dans le fond de l'app — plus de « bande blanche » en bas en mode
 * sombre, ni d'écran « coupé » en haut/bas.
 */
export async function syncSystemBars(isDark: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await NavigationBar.setBackgroundColorAsync('#00000000');
    await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
  } catch {
    /* non bloquant : l'app reste utilisable même si la barre n'est pas stylée */
  }
}
