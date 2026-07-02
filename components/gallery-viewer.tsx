import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
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
  const listRef = useRef<FlatList<string>>(null);

  const clampedInitial = Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0)));

  // (ré)initialise l'index à chaque ouverture et scrolle sans animation sur la bonne image
  useEffect(() => {
    if (!visible) return;
    setActiveIndex(clampedInitial);
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

  if (images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.root}>
        <FlatList
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
      </View>
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
}: {
  uri: string;
  isActive: boolean;
  caption?: string | null;
  onClose: () => void;
}) {
  const resolved = resolveRemoteImageUrl(uri);

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.slide}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.imgWrap, animatedStyle]}>
          {resolved ? (
            <Image source={{ uri: resolved }} style={styles.img} contentFit="contain" />
          ) : (
            <View style={styles.imgFallback} />
          )}
        </Animated.View>
      </GestureDetector>

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
  imgFallback: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.6 },
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
