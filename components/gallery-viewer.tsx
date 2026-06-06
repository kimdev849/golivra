import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageZoomViewer } from '@/components/image-zoom-viewer';
import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ColorSet = {
  surface: string;
  text: string;
  textMuted: string;
  background: string;
};

type Props = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  colors: ColorSet;
};

/**
 * Visionneuse plein écran d'une galerie produit.
 * Swipe horizontal pour défiler, indicateur "X / N" en haut, croix pour fermer.
 */
export function GalleryViewer({ visible, images, initialIndex = 0, onClose, colors }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0))));
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (!visible) return;
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(images.length - 1, 0))));
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: index * SCREEN_WIDTH, animated: false });
    }, 30);
    return () => clearTimeout(t);
  }, [visible, initialIndex, images.length, index]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first && typeof first.index === 'number') setIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const goPrev = useCallback(() => {
    if (index <= 0) return;
    const next = index - 1;
    listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    setIndex(next);
  }, [index]);

  const goNext = useCallback(() => {
    if (index >= images.length - 1) return;
    const next = index + 1;
    listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    setIndex(next);
  }, [index, images.length]);

  if (images.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <ThemedText style={styles.counter}>
            {index + 1} / {images.length}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la galerie"
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}>
            <X size={26} color="#FFF" strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(u, i) => `${i}-${u}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.max(0, Math.min(initialIndex, images.length - 1))}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index: i }) => (
            <Pressable
              style={styles.slide}
              onPress={() => setZoomIndex(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Agrandir la photo">
              <Image source={{ uri: item }} style={styles.img} contentFit="contain" />
            </Pressable>
          )}
        />
      </View>

      <ImageZoomViewer
        visible={zoomIndex != null}
        source={zoomIndex != null ? images[zoomIndex] : null}
        onClose={() => setZoomIndex(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  counter: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  close: { padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  slide: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 120, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 160 },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  dots: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { backgroundColor: '#FFF' },
  dotInactive: { backgroundColor: 'rgba(255,255,255,0.4)' },
});
