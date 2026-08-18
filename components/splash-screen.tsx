import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import {
  GOLIVRA_GREEN_SPLASH,
  GOLIVRA_GREEN_SPLASH_DEEP,
  GOLIVRA_YELLOW,
} from '@/constants/app-palette';
import { bootstrapSettled } from '@/lib/app-bootstrap';

const SLOGAN = 'On vous apporte ce dont vous avez besoin ..';

type Props = {
  onAnimationComplete: () => void;
};

/**
 * Écran de démarrage — design inspiré de `demarage.png` :
 *   - Fond dégradé vert profond quasi-noir (harmonisé avec le logo sombre)
 *   - Logo centré avec animation d'entrée ressort (léger rebond) + halo radial doux
 *   - Petit slogan en blanc qui apparaît juste après le logo
 *   - Indicateur de chargement élégant (3 points dorés) en bas
 *   - Identique en mode clair / sombre
 *   - Animation courte pour un démarrage ultra-rapide (tout sur le thread natif)
 */
export function CustomSplashScreen({ onAnimationComplete }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const sloganTranslate = useRef(new Animated.Value(10)).current;

  // Cache le splash NATIF dès que le PREMIER FRAME JS est réellement peint.
  // Un délai d'un frame (~50 ms) évite le flash blanc quand l'activité Android
  // libère le splash natif avant que le rendu JS (fond vert) ne soit affiché.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        SplashScreen.hideAsync().catch(() => {});
      } catch {
        /* non bloquant */
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Filet de sécurité : si l'animation est interrompue pour une raison
  // quelconque, l'app ne reste JAMAIS bloquée sur le splash.
  useEffect(() => {
    const safety = setTimeout(onAnimationComplete, 4000);
    return () => clearTimeout(safety);
  }, [onAnimationComplete]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // Entrée douce du logo : échelle 0.92 → 1 (léger ressort, presque invisible
    // car le splash natif affichait déjà le logo à ~pleine taille). Une entrée
    // 0.7 avec rotation marquée donnait l'impression d'un SECOND écran animé.
    const entrance = Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    });

    // Légère rotation de stabilisation (de -3° à 0°) pour un arrivage vivant.
    const settle = Animated.timing(rotate, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      entrance,
      settle,
      // Halo doré derrière le logo, qui monte en douceur.
      Animated.timing(glowOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      // Slogan juste après le logo.
      Animated.parallel([
        Animated.timing(sloganOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(sloganTranslate, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        // Le fade-out FINAL attend la fin du bootstrap (max ~2 s) : l'app est
        // déjà prête derrière, donc la transition splash → app devient invisible.
        // Sans cela, un bootstrap plus lent que l'animation révélait un écran
        // noir/blanc intermédiaire — la fameuse « 3e transition » moche.
        const hold = Promise.race([
          bootstrapSettled,
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
        void hold.then(() => {
          if (disposed) return;
          timer = setTimeout(() => {
            if (disposed) return;
            Animated.parallel([
              Animated.timing(opacity, { toValue: 0, duration: 190, easing: Easing.in(Easing.ease), useNativeDriver: true }),
              Animated.timing(glowOpacity, { toValue: 0, duration: 190, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ]).start(onAnimationComplete);
          }, 220);
        });
      });
    });

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      opacity.stopAnimation();
      scale.stopAnimation();
      rotate.stopAnimation();
      glowOpacity.stopAnimation();
      sloganOpacity.stopAnimation();
      sloganTranslate.stopAnimation();
    };
  }, [onAnimationComplete, opacity, scale, rotate, glowOpacity, sloganOpacity, sloganTranslate]);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Fond vert profond — même famille que le logo (sombre, pas de vert vif) */}
      <LinearGradient
        colors={[GOLIVRA_GREEN_SPLASH, GOLIVRA_GREEN_SPLASH_DEEP]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.content, { opacity }]}>
        {/* Halo doré derrière le logo : vrai dégradé radial qui s'estompe
            progressivement (aucun bord dur) — réglé via les stops du SVG. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowWrap,
            {
              opacity: glowOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
              transform: [
                {
                  scale: glowOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                },
              ],
            },
          ]}>
          <Svg width={360} height={360} style={styles.glow}>
            <Defs>
              <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={GOLIVRA_YELLOW} stopOpacity={0.5} />
                <Stop offset="45%" stopColor={GOLIVRA_YELLOW} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={GOLIVRA_YELLOW} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="180" cy="180" r="180" fill="url(#glowGrad)" />
          </Svg>
        </Animated.View>

        {/* Logo : entrée ressort + stabilisation */}
        <Animated.View style={{ transform: [{ scale }, { rotate: rotation }] }}>
          <Image
            source={require('@/assets/images/app.icon.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </Animated.View>

        {/* Slogan qui apparaît juste après le logo */}
        <Animated.View
          style={{
            opacity: sloganOpacity,
            transform: [{ translateY: sloganTranslate }],
          }}>
          <Text style={styles.slogan}>{SLOGAN}</Text>
        </Animated.View>
      </Animated.View>

      {/* Loader tout en bas, avec padding pour la barre de navigation système */}
      <View
        style={[
          styles.loaderWrap,
          { paddingBottom: Math.max(insets.bottom, 24) + 8 },
        ]}
        pointerEvents="none">
        <SplashDots />
      </View>
    </View>
  );
}

/**
 * Indicateur de chargement : 3 points dorés qui pulsent en cascade.
 * Plus élégant que le spinner système par défaut, dans la couleur du logo.
 */
function SplashDots() {
  const dots = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    const loops = dots.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.dotsRow}>
      {dots.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  glowWrap: {
    position: 'absolute',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 360,
    height: 360,
  },
  logo: {
    width: 110,
    height: 110,
  },
  slogan: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.85,
    letterSpacing: 0.3,
    paddingHorizontal: 40,
  },
  loaderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: GOLIVRA_YELLOW,
  },
});
