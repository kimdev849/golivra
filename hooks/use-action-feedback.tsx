import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';

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
};

const initial = {
  visible: false,
  variant: 'success' as ActionFeedbackVariant,
  title: '',
  message: undefined as string | undefined,
  primaryLabel: 'OK',
  secondaryLabel: undefined as string | undefined,
  onPrimary: undefined as (() => void) | undefined,
  onSecondary: undefined as (() => void) | undefined,
};

export function useActionFeedback() {
  const [state, setState] = useState(initial);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
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

    setState({
      visible: true,
      variant: config.variant,
      title: config.title,
      message: config.message,
      primaryLabel: config.primaryLabel ?? 'OK',
      secondaryLabel: config.secondaryLabel,
      onPrimary: config.onPrimary,
      onSecondary: config.onSecondary,
    });
  }, []);

  const showSuccess = useCallback(
    (title: string, message?: string, options?: { primaryLabel?: string; onPrimary?: () => void }) => {
      open({
        variant: 'success',
        title,
        message,
        primaryLabel: options?.primaryLabel,
        onPrimary: options?.onPrimary,
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
    }) => {
      open({
        variant: 'confirm',
        title: config.title,
        message: config.message,
        primaryLabel: config.primaryLabel,
        secondaryLabel: config.secondaryLabel,
        onPrimary: config.onPrimary,
        onSecondary: config.onSecondary,
      });
    },
    [open],
  );

  const FeedbackOverlay = useCallback(
    () => (
      <ActionFeedbackOverlay
        visible={state.visible}
        variant={state.variant}
        title={state.title}
        message={state.message}
        primaryLabel={state.primaryLabel}
        secondaryLabel={state.secondaryLabel}
        onPrimary={state.onPrimary}
        onSecondary={state.onSecondary}
        onDismiss={dismiss}
      />
    ),
    [state, dismiss],
  );

  return { showSuccess, showError, showInfo, showConfirm, dismiss, FeedbackOverlay };
}
