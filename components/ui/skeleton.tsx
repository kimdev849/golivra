import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { useAppColors } from '@/hooks/use-app-colors';
import { useAppTheme } from '@/contexts/app-theme-context';

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Pilote d'animation PARTAGÉ par tous les squelettes : une seule boucle
 * d'animation fait défiler la bande de reflet sur TOUTE la page de façon
 * synchronisée — l'effet « l'interface est sur le point d'apparaître »
 * des apps premium (Instagram, Airbnb…).
 */
const sweepDriver = new Animated.Value(0);
let mountedSkeletons = 0;
let sweepLoop: Animated.CompositeAnimation | null = null;

/** Démarre la boucle partagée dès qu'au moins un squelette est monté. */
function ensureSweepRunning() {
  if (sweepLoop) return;
  sweepLoop = Animated.loop(
    Animated.timing(sweepDriver, {
      toValue: 1,
      duration: 1350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }),
  );
  sweepLoop.start();
}

/** Arrête la boucle quand aucun squelette n'est plus à l'écran. */
function releaseSweepIfIdle() {
  if (mountedSkeletons === 0 && sweepLoop) {
    sweepLoop.stop();
    sweepLoop = null;
    sweepDriver.setValue(0);
  }
}

export function Skeleton({ width, height, borderRadius = 8, style }: Props) {
  const colors = useAppColors();
  const { isDark } = useAppTheme();
  const { width: winWidth } = useWindowDimensions();

  // La boucle partagée tourne seulement quand des squelettes sont montés.
  useEffect(() => {
    mountedSkeletons += 1;
    ensureSweepRunning();
    return () => {
      mountedSkeletons -= 1;
      releaseSweepIfIdle();
    };
  }, []);

  // La bande part hors écran à gauche et traverse l'élément vers la droite.
  const bandTranslate = sweepDriver.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, Math.max(winWidth + 240, 420)],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}>
      {/* Bande de reflet qui balaie le bloc */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.band,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)',
            transform: [{ translateX: bandTranslate }, { rotate: '16deg' }],
          },
        ]}
      />
    </Animated.View>
  );
}

/**
 * Squelette de l'accueil : fidèle à la mise en page réelle (bannière,
 * rangée de commerces, titre de section, grille de produits 2 colonnes)
 * pour donner l'impression que le contenu est sur le point d'apparaître,
 * au lieu d'un simple indicateur centré.
 */
export function HomeFeedSkeleton() {
  return (
    <View style={styles.feed}>
      {/* Bannière / campagne */}
      <Skeleton width="100%" height={104} borderRadius={18} />

      {/* Section « À découvrir » */}
      <View style={styles.feedTitleRow}>
        <Skeleton width={120} height={18} borderRadius={6} />
      </View>
      <View style={styles.feedEntRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.feedEnt}>
            <Skeleton width={120} height={88} borderRadius={16} />
            <Skeleton width={92} height={12} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>

      {/* Section « Recommandés pour vous » */}
      <View style={styles.feedTitleRow}>
        <Skeleton width={200} height={18} borderRadius={6} />
      </View>

      {/* Grille de produits 2 colonnes */}
      <View style={styles.feedGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.feedCard}>
            <Skeleton width="100%" height={148} borderRadius={16} />
            <Skeleton width="72%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width="46%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function ListingSkeleton() {
  return (
    <View style={styles.listing}>
      <Skeleton width="100%" height={160} borderRadius={16} />
      <View style={styles.listingContent}>
        <Skeleton width="70%" height={20} />
        <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
        <View style={styles.listingFooter}>
          <Skeleton width="30%" height={24} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  // Bande de reflet : plus haute que le bloc pour rester visible après rotation.
  band: {
    position: 'absolute',
    top: '-140%',
    left: -140,
    width: 120,
    height: '380%',
    borderRadius: 999,
    opacity: 0.9,
  },
  listing: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listingContent: {
    padding: 12,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  feed: {
    gap: 6,
    paddingVertical: 4,
  },
  feedTitleRow: {
    paddingVertical: 8,
  },
  feedEntRow: {
    flexDirection: 'row',
    gap: 10,
  },
  feedEnt: {
    width: 120,
  },
  feedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  feedCard: {
    width: '48.5%',
    marginBottom: 12,
  },
});
