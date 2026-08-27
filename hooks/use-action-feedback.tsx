import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import {
  ActionFeedbackOverlay,
  type ActionFeedbackVariant,
} from '@/components/action-feedback-overlay';
import { UX_ERRORS, friendlyErrorMessage } from '@/lib/ux-copy';

type FeedbackConfig = {
  variant: ActionFeedbackVariant;
  title: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  /** Bouton principal en rouge (déconnexion, suppression…). */
  danger?: boolean;
  /** Icône personnalisée (ex. LogOut pour la déconnexion). */
  icon?: LucideIcon;
};

export function useActionFeedback() {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<ActionFeedbackVariant>('success');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [primaryLabel, setPrimaryLabel] = useState<string>('OK');
  const [secondaryLabel, setSecondaryLabel] = useState<string | undefined>(undefined);
  const [danger, setDanger] = useState(false);
  const [icon, setIcon] = useState<LucideIcon | undefined>(undefined);
  // Store callbacks in refs so we never stale-close or cause re-renders
  const onPrimaryRef = useRef<(() => void) | undefined>(undefined);
  const onSecondaryRef = useRef<(() => void) | undefined>(undefined);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const open = useCallback((config: FeedbackConfig) => {
    // Feedback haptique basé sur le variant
    if (config.variant === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (config.variant === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (config.variant === 'confirm' || config.variant === 'info') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onPrimaryRef.current = config.onPrimary;
    onSecondaryRef.current = config.onSecondary;
    setVariant(config.variant);
    setTitle(config.title);
    setMessage(config.message);
    setPrimaryLabel(config.primaryLabel ?? 'OK');
    setSecondaryLabel(config.secondaryLabel);
    setDanger(config.danger ?? false);
    setIcon(config.icon);
    setVisible(true);
  }, []);

  const showSuccess = useCallback(
    (
      title: string,
      message?: string,
      options?: { primaryLabel?: string; onPrimary?: () => void; icon?: LucideIcon },
    ) => {
      open({
        variant: 'success',
        title,
        message,
        primaryLabel: options?.primaryLabel,
        onPrimary: options?.onPrimary,
        icon: options?.icon,
      });
    },
    [open],
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      open({ variant: 'error', title, message: friendlyErrorMessage(message, UX_ERRORS.generic) });
    },
    [open],
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      open({ variant: 'info', title, message });
    },
    [open],
  );

  const showConfirm = useCallback(
    (config: {
      title: string;
      message?: string;
      primaryLabel?: string;
      secondaryLabel?: string;
      onPrimary: () => void;
      onSecondary?: () => void;
      danger?: boolean;
      icon?: LucideIcon;
    }) => {
      open({
        variant: 'confirm',
        title: config.title,
        message: config.message,
        primaryLabel: config.primaryLabel,
        secondaryLabel: config.secondaryLabel,
        onPrimary: config.onPrimary,
        onSecondary: config.onSecondary,
        danger: config.danger,
        icon: config.icon,
      });
    },
    [open],
  );

  // Stable component reference — only re-renders when `visible` or display props change.
  // Callbacks are read from refs so they always run the latest version
  // without causing unmount/remount of the Modal.
  const FeedbackOverlay = useCallback(
    () => (
      <ActionFeedbackOverlay
        visible={visible}
        variant={variant}
        title={title}
        message={message}
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        onPrimary={() => onPrimaryRef.current?.()}
        onSecondary={() => onSecondaryRef.current?.()}
        onDismiss={dismiss}
        danger={danger}
        icon={icon}
      />
    ),
    [visible, variant, title, message, primaryLabel, secondaryLabel, dismiss, danger, icon],
  );

  return { showSuccess, showError, showInfo, showConfirm, dismiss, FeedbackOverlay };
}
