import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { rgbaAccent, rgbaBrand } from '@/constants/app-palette';
import type { AppPalette } from '@/constants/app-palette';

/**
 * Fond premium des écrans d'authentification (connexion, inscription,
 * mot de passe oublié) : dégradé subtil + deux halos aux couleurs de la
 * marque (vert GoLivra + jaune "LIVRA") qui dérivent lentement pour donner
 * un fond vivant pendant la saisie — jamais statique, jamais agressif.
 */
export function AuthBackdrop({ colors }: { colors: AppPalette }) {
  // Dérive lente des halos (boucle aller-retour, style nébuleuse).
  const driftY = useRef(new Animated.Value(0)).current;
  const driftX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const y = Animated.loop(
      Animated.sequence([
        Animated.timing(driftY, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driftY, {
          toValue: 0,
          duration: 6000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const x = Animated.loop(
      Animated.sequence([
        Animated.timing(driftX, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driftX, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    y.start();
    x.start();
    return () => {
      y.stop();
      x.stop();
    };
  }, [driftY, driftX]);

  const accentTy = driftY.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const accentTx = driftX.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  const greenTy = driftY.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });

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

      {/* Halo jaune/orange en bas à droite — dérive lente. */}
      <Animated.View
        style={[
          styles.blobAccent,
          {
            backgroundColor: rgbaAccent(0.1),
            transform: [{ translateY: accentTy }, { translateX: accentTx }],
          },
        ]}
      />

      {/* Petit halo vert en bas à gauche — dérive lente. */}
      <Animated.View
        style={[
          styles.blobGreen,
          {
            backgroundColor: rgbaBrand(0.06),
            transform: [{ translateY: greenTy }],
          },
        ]}
      />
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
