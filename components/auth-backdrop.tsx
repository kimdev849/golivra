import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { rgbaAccent, rgbaBrand } from '@/constants/app-palette';
import type { AppPalette } from '@/constants/app-palette';

/**
 * Fond premium des écrans d'authentification (connexion, inscription,
 * mot de passe oublié) : dégradé subtil + deux halos aux couleurs de la
 * marque (vert GoLivra + jaune "LIVRA") pour donner de la profondeur.
 */
export function AuthBackdrop({ colors }: { colors: AppPalette }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors.backgroundAlt, colors.background]}
        locations={[0, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Halo vert en haut (derive de heroGlow du thème). */}
      <View
        style={[
          styles.blobTop,
          {
            backgroundColor: colors.heroGlow,
            borderColor: colors.primaryMuted,
          },
        ]}
      />

      {/* Halo jaune/orange en bas à droite. */}
      <View style={[styles.blobAccent, { backgroundColor: rgbaAccent(0.1) }]} />

      {/* Petit halo vert en bas à gauche. */}
      <View style={[styles.blobGreen, { backgroundColor: rgbaBrand(0.06) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blobTop: {
    position: 'absolute',
    top: -180,
    alignSelf: 'center',
    width: 460,
    height: 460,
    borderRadius: 230,
    borderWidth: 1,
    opacity: 0.85,
  },
  blobAccent: {
    position: 'absolute',
    right: -90,
    bottom: '34%',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  blobGreen: {
    position: 'absolute',
    left: -70,
    bottom: '12%',
    width: 170,
    height: 170,
    borderRadius: 85,
  },
});
