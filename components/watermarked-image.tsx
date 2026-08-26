import { Image, type ImageProps } from 'expo-image';
import { View, StyleSheet } from 'react-native';

import { GOLIVRA_GREEN } from '@/constants/app-palette';

type Props = Omit<ImageProps, 'style'> & {
  style?: ImageProps['style'];
  /** Afficher le watermark. Par défaut true. */
  showWatermark?: boolean;
};

/**
 * Image avec watermark GoLivra discret (coin bas-droite, opacité faible).
 * Utilisé pour toutes les photos de produits/plats du marketplace.
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
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  watermark: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.35,
  },
  watermarkBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  watermarkLogo: {
    width: 16,
    height: 12,
    tintColor: GOLIVRA_GREEN,
  },
});
