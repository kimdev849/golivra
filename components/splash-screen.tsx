import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { paletteForScheme } from '@/constants/app-palette';

const THEME_KEY = 'golivra_theme_preference_v1';

type Props = {
  onAnimationComplete: () => void;
};

export function CustomSplashScreen({ onAnimationComplete }: Props) {
  const systemScheme = useColorScheme();
  const [storedPref, setStoredPref] = useState<'system' | 'light' | 'dark' | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Lit la préférence de thème AVANT l'hydratation du contexte, pour choisir le
  // bon fond dès la première frame (évite le « logo dans un cadre blanc »
  // quand l'app est en mode sombre mais que le téléphone est en mode clair).
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (alive && (v === 'dark' || v === 'light' || v === 'system')) setStoredPref(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pref = storedPref ?? 'system';
  const isDark = pref === 'dark' || (pref === 'system' && systemScheme === 'dark');
  const bg = paletteForScheme(isDark ? 'dark' : 'light').background;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const enter = Animated.timing(opacity, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    });

    enter.start(() => {
      // Respiration douce du logo, façon « chargement ».
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();

      timer = setTimeout(() => {
        loop?.stop();
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.9,
            duration: 380,
            useNativeDriver: true,
          }),
        ]).start(onAnimationComplete);
      }, 1600);
    });

    return () => {
      if (timer) clearTimeout(timer);
      loop?.stop();
      enter.stop();
    };
  }, [onAnimationComplete, opacity, pulse]);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Animated.View style={{ opacity, transform: [{ scale: pulse }] }}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 120,
    height: 120,
  },
});
