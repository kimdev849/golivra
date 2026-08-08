import { LogOut } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useLogout } from '@/hooks/use-logout';
import { useActionFeedback } from '@/hooks/use-action-feedback';

type Props = {
  clearCart?: boolean;
  variant?: 'filled' | 'ghost' | 'link' | 'plain';
};

export function AppLogoutButton({ clearCart, variant = 'link' }: Props) {
  const colors = useAppColors();
  const { showConfirm, FeedbackOverlay } = useActionFeedback();
  const { performLogout, loggingOut } = useLogout({ clearCart });

  const filled = variant === 'filled';
  const link = variant === 'link';
  const plain = variant === 'plain';

  const onConfirm = () => {
    showConfirm({
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      primaryLabel: 'Se déconnecter',
      secondaryLabel: 'Annuler',
      danger: true,
      icon: LogOut,
      onPrimary: () => void performLogout(),
    });
  };

  if (plain) {
    return (
      <>
        <Pressable
          onPress={onConfirm}
          disabled={loggingOut}
          hitSlop={12}
          style={({ pressed }) => [styles.plain, pressed && !loggingOut && styles.linkPressed, loggingOut && styles.disabled]}>
          {loggingOut ? (
            <View style={styles.plainRow}>
              <ActivityIndicator size="small" color={colors.error} />
              <ThemedText style={[styles.plainLabel, { color: colors.error }]}>Déconnexion…</ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.plainLabel, { color: colors.error }]}>
              Se déconnecter
            </ThemedText>
          )}
        </Pressable>
        <FeedbackOverlay />
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={onConfirm}
        disabled={loggingOut}
        style={({ pressed }) => [
          link ? styles.link : styles.btn,
          link
            ? undefined
            : filled
              ? { backgroundColor: colors.errorSoft, borderColor: colors.error }
              : { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && !loggingOut && (link ? styles.linkPressed : styles.btnPressed),
          loggingOut && styles.disabled,
        ]}
        android_ripple={link ? { color: colors.primaryMuted, borderless: true } : { color: filled ? 'rgba(220,38,38,0.12)' : colors.primaryMuted }}>
        <View style={link ? styles.linkInner : styles.inner}>
          {loggingOut ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <LogOut size={link ? 16 : 18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
          )}
          <ThemedText style={[link ? styles.linkLabel : styles.label, { color: colors.error }]}>
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
          </ThemedText>
        </View>
      </Pressable>
      <FeedbackOverlay />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  btnPressed: { opacity: 0.88 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  linkPressed: { opacity: 0.6 },
  linkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  plain: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plainLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.65,
  },
});
