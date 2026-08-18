import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight, MapPin, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';

import { useAppColors } from '@/hooks/use-app-colors';
import { type ClientOrderListItemZod } from '@/lib/schemas';
import { resolveRemoteImageUrl } from '@/lib/images';
import { orderEtaMinutes, compactOrderRef, normalizeStatusForProgress } from '@/lib/order-status';
import { orderStatusLabel } from '@/lib/ux-copy';

type Props = {
  order: ClientOrderListItemZod;
  merchantName?: string | null;
  merchantImage?: string | null;
  merchantType?: 'restaurant' | 'boutique';
};

/** Progression 0→1 du widget d'accueil selon l'état de la commande. */
function statusProgress(statut: string | null | undefined): number {
  const key = normalizeStatusForProgress(statut);
  const map: Record<string, number> = {
    en_attente: 0.12,
    commande_creee: 0.12,
    en_attente_vendeur: 0.12,
    partiellement_acceptee: 0.35,
    acceptee: 0.35,
    a_preparer: 0.35,
    en_preparation: 0.5,
    prete: 0.68,
    collectee: 0.68,
    livreur_en_route_pickup: 0.68,
    en_collecte: 0.68,
    en_livraison: 0.85,
    en_route: 0.85,
    livree: 1,
  };
  return map[key] ?? 0.2;
}

export function HomeActiveOrderWidget({ order, merchantName, merchantImage, merchantType }: Props) {
  const router = useRouter();
  const colors = useAppColors();
  const img = resolveRemoteImageUrl(merchantImage);
  const eta = orderEtaMinutes(order.statut);
  const subtitle = eta != null ? `Suivi en cours · ~${eta} min` : orderStatusLabel(order.statut);
  const progress = statusProgress(order.statut);

  return (
    <Pressable
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.primaryDeep,
        },
      ]}
      onPress={() => router.push(`/order-tracking/${order.id}` as Href)}
      android_ripple={{ color: colors.primaryMuted }}>
      <View style={[styles.accent, { backgroundColor: colors.primary }]} />
      <View style={[styles.thumb, { backgroundColor: colors.primarySoft }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" />
        ) : (
          <UtensilsCrossed size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        )}
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.kicker, { color: colors.primary }]}>{subtitle}</ThemedText>
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {merchantName?.trim() || 'Votre commande'}
        </ThemedText>
        <ThemedText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          #{compactOrderRef(order.id)} · {orderStatusLabel(order.statut)}
        </ThemedText>
        {/* Barre de progression */}
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: progress >= 1 ? colors.success : colors.primary,
                width: `${Math.round(progress * 100)}%`,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.trailing}>
        <MapPin size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        <ChevronRight size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: 4,
  },
  thumbImg: { width: '100%', height: '100%' },
  body: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  title: { fontSize: 15 },
  meta: { fontSize: 12 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  trailing: { alignItems: 'center', gap: 4 },
});
