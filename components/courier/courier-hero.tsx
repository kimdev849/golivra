import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bike, User } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourierPalette } from '@/lib/courier-theme';
import { resolveRemoteImageUrl } from '@/lib/images';

type Props = {
  nom: string;
  subtitle?: string;
  imageUrl?: string | null;
  disponible?: boolean;
  vehicule?: string | null;
};

export function CourierHero({ nom, subtitle, imageUrl, disponible, vehicule }: Props) {
  const palette = useCourierPalette();
  const avatar = resolveRemoteImageUrl(imageUrl);

  return (
    <LinearGradient
      colors={[palette.primaryDeep, palette.primary, palette.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.avatarRing}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: palette.card }]}>
              <User size={32} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
          )}
        </View>
        <View style={styles.textCol}>
          <ThemedText style={styles.greeting}>Bonjour,</ThemedText>
          <ThemedText style={styles.name} numberOfLines={1}>
            {nom}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={styles.sub} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
          <View style={styles.badges}>
            <View style={[styles.badge, disponible ? styles.badgeOn : styles.badgeOff]}>
              <View style={[styles.dot, { backgroundColor: disponible ? palette.online : palette.offline }]} />
              <ThemedText style={styles.badgeText}>{disponible ? 'En ligne' : 'Hors ligne'}</ThemedText>
            </View>
            {vehicule ? (
              <View style={styles.vehBadge}>
                <Bike size={12} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={styles.vehText}>{vehicule}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeOn: { backgroundColor: 'rgba(22,163,74,0.35)' },
  badgeOff: { backgroundColor: 'rgba(0,0,0,0.2)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  vehBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  vehText: { color: '#DCFCE7', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
