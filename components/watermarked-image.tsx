import { Image, type ImageProps } from 'expo-image';
import { View, StyleSheet, Text } from 'react-native';

/**
 * Tiny GoLivra wordmark rendered as a text badge (always visible, no asset loading).
 */
function GoLivraBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const isLg = size === 'lg';
  return (
    <View style={[styles.watermarkBg, isLg && styles.watermarkBgLg]}>
      <Text style={[styles.watermarkTxt, isLg && styles.watermarkTxtLg]}>
        GoLivra
      </Text>
    </View>
  );
}

type Props = Omit<ImageProps, 'style'> & {
  style?: ImageProps['style'];
  /** Afficher le watermark. Par défaut true. */
  showWatermark?: boolean;
};

/**
 * Image avec watermark GoLivra (coin bas-droite).
 * Badge semi-transparent avec texte "GoLivra" en italique.
 */
export function WatermarkedImage({ showWatermark = true, style, ...rest }: Props) {
  return (
    <View style={[styles.container, (style as any)?.height || (style as any)?.aspectRatio ? {} : { minHeight: 120 }]}>
      <Image contentFit="cover" transition={200} {...rest} style={[styles.image, style]} />
      {showWatermark ? (
        <View style={styles.watermark}>
          <GoLivraBadge />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: '100%',
  },
  watermark: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    zIndex: 10,
  },
  watermarkBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  watermarkBgLg: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  watermarkTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.4,
  },
  watermarkTxtLg: {
    fontSize: 13,
    fontWeight: '900',
  },
});
