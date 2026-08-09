import { Image } from 'expo-image';
import { ImageIcon, Maximize2, Minus, Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LUCIDE_STROKE } from '@/constants/icons';
import { useWebImageGestures } from '@/hooks/use-web-image-gestures';
import { resolveZoomImageUrl } from '@/lib/images';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(v: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(v, min), max);
}

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
  /** Couleurs du thème (inutilisé mais gardé pour compat API). */
  colors?: ColorSet;
  /** Légende optionnelle affichée en bas (utile pour les produits). */
  caption?: string | null;
};

/**
 * Visionneuse plein écran d'une image unique avec zoom gestuel.
 *
 * - Pinch (2 doigts) : zoom continu entre 1x et 5x
 * - Double-tap : alterne entre 1x et 2.5x (centré sur le tap)
 * - Pan (1 doigt) : déplacement quand l'image est zoomée
 * - Swipe vertical vers le bas (hors zoom) : fermeture
 * - Tap (hors zoom) ou croix : fermeture
 */
export function ImageZoomViewer({ visible, source, onClose, caption }: Props) {
  const insets = useSafeAreaInsets();
  const zoomRef = useRef<Animated.View>(null);
  const isWeb = Platform.OS === 'web';

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // opacité qui suit le swipe de fermeture pour un effet "tirer vers le bas"
  const dismissOpacity = useSharedValue(1);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const resetTransform = useCallback(() => {
    scale.value = withTiming(1, { duration: 200 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    savedX.value = 0;
    savedY.value = 0;
    dismissOpacity.value = withTiming(1, { duration: 150 });
  }, [scale, savedScale, translateX, translateY, savedX, savedY, dismissOpacity]);

  useEffect(() => {
    if (visible) {
      resetTransform();
      setLoaded(false);
      setErrored(false);
    }
  }, [visible, resetTransform]);

  const onCloseWrapped = useCallback(() => {
    resetTransform();
    onClose();
  }, [onClose, resetTransform]);

  // Sur le web, react-native-gesture-handler est peu fiable dans les Modal :
  // on gère double-clic / molette / glisser via des écouteurs DOM directs.
  useWebImageGestures({
    ref: zoomRef,
    enabled: visible,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
    onClose: onCloseWrapped,
  });

  const zoomWebBy = useCallback(
    (factor: number) => {
      const { width, height } = Dimensions.get('window');
      const s = clamp(scale.value * factor, MIN_SCALE, MAX_SCALE);
      scale.value = s;
      savedScale.value = s;
      if (s <= 1.02) {
        translateX.value = 0;
        translateY.value = 0;
        savedX.value = 0;
        savedY.value = 0;
      } else {
        const maxX = (width * (s - 1)) / 2;
        const maxY = (height * (s - 1)) / 2;
        translateX.value = clamp(translateX.value, -maxX, maxX);
        translateY.value = clamp(translateY.value, -maxY, maxY);
      }
    },
    [scale, savedScale, translateX, translateY, savedX, savedY],
  );

  const resetWebZoom = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  const uri = source == null ? null : typeof source === 'string' ? source : source.uri;
  // Image bornée (webp ≤ 1800 px) : zoom sans faire exploser la mémoire
  // Android (la pleine résolution d'origine provoquait un crash au zoom).
  const resolved = resolveZoomImageUrl(uri);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (savedScale.value <= MIN_SCALE + 0.02) resetTransform();
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1.02) {
        translateX.value = savedX.value + e.translationX * 0.3;
        translateY.value = savedY.value + e.translationY;
        // plus on tire vers le bas, plus l'image devient transparente
        const progress = clamp(e.translationY / 280, 0, 1);
        dismissOpacity.value = 1 - progress * 0.6;
        return;
      }
      const maxX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
      const maxY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
      translateX.value = clamp(savedX.value + e.translationX, -maxX, maxX);
      translateY.value = clamp(savedY.value + e.translationY, -maxY, maxY);
    })
    .onEnd((e) => {
      if (scale.value <= 1.02) {
        if (e.translationY > 110) {
          runOnJS(onCloseWrapped)();
          return;
        }
        resetTransform();
        return;
      }
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.02) {
        resetTransform();
      } else {
        const focalX = e.x - SCREEN_WIDTH / 2;
        const focalY = e.y - SCREEN_HEIGHT / 2;
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 220 });
        savedScale.value = DOUBLE_TAP_SCALE;
        translateX.value = withTiming(clamp(-focalX, -SCREEN_WIDTH / 2, SCREEN_WIDTH / 2), {
          duration: 220,
        });
        translateY.value = withTiming(clamp(-focalY, -SCREEN_HEIGHT / 2, SCREEN_HEIGHT / 2), {
          duration: 220,
        });
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value <= 1.02) runOnJS(onCloseWrapped)();
    });

  const composed = Gesture.Race(
    doubleTapGesture,
    singleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: dismissOpacity.value,
  }));

  const imageContent = (
    <>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={styles.img}
          contentFit="contain"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      ) : (
        <Image source={source as any} style={styles.img} contentFit="contain" />
      )}

      {errored ? (
        <View style={styles.fallback} pointerEvents="none">
          <ImageIcon size={42} color="rgba(255,255,255,0.55)" strokeWidth={1.6} />
          <Text style={styles.fallbackTxt}>Image indisponible</Text>
        </View>
      ) : null}
    </>
  );

  if (!resolved && !source) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCloseWrapped}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        {isWeb ? (
          <Animated.View ref={zoomRef} style={[styles.center, animatedStyle]}>
            {imageContent}
          </Animated.View>
        ) : (
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.center, animatedStyle]}>{imageContent}</Animated.View>
          </GestureDetector>
        )}

        {/* Loader tant que l'image distante n'est pas prête */}
        {!loaded && resolved ? (
          <View pointerEvents="none" style={styles.loaderWrap}>
            <Text style={styles.loaderTxt}>Chargement…</Text>
          </View>
        ) : null}

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.hint}>
            <Text style={styles.hintTxt}>
              {isWeb ? 'Molette ou double-clic pour zoomer' : 'Pincez pour zoomer · double-tap'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={onCloseWrapped}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
            <X size={24} color="#FFF" strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        {/* Zoom avant / arrière / reset (web) */}
        {isWeb ? (
          <View style={[styles.webZoomRow, { bottom: Math.max(insets.bottom, 16) + 12 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom avant"
              onPress={() => zoomWebBy(1.4)}
              hitSlop={8}
              style={({ pressed }) => [styles.webZoomBtn, pressed && { opacity: 0.7 }]}>
              <Plus size={18} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom arrière"
              onPress={() => zoomWebBy(1 / 1.4)}
              hitSlop={8}
              style={({ pressed }) => [styles.webZoomBtn, pressed && { opacity: 0.7 }]}>
              <Minus size={18} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réinitialiser le zoom"
              onPress={resetWebZoom}
              hitSlop={8}
              style={({ pressed }) => [styles.webZoomBtn, pressed && { opacity: 0.7 }]}>
              <Maximize2 size={16} color="#FFF" strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </View>
        ) : null}

        {caption ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="none">
            <Text style={styles.caption} numberOfLines={2}>
              {caption}
            </Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  fallback: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  fallbackTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
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
  hint: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    opacity: 0.9,
  },
  hintTxt: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  webZoomRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  webZoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  loaderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 13, textAlign: 'center' },
});
