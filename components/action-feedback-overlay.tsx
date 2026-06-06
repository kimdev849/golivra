import * as Haptics from 'expo-haptics';
import { AlertCircle, Check, Info, HelpCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

export type ActionFeedbackVariant = 'success' | 'error' | 'info' | 'confirm';

export type ActionFeedbackOverlayProps = {
  visible: boolean;
  variant: ActionFeedbackVariant;
  title: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onDismiss?: () => void;
};

export function ActionFeedbackOverlay({
  visible,
  variant,
  title,
  message,
  primaryLabel = 'OK',
  secondaryLabel,
  onPrimary,
  onSecondary,
  onDismiss,
}: ActionFeedbackOverlayProps) {
  const colors = useAppColors();
  const isSuccess = variant === 'success';
  const isInfo = variant === 'info';
  const isConfirm = variant === 'confirm';

  const accent = isSuccess ? colors.success : isConfirm ? colors.primary : isInfo ? colors.primary : colors.error;
  const accentSoft = isSuccess ? colors.successSoft : isConfirm ? colors.primarySoft : isInfo ? colors.primarySoft : colors.errorSoft;

  useEffect(() => {
    if (!visible) return;
    if (isSuccess) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (isConfirm) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (!isInfo) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [visible, isSuccess, isInfo, isConfirm]);

  const close = () => {
    onDismiss?.();
  };

  const handlePrimary = () => {
    onPrimary?.();
    close();
  };

  const handleSecondary = () => {
    onSecondary?.();
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: GOLIVRA_BRAND_SHADOW,
            },
          ]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: accentSoft, borderColor: accent }]}>
            {isSuccess ? (
              <Check size={36} color={accent} strokeWidth={LUCIDE_STROKE + 0.5} />
            ) : isConfirm ? (
              <HelpCircle size={36} color={accent} strokeWidth={LUCIDE_STROKE} />
            ) : isInfo ? (
              <Info size={36} color={accent} strokeWidth={LUCIDE_STROKE} />
            ) : (
              <AlertCircle size={36} color={accent} strokeWidth={LUCIDE_STROKE} />
            )}
          </View>

          <ThemedText type="title" style={[styles.title, { color: colors.text }]}>
            {title}
          </ThemedText>

          {message ? (
            <ThemedText style={[styles.message, { color: colors.textSecondary }]}>{message}</ThemedText>
          ) : null}

          <View style={styles.actions}>
            {secondaryLabel ? (
              <Pressable
                style={[styles.secondaryBtn, { backgroundColor: colors.surfaceMuted }]}
                onPress={handleSecondary}
                android_ripple={{ color: 'rgba(0,0,0,0.05)' }}>
                <ThemedText style={[styles.secondaryTxt, { color: colors.textSecondary }]}>
                  {secondaryLabel}
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.primaryBtn,
                { backgroundColor: isSuccess || isInfo || isConfirm ? colors.primary : colors.error, flex: secondaryLabel ? 1 : 0 },
              ]}
              onPress={handlePrimary}
              android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
              <ThemedText style={[styles.primaryTxt, { color: colors.onPrimary }]}>{primaryLabel}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryTxt: {
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryTxt: {
    fontWeight: '700',
    fontSize: 16,
  },
});
