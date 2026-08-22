import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { GOLIVRA_GREEN_SPLASH } from '@/constants/app-palette';
import {
  markOnboardingComplete,
  resolveBootstrapTarget,
  signalBootstrapSettled,
} from '@/lib/app-bootstrap';

const SLOGAN = 'On vous apporte ce dont vous avez besoin ..';
/** Orange marque GoLivra (utilisé dans le logo, le t-shirt et la casquette). */
const GOLIVRA_ORANGE = '#F58A07';

// Animations d'entrée du landing.
const TOP_ENTER = FadeInDown.duration(500);
const BOTTOM_ENTER = FadeInUp.duration(550).delay(120);

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isCheckingFirstLaunch, setIsCheckingFirstLaunch] = useState(true);

  const goToAuth = async () => {
    await markOnboardingComplete();
    router.replace('/auth');
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const target = await resolveBootstrapTarget();
        if (!isMounted) return;

        if (target.kind === 'home') {
          // Le déverrouillage biométrique est géré UNIQUEMENT par
          // BiometricAppGate (démarrage + retour au premier plan). Ici, aucun
          // prompt : demander aussi ici doublait la demande à chaque ouverture.
          router.replace(target.href);
          signalBootstrapSettled();
          return;
        }

        if (target.kind === 'auth') {
          router.replace('/auth');
          signalBootstrapSettled();
          return;
        }

        setIsCheckingFirstLaunch(false);
        signalBootstrapSettled();
      } catch {
        if (isMounted) setIsCheckingFirstLaunch(false);
        signalBootstrapSettled();
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isCheckingFirstLaunch) {
    // Fond identique au splash (vert profond) : la disparition du splash JS se
    // fond dans l'écran de bootstrap → plus d'écran noir/blanc entre les deux.
    return (
      <View style={[styles.container, { backgroundColor: GOLIVRA_GREEN_SPLASH }]} />
    );
  }

  const buttonWidth = Math.min(width - 32, 480);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Photo plein écran */}
      <Image
        source={require('@/assets/images/home2.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        transition={450}
      />

      {/* Voile sombre en bas pour rendre le texte lisible */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.65)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Petit logo en haut, transparent pour rester lisible */}
      <Animated.View
        entering={TOP_ENTER}
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 12) + 6 },
        ]}
        pointerEvents="none">
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.topLogo}
          contentFit="contain"
          tintColor="#FFFFFF"
        />
      </Animated.View>

      {/* Bloc bas : slogan + bouton Connexion */}
      <Animated.View
        entering={BOTTOM_ENTER}
        style={[
          styles.bottomBlock,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            paddingHorizontal: 16,
          },
        ]}>
        <ThemedText style={styles.slogan}>{SLOGAN}</ThemedText>

        <Pressable
          onPress={goToAuth}
          android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: GOLIVRA_ORANGE, width: buttonWidth, opacity: pressed ? 0.92 : 1 },
          ]}>
          <ThemedText style={styles.ctaText}>Se connecter</ThemedText>
        </Pressable>

        <View style={styles.betaBadge}>
          <FlaskConical size={13} color="rgba(255,255,255,0.92)" strokeWidth={2.4} />
          <ThemedText style={styles.betaText}>GoLivra · Version bêta</ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  topLogo: {
    width: 140,
    height: 48,
    opacity: 0.92,
  },
  bottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 18,
  },
  slogan: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    paddingHorizontal: 8,
  },
  cta: {
    minHeight: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 22px rgba(245, 138, 7, 0.42)',
    elevation: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  betaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.9,
  },
  betaText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
