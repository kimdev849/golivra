import * as Haptics from 'expo-haptics';
import { AlertCircle, Check, Info, HelpCircle } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
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

const ICON_MAP = {
  success: Check,
  error: AlertCircle,
  info: Info,
  confirm: HelpCircle,
} as const;

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
  const scale = useRef(new Animated.Value(0.92)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const isSuccess = variant === 'success';
  const isInfo = variant === 'info';
  const isConfirm = variant === 'confirm';

  const accent = isSuccess ? colors.success : isConfirm ? colors.primary : isInfo ? colors.primary : colors.error;
  const accentSoft = isSuccess ? colors.successSoft : isConfirm ? colors.primarySoft : isInfo ? colors.primarySoft : colors.errorSoft;

  const Icon = ICON_MAP[variant];

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.92);
    fadeIn.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    if (isSuccess) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (isConfirm) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (!isInfo) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [visible, isSuccess, isInfo, isConfirm, scale, fadeIn]);

  const close = () => onDismiss?.();

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
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                opacity: fadeIn,
                transform: [{ scale }],
              },
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
              <Icon
                size={26}
                color={accent}
                strokeWidth={LUCIDE_STROKE + 0.5}
              />
            </View>

            <ThemedText style={[styles.title, { color: colors.text }]}>
              {title}
            </ThemedText>

            {message ? (
              <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </ThemedText>
            ) : null}

            <View style={styles.actions}>
              {secondaryLabel ? (
                <Pressable
                  style={[styles.btn, styles.btnSecondary, { backgroundColor: colors.surfaceMuted }]}
                  onPress={handleSecondary}
                  android_ripple={{ color: 'rgba(0,0,0,0.05)' }}>
                  <ThemedText style={[styles.btnText, { color: colors.textSecondary }]}>
                    {secondaryLabel}
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: accent }]}
                onPress={handlePrimary}
                android_ripple={{ color: 'rgba(255,255,255,0.25)' }}>
                <ThemedText style={[styles.btnText, styles.btnPrimaryText]}>
                  {primaryLabel}
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
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
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 310,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 10,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnPrimary: {},
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnSecondary: {},
  btnText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
