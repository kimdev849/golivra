import { Image, type ImageProps, type ImageSource } from 'expo-image';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { ImageZoomViewer } from '@/components/image-zoom-viewer';

type Props = Omit<ImageProps, 'source'> & {
  source: any;
  style?: StyleProp<ViewStyle>;
  /** Légende affichée dans le viewer plein écran. */
  caption?: string | null;
  /** Désactive le tap (utile pour les images purement décoratives). */
  disabled?: boolean;
  /** Callback appelé avant l'ouverture du viewer. */
  onPress?: (e: GestureResponderEvent) => void;
};

/**
 * Drop-in replacement de `<Image source={...} />` qui ouvre une visionneuse
 * plein écran zoomable au tap. Pinch, double-tap, pan et fermeture gérés.
 *
 * - Conserve la performance et le cache d'expo-image
 * - N'ouvre pas le viewer si la source est vide / placeholder
 * - Le zoom s'effectue dans une `Modal` plein écran pour éviter les conflits
 *   avec les gestes des listes parentes
 *
 * ⚠️ Le style (dimensions, borderRadius…) s'applique au CONTENEUR externe :
 *    c'est lui qui donne sa taille au Pressable et à l'Image (100 %). Appliquer
 *    un style en pourcentage directement à l'Image sans conteneur dimensionné
 *    crée une boucle de mesure → l'image est rendue invisible (vignettes vides).
 */
export function ZoomableImage({ source, style, caption, disabled, onPress, ...rest }: Props) {
  const [open, setOpen] = useState(false);

  const onPressWrapped = useCallback(
    (e: GestureResponderEvent) => {
      onPress?.(e);
      if (!disabled) setOpen(true);
    },
    [onPress, disabled],
  );

  const hasSource = source != null && source !== '';

  return (
    <View style={[style, styles.container]}>
      <Pressable
        onPress={hasSource && !disabled ? onPressWrapped : undefined}
        accessibilityRole={hasSource && !disabled ? 'imagebutton' : undefined}
        accessibilityLabel={hasSource && !disabled ? 'Agrandir l’image' : undefined}
        disabled={!hasSource || disabled}
        style={styles.touch}>
        <Image source={source as ImageSource} style={styles.fill} {...rest} />
      </Pressable>
      <ImageZoomViewer
        visible={open}
        source={source as any}
        onClose={() => setOpen(false)}
        caption={caption ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Rogue l'image aux coins arrondis du conteneur (borderRadius du style). */
  container: { overflow: 'hidden' },
  touch: { width: '100%', height: '100%' },
  fill: { width: '100%', height: '100%' },
});
