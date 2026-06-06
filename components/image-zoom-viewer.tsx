import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { resolveRemoteImageUrl } from '@/lib/images';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type ColorSet = {
  surface: string;
  text: string;
  textMuted: string;
  background: string;
};

type Props = {
  visible: boolean;
  /** Source compatible expo-image (string URL ou objet {uri}). */
  source: string | { uri: string } | null | undefined;
  onClose: () => void;
  /** Couleurs du thème (utilise onClose par défaut). */
  colors?: ColorSet;
  /** Légende optionnelle affichée en bas (utile pour les produits). */
  caption?: string | null;
};

function clamp(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

/**
 * Visionneuse plein écran d'une image avec zoom gestuel.
 * - Pinch (2 doigts) : zoom continu entre 1x et 5x
 * - Double-tap : alterne entre 1x et 2.5x
 * - Pan (1 doigt) : déplacement quand l'image est zoomée
 * - Tap hors zoom ou croix : fermeture
 * Fonctionne sur Android et iOS via react-native-gesture-handler + reanimated.
 */
export function ImageZoomViewer({ visible, source, onClose, caption }: Props) {
  const insets = useSafeAreaInsets();
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetTransform = useCallback(() => {
    scale.value = withTiming(1, { duration: 220 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  useEffect(() => {
    if (visible) resetTransform();
  }, [visible, resetTransform]);

  const onCloseWrapped = useCallback(() => {
    resetTransform();
    onClose();
  }, [onClose, resetTransform]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (savedScale.value <= MIN_SCALE + 0.01) {
        scale.value = withTiming(1, { duration: 200 });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1.01) return;
      const maxX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
      const maxY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
      translateX.value = clamp(savedX.value + e.translationX, -maxX, maxX);
      translateY.value = clamp(savedY.value + e.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        scale.value = withTiming(1, { duration: 220 });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 220 });
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value <= 1.01) {
        runOnJS(onCloseWrapped)();
      }
    });

  const composed = Gesture.Race(doubleTapGesture, singleTapGesture, Gesture.Simultaneous(pinchGesture, panGesture));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const uri = source == null ? null : typeof source === 'string' ? source : source.uri;
  const resolved = resolveRemoteImageUrl(uri);
  if (!resolved && !source) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCloseWrapped}
      statusBarTranslucent>
      <View style={styles.root}>
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.center}>
            <Animated.View style={[styles.imgWrap, animatedStyle]}>
              {resolved ? (
                <Image
                  source={{ uri: resolved }}
                  style={styles.img}
                  contentFit="contain"
                  onLoad={(e) => {
                    const { width, height } = e.source;
                    if (width && height) setImgSize({ w: width, h: height });
                  }}
                />
              ) : (
                <Image source={source as any} style={styles.img} contentFit="contain" />
              )}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.hint}>
            <ThemedCaption text="Pincez pour zoomer · double-tap · glisser" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={onCloseWrapped}
            hitSlop={12}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
            <X size={26} color="#FFF" strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        {caption ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <ThemedCaption text={caption} />
          </View>
        ) : null}

        {imgSize ? null : null}
      </View>
    </Modal>
  );
}

function ThemedCaption({ text }: { text: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
      }}>
      <Animated.Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  hint: { opacity: 0.85 },
  close: { padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
