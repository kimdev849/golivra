import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';

import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type HomeHeroSlide = {
  /** Visuel promotionnel (texte inclus dans l'image). */
  image: ImageSourcePropType;
  cta: string;
};

type Props = {
  slides: HomeHeroSlide[];
  heroIndex: number;
  onIndexChange: (index: number) => void;
  onCta: () => void;
};

/** Largeur alignée sur le ScrollView avec `paddingHorizontal: 20`. */
export function HomeHeroCarousel({ slides, heroIndex, onIndexChange, onCta }: Props) {
  const { width } = useWindowDimensions();
  const carouselWidth = width - 40;
  const colors = useAppColors();
  const colorScheme = useColorScheme();

  const heroHeight = useMemo(() => {
    const h = Math.round(carouselWidth * 0.58);
    return Math.min(Math.max(h, 196), 280);
  }, [carouselWidth]);

  const ctaPillBg = colorScheme === 'dark' ? 'rgba(21,23,26,0.92)' : 'rgba(255,255,255,0.96)';

  return (
    <View style={styles.wrap}>
      <Carousel
        width={carouselWidth}
        height={heroHeight}
        data={slides}
        loop
        pagingEnabled
        snapEnabled
        autoPlay
        autoPlayInterval={5500}
        scrollAnimationDuration={380}
        onSnapToItem={onIndexChange}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.cta}
            style={[styles.page, { height: heroHeight }]}
            onPress={onCta}
            android_ripple={{ color: 'rgba(255,255,255,0.12)' }}>
            <View style={[styles.card, { height: heroHeight }]}>
              <ZoomableImage
                source={item.image}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={220}
              />
              <LinearGradient
                colors={['transparent', 'transparent', 'rgba(6,25,18,0.55)']}
                locations={[0, 0.45, 1]}
                style={[StyleSheet.absoluteFillObject, styles.noPointer]}
              />
              <View style={styles.ctaBar}>
                <View style={[styles.ctaPill, { backgroundColor: ctaPillBg }]}>
                  <ThemedText style={[styles.ctaText, { color: colors.primary }]}>{item.cta}</ThemedText>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === heroIndex
                ? { width: 20, backgroundColor: colors.primary, opacity: 0.85 }
                : { width: 6, backgroundColor: colors.textMuted, opacity: 0.35 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  page: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(6,25,18,0.06)',
    elevation: 1,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ctaPill: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  ctaText: { fontWeight: '800', fontSize: 14 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  dot: { height: 8, borderRadius: 99 },
  noPointer: { pointerEvents: 'none' },
});
