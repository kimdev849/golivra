import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  KeyRound,
  Mail,
  Moon,
  Smartphone,
  Sun,
  Type,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BiometricLockToggle } from '@/components/biometric-lock-toggle';
import { LUCIDE_STROKE } from '@/constants/icons';
import { createScreenStyles } from '@/constants/ui-styles';
import { useAppTheme } from '@/contexts/app-theme-context';
import {
  TEXT_SCALE_OPTIONS,
  useTextScale,
  type TextScaleKey,
} from '@/contexts/text-scale-context';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { getSessionToken } from '@/lib/auth';
import { fetchPreferences, updatePreferences } from '@/lib/preferences-api';
import type { ThemePreference } from '@/contexts/app-theme-context';
import type { AppPalette } from '@/constants/app-palette';
import type { LucideIcon } from 'lucide-react-native';

type ThemeOption = { id: ThemePreference; label: string; Icon: LucideIcon };

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Clair', Icon: Sun },
  { id: 'dark', label: 'Sombre', Icon: Moon },
  { id: 'system', label: 'Système', Icon: Smartphone },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference, setDarkMode, isDark } = useAppTheme();
  const { key: textScaleKey, setKey: setTextScaleKey } = useTextScale();
  const { unreadCount } = useUnreadNotifications();
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

  const renderSectionLabel = (text: string) => (
    <ThemedText style={localStyles.sectionLabel}>{text}</ThemedText>
  );

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Réglages
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[localStyles.scroll, { paddingBottom: bottomPad }]}>
        {saving ? (
          <ThemedText type="muted" style={localStyles.saving}>
            Enregistrement…
          </ThemedText>
        ) : null}

        {/* ── Apparence : thème + taille du texte ── */}
        {renderSectionLabel('Apparence')}
        <View style={localStyles.menuCard}>
          {THEME_OPTIONS.map((opt, idx) => {
            const active = preference === opt.id;
            const Icon = opt.Icon;
            return (
              <View key={opt.id}>
                <Pressable
                  style={[localStyles.row, active && localStyles.rowActive]}
                  onPress={() => void setPreference(opt.id)}>
                  <View style={[localStyles.rowIcon, { backgroundColor: active ? colors.primarySoft : colors.surfaceMuted }]}>
                    <Icon size={20} color={active ? colors.primary : colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{ flex: 1, color: active ? colors.primary : colors.text }}>
                    {opt.label}
                  </ThemedText>
                  {active ? <View style={localStyles.dot} /> : null}
                </Pressable>
                {idx < THEME_OPTIONS.length - 1 ? <View style={localStyles.divider} /> : null}
              </View>
            );
          })}
        </View>

        {/* Taille du texte */}
        <View style={[localStyles.menuCard, { marginTop: 12 }]}>
          <View style={localStyles.row}>
            <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
              <Type size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">Taille du texte</ThemedText>
              <ThemedText type="muted" style={localStyles.rowSub}>
                Affichez les textes plus petits ou plus grands
              </ThemedText>
            </View>
          </View>
          <View style={[localStyles.segmented, { backgroundColor: colors.surfaceMuted }]}>
            {TEXT_SCALE_OPTIONS.map((opt) => {
              const active = textScaleKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[localStyles.segment, active && { backgroundColor: colors.primary }]}
                  onPress={() => setTextScaleKey(opt.key as TextScaleKey)}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[localStyles.segmentTxt, { color: active ? colors.onPrimary : colors.textSecondary }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[localStyles.switchRow, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold">Raccourci mode sombre</ThemedText>
            <ThemedText type="muted" style={localStyles.rowSub}>
              Forcer le mode sombre
            </ThemedText>
          </View>
          <Switch
            value={isDark}
            onValueChange={(v) => void setDarkMode(v)}
            trackColor={{ false: colors.borderStrong, true: colors.primaryMuted }}
            thumbColor={isDark ? colors.primary : colors.surfaceElevated}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <>
            {/* ── Notifications ── */}
            {renderSectionLabel('Notifications')}
            <View style={localStyles.menuCard}>
              {/* Accès à la liste des notifications, avec compteur de non-lues */}
              <Pressable
                style={({ pressed }) => [
                  localStyles.row,
                  pressed && { backgroundColor: colors.primarySoft },
                ]}
                onPress={() => router.push('/notifications')}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
                  <Bell size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">Mes notifications</ThemedText>
                  <ThemedText type="muted" style={localStyles.rowSub}>
                    {unreadCount > 0
                      ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                      : 'Aucune notification non lue'}
                  </ThemedText>
                </View>
                {unreadCount > 0 ? (
                  <View
                    style={[
                      localStyles.notifBadge,
                      { backgroundColor: colors.error, borderColor: colors.surface },
                    ]}>
                    <Text style={localStyles.notifBadgeTxt}>
                      {unreadCount > 9 ? '9+' : String(unreadCount)}
                    </Text>
                  </View>
                ) : null}
                <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
              <View style={localStyles.divider} />
              <View style={localStyles.row}>
                <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
                  <Bell size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">Alertes in-app</ThemedText>
                  <ThemedText type="muted" style={localStyles.rowSub}>
                    Commandes et livraisons
                  </ThemedText>
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
              <View style={localStyles.divider} />
              <View style={localStyles.row}>
                <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
                  <Mail size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold">E-mail</ThemedText>
                  <ThemedText type="muted" style={localStyles.rowSub}>
                    Si une adresse est renseignée
                  </ThemedText>
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

            {/* ── Sécurité ── */}
            {renderSectionLabel('Sécurité')}
            <BiometricLockToggle
              colors={colors}
              hint="Au retour sur l’app (optionnel, désactivable à tout moment)"
            />
          </>
        )}

        {/* ── Compte & sécurité ── */}
        {renderSectionLabel('Compte')}
        <View style={localStyles.menuCard}>
          <Pressable
            style={({ pressed }) => [
              localStyles.row,
              pressed && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => router.push('/account-settings')}
            android_ripple={{ color: colors.primaryMuted }}>
            <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
              <KeyRound size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">Connexion & sécurité</ThemedText>
              <ThemedText type="muted" style={localStyles.rowSub}>
                Mot de passe, biométrie, suppression du compte
              </ThemedText>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
          <View style={localStyles.divider} />
          <Pressable
            style={({ pressed }) => [
              localStyles.row,
              pressed && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => router.push('/payment-methods')}
            android_ripple={{ color: colors.primaryMuted }}>
            <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
              <CreditCard size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">Paiements</ThemedText>
              <ThemedText type="muted" style={localStyles.rowSub}>
                Méthodes de paiement et sécurité
              </ThemedText>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        {/* ── À propos ── */}
        {renderSectionLabel('À propos')}
        <View style={localStyles.menuCard}>
          <View style={localStyles.row}>
            <View style={[localStyles.rowIcon, { backgroundColor: colors.primarySoft }]}>
              <Info size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">Version</ThemedText>
              <ThemedText type="muted" style={localStyles.rowSub}>
                GoLivra {appVersion}
              </ThemedText>
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
    saving: { marginBottom: 12 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: c.primaryDeep,
      marginBottom: 8,
      marginTop: 18,
      textTransform: 'uppercase',
      letterSpacing: 0.65,
      marginLeft: 2,
    },
    menuCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    rowActive: { backgroundColor: c.primarySoft },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowSub: { fontSize: 12, marginTop: 1 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 66, backgroundColor: c.border },
    segmented: {
      flexDirection: 'row',
      marginHorizontal: 14,
      marginBottom: 14,
      borderRadius: 12,
      padding: 3,
      gap: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: 'center',
    },
    segmentTxt: { fontSize: 13 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    notifBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifBadgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  });
}
