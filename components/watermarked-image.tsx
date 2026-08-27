import { Image, type ImageProps } from 'expo-image';
import { View, StyleSheet } from 'react-native';

type Props = Omit<ImageProps, 'style'> & {
  style?: ImageProps['style'];
  /** Afficher le watermark. Par défaut true. */
  showWatermark?: boolean;
};

/**
 * Image avec watermark GoLivra (coin bas-droite).
 * Bande semi-transparente avec texte "GoLivra" en italique.
 */
export function WatermarkedImage({ showWatermark = true, style, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Image contentFit="cover" transition={200} {...rest} style={[styles.image, style]} />
      {showWatermark ? (
        <View style={styles.watermark}>
          <View style={styles.watermarkBg}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.watermarkLogo}
              contentFit="contain"
              transition={0}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    // No fixed height — let the Image determine its own size.
    // The parent View should provide height constraints (aspectRatio, fixed height, etc.)
  },
  image: {
    width: '100%',
    // height is NOT forced here — it comes from the parent style prop
    // (e.g. aspectRatio: 4/3 for product cards, fixed height for hero)
  },
  watermark: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  watermarkBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  watermarkLogo: {
    width: 22,
    height: 22,
  },
});
