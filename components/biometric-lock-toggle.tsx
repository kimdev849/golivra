import { Fingerprint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import {
  biometricLockLabel,
  getBiometricLockEnabled,
  isBiometricHardwareAvailable,
  setBiometricLockEnabled,
} from '@/lib/biometric-lock';

type PaletteLike = {
  primary: string;
  primaryMuted: string;
  primarySoft: string;
  surfaceElevated: string;
  borderStrong: string;
  text: string;
  textMuted: string;
};

type Props = {
  colors: PaletteLike;
  cardBackground?: string;
  cardBorder?: string;
  hint?: string;
  onChange?: (enabled: boolean) => void;
};

export function BiometricLockToggle({ colors, cardBackground, cardBorder, hint, onChange }: Props) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('Verrou biométrique');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await isBiometricHardwareAvailable();
      if (!alive) return;
      setAvailable(ok);
      if (ok) {
        const [current, label] = await Promise.all([
          getBiometricLockEnabled(),
          biometricLockLabel(),
        ]);
        if (!alive) return;
        setEnabled(current);
        setTitle(`Verrouiller avec ${label}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!available) return null;

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    const previous = enabled;
    setEnabled(next);
    try {
      await setBiometricLockEnabled(next);
      onChange?.(next);
    } catch {
      setEnabled(previous);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        cardBackground ? { backgroundColor: cardBackground } : null,
        cardBorder ? { borderColor: cardBorder } : null,
      ]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
          <Fingerprint size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
        </View>
        <View style={styles.body}>
          <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
            {title}
          </ThemedText>
          <ThemedText type="muted" style={{ color: colors.textMuted }}>
            {hint ?? 'Au retour sur l’app (optionnel)'}
          </ThemedText>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={(v) => void handleToggle(v)}
            trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
            thumbColor={enabled ? colors.primary : colors.surfaceElevated}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  body: { flex: 1, minWidth: 0 },
});
