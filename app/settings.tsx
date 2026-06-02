import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, Moon, Smartphone, Sun } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BiometricLockToggle } from '@/components/biometric-lock-toggle';
import { LUCIDE_STROKE } from '@/constants/icons';
import { createScreenStyles } from '@/constants/ui-styles';
import { useAppTheme } from '@/contexts/app-theme-context';
import { getSessionToken } from '@/lib/auth';
import { fetchPreferences, updatePreferences } from '@/lib/preferences-api';
import type { ThemePreference } from '@/contexts/app-theme-context';
import type { AppPalette } from '@/constants/app-palette';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference, setDarkMode, isDark } = useAppTheme();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  const localStyles = useMemo(() => makeLocalStyles(colors), [colors]);
  const bottomPad = Math.max(insets.bottom, 16) + 24;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) return;
      const prefs = await fetchPreferences(token);
      setNotifPush(prefs.notif_push_enabled);
      setNotifEmail(prefs.notif_email_enabled);
    } catch {
      /* défaut */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const patchNotif = async (patch: { notif_push_enabled?: boolean; notif_email_enabled?: boolean }) => {
    const token = await getSessionToken();
    if (!token) return;
    setSaving(true);
    try {
      const prefs = await updatePreferences(token, patch);
      setNotifPush(prefs.notif_push_enabled);
      setNotifEmail(prefs.notif_email_enabled);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const themeOptions: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Clair', icon: Sun },
    { id: 'dark', label: 'Sombre', icon: Moon },
    { id: 'system', label: 'Système', icon: Smartphone },
  ];

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Paramètres
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[localStyles.scroll, { paddingBottom: bottomPad }]}>
        {saving ? (
          <ThemedText type="muted" style={localStyles.intro}>
            Enregistrement…
          </ThemedText>
        ) : null}

        <ThemedText style={localStyles.sectionLabel}>Apparence</ThemedText>
        <View style={localStyles.menuCard}>
          {themeOptions.map((opt) => {
            const active = preference === opt.id;
            const Icon = opt.icon;
            return (
              <Pressable
                key={opt.id}
                style={[localStyles.themeRow, active && localStyles.themeRowActive]}
                onPress={() => void setPreference(opt.id)}>
                <Icon size={20} color={active ? colors.primary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                <ThemedText
                  type="defaultSemiBold"
                  style={{ flex: 1, color: active ? colors.primary : colors.text }}>
                  {opt.label}
                </ThemedText>
                {active ? (
                  <View style={localStyles.dot} />
                ) : null}
              </Pressable>
            );
          })}
          <View style={localStyles.toggleRow}>
            <ThemedText type="muted" style={{ flex: 1 }}>
              Raccourci mode sombre
            </ThemedText>
            <Switch
              value={isDark}
              onValueChange={(v) => void setDarkMode(v)}
              trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
              thumbColor={isDark ? colors.primary : colors.surfaceElevated}
            />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <>
            <ThemedText style={localStyles.sectionLabel}>Notifications</ThemedText>
            <View style={localStyles.menuCard}>
              <View style={localStyles.toggleRow}>
                <View style={localStyles.menuIcon}>
                  <Bell size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">Alertes in-app</ThemedText>
                  <ThemedText type="muted">Commandes et livraisons</ThemedText>
                </View>
                <Switch
                  value={notifPush}
                  onValueChange={(v) => {
                    setNotifPush(v);
                    void patchNotif({ notif_push_enabled: v });
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
                  thumbColor={notifPush ? colors.primary : colors.surfaceElevated}
                />
              </View>
              <View style={[localStyles.toggleRow, localStyles.rowBorder]}>
                <View style={localStyles.menuIcon}>
                  <Bell size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">E-mail</ThemedText>
                  <ThemedText type="muted">Si une adresse est renseignée</ThemedText>
                </View>
                <Switch
                  value={notifEmail}
                  onValueChange={(v) => {
                    setNotifEmail(v);
                    void patchNotif({ notif_email_enabled: v });
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
                  thumbColor={notifEmail ? colors.primary : colors.surfaceElevated}
                />
              </View>
            </View>

            <>
              <ThemedText style={[localStyles.sectionLabel, { marginTop: 18 }]}>Sécurité</ThemedText>
              <BiometricLockToggle colors={colors} />
            </>
          </>
        )}

        <ThemedText style={[localStyles.sectionLabel, { marginTop: 18 }]}>À propos</ThemedText>
        <View style={localStyles.menuCard}>
          <View style={localStyles.toggleRow}>
            <View style={localStyles.menuIcon}>
              <Smartphone size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">Version</ThemedText>
              <ThemedText type="muted">GoLivra {appVersion}</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function makeLocalStyles(c: AppPalette) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 20, paddingTop: 16 },
    intro: { marginBottom: 16 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: c.primaryDeep,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.65,
      marginLeft: 2,
    },
    menuCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
      marginBottom: 8,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    themeRowActive: { backgroundColor: c.primarySoft },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    menuIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
  });
}
