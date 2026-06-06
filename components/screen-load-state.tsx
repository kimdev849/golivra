import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppColors } from '@/hooks/use-app-colors';
import { Skeleton } from './ui/skeleton';

type Props = {
  loading?: boolean;
  message?: string;
  compact?: boolean;
  style?: ViewStyle;
  /** Permet d'afficher un skeleton personnalisé au lieu de l'indicateur par défaut */
  skeleton?: React.ReactNode;
};

/** Indicateur de chargement discret ou Skeleton pour une apparence progressive. */
export function ScreenLoadState({ loading = true, message, compact, style, skeleton }: Props) {
  const colors = useAppColors();
  if (!loading) return null;

  // Si un skeleton est fourni, on l'affiche directement
  if (skeleton) return <View style={style}>{skeleton}</View>;

  return (
    <View style={[compact ? styles.compact : styles.box, style]}>
      {compact ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.skeletonContainer}>
          <Skeleton width="100%" height={120} borderRadius={16} />
          <Skeleton width="80%" height={20} style={{ marginTop: 12 }} />
          <Skeleton width="60%" height={20} style={{ marginTop: 8 }} />
        </View>
      )}
      {message ? (
        <ThemedText style={[styles.text, { color: colors.textMuted, marginTop: 8 }]}>{message}</ThemedText>
      ) : null}
    </View>
  );
}

type EmptyProps = {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** État vide ou erreur réseau — style neutre, pas de rouge alarmant. */
export function ScreenEmptyState({ title, body, onRetry, retryLabel = 'Réessayer' }: EmptyProps) {
  const colors = useAppColors();

  return (
    <View style={styles.empty}>
      <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>{title}</ThemedText>
      {body ? (
        <ThemedText style={[styles.emptyBody, { color: colors.textMuted }]}>{body}</ThemedText>
      ) : null}
      {onRetry ? (
        <Pressable
          style={[styles.retry, { backgroundColor: colors.primary }]}
          onPress={onRetry}>
          <ThemedText style={[styles.retryText, { color: colors.onPrimary }]}>{retryLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  skeletonContainer: {
    width: '100%',
    gap: 8,
  },
  text: { fontSize: 14 },
  empty: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { fontWeight: '800' },
});
