import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getBiometricLockEnabled,
  promptBiometricUnlock,
} from '@/lib/biometric-lock';
import { markOnboardingComplete, resolveBootstrapTarget } from '@/lib/app-bootstrap';

const SLOGAN = 'On vous apporte ce dont vous avez besoin ..';
/** Orange marque GoLivra (utilisé dans le logo, le t-shirt et la casquette). */
const GOLIVRA_ORANGE = '#F58A07';

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
          const bio = await getBiometricLockEnabled();
          if (bio) {
            const ok = await promptBiometricUnlock('Déverrouiller GoLivra');
            if (!ok) {
              router.replace('/auth');
              return;
            }
          }
          router.replace(target.href);
          return;
        }

        if (target.kind === 'auth') {
          router.replace('/auth');
          return;
        }

        setIsCheckingFirstLaunch(false);
      } catch {
        if (isMounted) setIsCheckingFirstLaunch(false);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (isCheckingFirstLaunch) {
    return <ThemedView style={styles.container} />;
  }

  const buttonWidth = Math.min(width - 32, 480);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Photo plein écran */}
      <Image
        source={require('@/assets/images/home2.png')}
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
      <View
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
      </View>

      {/* Bloc bas : slogan + bouton + lien inscription */}
      <View
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
          <ThemedText style={styles.ctaText}>Connexion</ThemedText>
        </Pressable>

        <Link href="/signup/choose" asChild>
          <Pressable
            onPress={() => {
              void markOnboardingComplete();
            }}
            style={styles.signupRow}
            hitSlop={8}>
            <ThemedText style={styles.signupText}>
              Pas encore de compte ?{' '}
              <ThemedText style={styles.signupLink}>{"S'inscrire"}</ThemedText>
            </ThemedText>
          </Pressable>
        </Link>
      </View>
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
    fontSize: 22,
    lineHeight: 30,
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signupRow: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  signupText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
  },
  signupLink: {
    color: '#FFFFFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
