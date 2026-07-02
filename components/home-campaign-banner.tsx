import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Carousel from 'react-native-reanimated-carousel';

import type { MarketingCampaign } from '@/lib/campaigns';

const H_PAD = 16;

type Props = {
  campaigns: MarketingCampaign[];
  onPress: (campaign: MarketingCampaign) => void;
  colors: {
    primary: string;
    onPrimary: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    primarySoft: string;
    success: string;
  };
};

const TYPE_LABEL: Record<string, string> = {
  offre_jour: "Offre du jour",
  promo: 'Promotion',
  lancement: 'Nouveauté',
  saisonniere: 'Saison',
  standard: 'Campagne',
};

export function HomeCampaignBanner({ campaigns, onPress, colors }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const carouselWidth = screenWidth - H_PAD * 2;

  const [index, setIndex] = useState(0);
  const heroHeight = useMemo(() => {
    const h = Math.round(carouselWidth * 0.5);
    return Math.min(Math.max(h, 160), 240);
  }, [carouselWidth]);

  const typeStyle = useCallback((type: string) => {
    switch (type) {
      case 'offre_jour': return { gradient: ['#D4380D', '#E8590C'] as const, emoji: '🔥' };
      case 'promo': return { gradient: ['#B45309', '#D97706'] as const, emoji: '🏷️' };
      case 'lancement': return { gradient: ['#065F46', '#059669'] as const, emoji: '🚀' };
      case 'saisonniere': return { gradient: ['#5B21B6', '#7C3AED'] as const, emoji: '📅' };
      default: return { gradient: ['#0C4F36', '#155C3F'] as const, emoji: '📢' };
    }
  }, []);

  if (campaigns.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Carousel
        width={carouselWidth}
        height={heroHeight}
        data={campaigns}
        loop={campaigns.length > 1}
        pagingEnabled
        snapEnabled
        autoPlay={campaigns.length > 1}
        autoPlayInterval={5000}
        scrollAnimationDuration={350}
        style={styles.carousel}
        onSnapToItem={setIndex}
        renderItem={({ item }) => {
          const style = typeStyle(item.type);
          return (
            <Pressable
              onPress={() => onPress(item)}
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.95 : 1 },
              ]}
              android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
            >
              <LinearGradient
                colors={style.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Image de fond si disponible */}
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={[StyleSheet.absoluteFillObject, styles.bgImage]}
                  contentFit="cover"
                  transition={300}
                />
              ) : null}

              {/* Overlay pour lisibilité */}
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />

              {/* Contenu */}
              <View style={styles.content}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeEmoji}>{style.emoji}</Text>
                  <Text style={styles.typeBadgeTxt}>
                    {TYPE_LABEL[item.type] || item.type}
                  </Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {item.nom}
                </Text>

                {item.description ? (
                  <Text style={styles.desc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.ctaRow}>
                  <View style={styles.ctaPill}>
                    <Text style={[styles.ctaTxt, { color: style.gradient[0] }]}>
                      Voir l'offre
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Dots */}
      {campaigns.length > 1 ? (
        <View style={styles.dots}>
          {campaigns.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index
                  ? { width: 20, backgroundColor: '#FFFFFF', opacity: 0.9 }
                  : { width: 6, backgroundColor: '#FFFFFF', opacity: 0.3 },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4, overflow: 'hidden', borderRadius: 18 },
  carousel: { borderRadius: 18 },
  card: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bgImage: { opacity: 0.85 },
  content: {
    padding: 20,
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeBadgeEmoji: { fontSize: 12 },
  typeBadgeTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  desc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  ctaRow: { marginTop: 4 },
  ctaPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaTxt: {
    fontSize: 13,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
