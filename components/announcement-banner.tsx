import { Megaphone } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useAppAnnouncement } from '@/hooks/use-feature-enabled';
import { useIsOffline } from '@/hooks/use-network-status';

/**
 * Bannière d'annonce configurée à distance par l'admin
 * (parametres_systeme → golivra_announcement). S'affiche en haut de l'app
 * tant que le message est renseigné — sans republier l'APK.
 */
export function AnnouncementBanner() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const announcement = useAppAnnouncement();
  const offline = useIsOffline();

  if (!announcement) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          // Se décale sous le bandeau offline quand les deux sont visibles.
          top: insets.top + (offline ? 42 : 0),
          backgroundColor: colors.primarySoft,
          borderColor: colors.border,
        },
      ]}
    >
      <Megaphone size={14} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
      <ThemedText style={[styles.text, { color: colors.primaryDeep }]} numberOfLines={3}>
        {announcement}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0C3020',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  text: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
