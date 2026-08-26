import { Image, type ImageProps } from 'expo-image';
import { View, StyleSheet, Text } from 'react-native';

import { GOLIVRA_GREEN } from '@/constants/app-palette';

type Props = Omit<ImageProps, 'style'> & {
  style?: ImageProps['style'];
  /** Afficher le watermark. Par défaut true. */
  showWatermark?: boolean;
};

/**
 * Image avec watermark GoLivra discret (coin bas-droite).
 * Utilisé pour toutes les photos de produits/plats du marketplace.
 *
 * Le watermark est un texte "GoLivra" en semi-transparent,
 * facilement lisible mais non intrusif.
 */
export function WatermarkedImage({ showWatermark = true, style, ...rest }: Props) {
  return (
    <View style={styles.container}>
      <Image contentFit="cover" transition={200} {...rest} style={[styles.image, style]} />
      {showWatermark ? (
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>GoLivra</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  watermarkText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
});
