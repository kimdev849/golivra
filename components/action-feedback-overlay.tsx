import { BlurView } from 'expo-blur';
import {
  AlertCircle,
  Check,
  HelpCircle,
  Info,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  /** Bouton principal en rouge (action destructive : déconnexion, suppression…). */
  danger?: boolean;
  /** Icône personnalisée (ex. LogOut pour la déconnexion). */
  icon?: LucideIcon;
};

const DEFAULT_ICONS: Record<ActionFeedbackVariant, LucideIcon> = {
  success: Check,
  error: AlertCircle,
  info: Info,
  confirm: HelpCircle,
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
  danger = false,
  icon,
}: ActionFeedbackOverlayProps) {
  const colors = useAppColors();
  const isDark = useColorScheme() === 'dark';
  const scale = useRef(new Animated.Value(0.9)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  const isSuccess = variant === 'success';

  const destructive = variant === 'error' || danger;
  const accent = isSuccess
    ? colors.success
    : destructive
      ? colors.error
      : colors.primary;
  const accentSoft = isSuccess
    ? colors.successSoft
    : destructive
      ? colors.errorSoft
      : colors.primarySoft;

  const Icon = icon ?? DEFAULT_ICONS[variant];

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.9);
    fadeIn.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Le haptique est déclenché par le hook use-action-feedback (point d'entrée
    // unique) — le laisser ici créerait un double retour haptique.
  }, [visible, scale, fadeIn]);

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
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <BlurView
          intensity={isDark ? 40 : 52}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={[styles.dim, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.38)' }]}
          onPress={close}
          accessibilityLabel="Fermer"
        />
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: fadeIn,
                transform: [{ scale }],
              },
            ]}>
            <View style={[styles.iconWrap, { backgroundColor: accentSoft }]}>
              <Icon size={28} color={accent} strokeWidth={LUCIDE_STROKE + 0.5} />
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
                  style={[
                    styles.btn,
                    styles.btnSecondary,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  ]}
                  onPress={handleSecondary}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}>
                  <ThemedText style={[styles.btnText, { color: colors.text }]}>
                    {secondaryLabel}
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: accent }]}
                onPress={handlePrimary}
                android_ripple={{ color: 'rgba(255,255,255,0.28)' }}>
                <ThemedText style={styles.btnPrimaryText}>
                  {primaryLabel}
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 34,
    elevation: 26,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
