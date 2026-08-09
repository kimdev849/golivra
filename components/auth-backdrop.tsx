import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { AppPalette } from '@/constants/app-palette';

/**
 * Fond épuré des écrans d'authentification (connexion, inscription,
 * mot de passe oublié) : dégradé subtil + un unique halo statique aux
 * couleurs de la marque. Calme, lisible et léger — sans animation.
 */
export function AuthBackdrop({ colors }: { colors: AppPalette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.backgroundAlt, colors.background]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Halo vert discret en haut. */}
      <View
        style={[
          styles.blobTop,
          {
            backgroundColor: colors.heroGlow,
            borderColor: colors.primaryMuted,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blobTop: {
    position: 'absolute',
    top: -200,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    opacity: 0.45,
  },
});
