import { Image } from 'expo-image';
import { Store, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import type { EnterprisePublic } from '@/lib/catalog';
import { resolveRemoteImageUrl } from '@/lib/images';

type Props = {
  enterprise: EnterprisePublic;
  onPress: () => void;
};

/** Tuile commerce pour carrousel horizontal (Explorer). */
export function EnterpriseChip({ enterprise, onPress }: Props) {
  const colors = useAppColors();
  const img = resolveRemoteImageUrl(enterprise.image_url);
  const Icon = enterprise.type === 'restaurant' ? UtensilsCrossed : Store;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}>
      <View style={[styles.thumb, { backgroundColor: colors.primarySoft }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" />
        ) : (
          <Icon size={24} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        )}
      </View>
      <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={2}>
        {enterprise.nom ?? 'Commerce'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 108,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    gap: 8,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontSize: 12, fontWeight: '700', textAlign: 'center', minHeight: 32 },
});
