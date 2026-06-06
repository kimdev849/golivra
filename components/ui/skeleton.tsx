import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppColors } from '@/hooks/use-app-colors';

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width, height, borderRadius = 8, style }: Props) {
  const colors = useAppColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.surfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ListingSkeleton() {
  return (
    <View style={styles.listing}>
      <Skeleton width="100%" height={160} borderRadius={16} />
      <View style={styles.listingContent}>
        <Skeleton width="70%" height={20} />
        <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
        <View style={styles.listingFooter}>
          <Skeleton width="30%" height={24} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={60} height={60} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  listing: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listingContent: {
    padding: 12,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
});
