import { Image } from 'expo-image';
import { ImageIcon, Maximize2, Minus, Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
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

type Props = {
  visible: boolean;
  /** URLs brutes (HTTP, data, Supabase) — résolues en interne. */
  images: string[];
  initialIndex?: number;
  /** Légende optionnelle affichée sous l'image courante. */
  caption?: string | null;
  onClose: () => void;
};

/**
 * Galerie plein écran style marketplace/Instagram.
 *
 * - Swipe horizontal entre images
 * - Pinch (2 doigts) : zoom continu 1x → 5x
 * - Double-tap : bascule 1x ↔ 2.5x
 * - Pan (1 doigt) : déplacement quand l'image est zoomée
 * - Swipe vertical vers le bas (hors zoom) : ferme la galerie
 * - Compteur "X / N", points de pagination, croix de fermeture
 *
 * Chaque item est un `GalleryItem` indépendant : l'état de zoom est local à
 * l'image affichée, ce qui évite qu'un zoom sur l'image 1 persiste sur la 2.
 */
export function GalleryViewer({ visible, images, initialIndex = 0, caption, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  // Clé de remontage : chaque ouverture repart d'un état de zoom vierge.
  const [openCount, setOpenCount] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  const clampedInitial = Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0)));

  // (ré)initialise l'index à chaque ouverture et scrolle sans animation sur la bonne image
  useEffect(() => {
    if (!visible) return;
    setActiveIndex(clampedInitial);
    setOpenCount((c) => c + 1);
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: clampedInitial * SCREEN_WIDTH,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') setActiveIndex(first.index);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Web : navigation à la molette (image non zoomée) entre les photos.
  const goToPage = useCallback(
    (dir: 1 | -1) => {
      const next = Math.max(0, Math.min(activeIndex + dir, images.length - 1));
      listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    },
    [activeIndex, images.length],
  );

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          key={openCount}
          ref={listRef}
          data={images}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={clampedInitial}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => (
            <GalleryItem
              uri={item}
              isActive={index === activeIndex}
              caption={index === activeIndex ? caption : null}
              onClose={handleClose}
              onPage={images.length > 1 ? goToPage : undefined}
            />
          )}
        />

        {/* Header : compteur + fermeture */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.counterPill}>
            <Text style={styles.counter}>
              {activeIndex + 1} / {images.length}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la galerie"
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}>
            <X size={24} color="#FFF" strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        {/* Points de pagination */}
        {images.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 16 }]}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Une image zoomable de la galerie. Gère son propre état de zoom (scale,
 * translation) via Reanimated. Le swipe vertical vers le bas ferme la galerie
 * tant que l'on n'est pas zoomé.
 */
function GalleryItem({
  uri,
  isActive,
  caption,
  onClose,
  onPage,
}: {
  uri: string;
  isActive: boolean;
  caption?: string | null;
  onClose: () => void;
  onPage?: (dir: 1 | -1) => void;
}) {
  // Image bornée (webp ≤ 1800 px) : zoom sans faire exploser la mémoire
  // Android (la pleine résolution d'origine provoquait un crash au zoom).
  const resolved = resolveZoomImageUrl(uri);
  const [loadState, setLoadState] = useState<'idle' | 'ok' | 'error'>('idle');
  const isWeb = Platform.OS === 'web';
  const zoomRef = useRef<Animated.View>(null);

  // Réinitialise l'état de chargement quand l'URL change (swipe entre images).
  useEffect(() => {
    setLoadState('idle');
  }, [uri]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetTransform = useCallback(() => {
    scale.value = withTiming(1, { duration: 200 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  // Quand on quitte cet item (swipe vers une autre image), on remet le zoom à 1.
  useEffect(() => {
    if (!isActive) resetTransform();
  }, [isActive, resetTransform]);

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
    .enableTrackpadTwoFingerGesture(false)
    .onUpdate((e) => {
      if (scale.value <= 1.02) {
        // hors zoom : autorise un swipe vertical pour fermer (translateY libre)
        translateX.value = savedX.value + e.translationX * 0.3;
        translateY.value = savedY.value + e.translationY;
        return;
      }
      const maxX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
      const maxY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
      translateX.value = clamp(savedX.value + e.translationX, -maxX, maxX);
      translateY.value = clamp(savedY.value + e.translationY, -maxY, maxY);
    })
    .onEnd((e) => {
      if (scale.value <= 1.02) {
        // si l'utilisateur a suffisamment tiré vers le bas → fermeture
        if (e.translationY > 110) {
          runOnJS(onClose)();
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
        // zoom centré sur le point tapé, borné à l'écran
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
      if (scale.value <= 1.02) runOnJS(onClose)();
    });

  // double-tap doit être reconnu avant le simple tap ; pinch+pan simultanés.
  const composed = Gesture.Race(
    doubleTapGesture,
    singleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  // Sur le web (RNGH peu fiable dans les Modal) : double-clic, molette et
  // glisser souris/doigt. Le glissement horizontal reste à la galerie.
  useWebImageGestures({
    ref: zoomRef,
    enabled: isActive,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
    onClose,
    allowHorizontalPageSwipe: true,
    wheelToPage: onPage,
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const imageContent = (
    <>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={styles.img}
          contentFit="contain"
          onLoadStart={() => setLoadState((s) => (s === 'ok' ? s : 'idle'))}
          onLoad={() => setLoadState('ok')}
          onError={() => setLoadState('error')}
        />
      ) : null}

      {loadState === 'error' || !resolved ? (
        <View style={styles.imgFallback} pointerEvents="none">
          <ImageIcon size={42} color="rgba(255,255,255,0.55)" strokeWidth={1.6} />
          <Text style={styles.fallbackTxt}>Image indisponible</Text>
        </View>
      ) : null}

      {resolved && loadState === 'idle' ? (
        <View pointerEvents="none" style={styles.loaderWrap}>
          <ActivityIndicator color="rgba(255,255,255,0.75)" />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.slide}>
      {isWeb ? (
        <Animated.View ref={zoomRef} style={[styles.imgWrap, animatedStyle]}>
          {imageContent}
        </Animated.View>
      ) : (
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.imgWrap, animatedStyle]}>{imageContent}</Animated.View>
        </GestureDetector>
      )}

      {/* Zoom avant / arrière / reset (web) */}
      {isWeb ? (
        <View style={[styles.webZoomRow, { bottom: 24 }]}>
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
        <View pointerEvents="none" style={styles.captionWrap}>
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgWrap: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  imgFallback: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  fallbackTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  loaderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  counterPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  counter: { color: '#FFF', fontSize: 13, fontWeight: '700' },
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
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: '#FFF', width: 18, borderRadius: 3 },
  dotIdle: { backgroundColor: 'rgba(255,255,255,0.4)' },
  captionWrap: {
    position: 'absolute',
    bottom: 56,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 13, textAlign: 'center' },
});
