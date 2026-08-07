import { UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { AppPalette } from '@/constants/app-palette';

type Props = {
  title: string;
  subtitle: string;
  actionLabel: string;
  onPress: () => void;
  colors: AppPalette;
  Icon?: LucideIcon;
  /** Espace sous l'encart (0 quand le parent gère déjà le gap). */
  marginBottom?: number;
};

/**
 * Encart de rappel "Complétez votre profil" — affiché tant que des
 * informations (photo, logo, description…) restent à renseigner.
 */
export function ProfileCompletionBanner({
  title,
  subtitle,
  actionLabel,
  onPress,
  colors,
  Icon = UserRound,
  marginBottom = 16,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.primary, marginBottom },
        pressed ? styles.pressed : undefined,
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</ThemedText>
        <ThemedText style={[styles.action, { color: colors.primary }]}>
          {actionLabel} →
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 12.5, lineHeight: 17 },
  action: { fontSize: 13.5, fontWeight: '800', marginTop: 4 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
});
