import * as Haptics from 'expo-haptics';
import { AlertTriangle, Eye, EyeOff, Lock, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { navigateToAuthAfterLogout } from '@/lib/app-navigation';
import { clearSessionToken, deleteAccountRemote, getSessionToken } from '@/lib/auth';
import { saveCart } from '@/lib/cart-local';
import { clearSessionSnapshot } from '@/lib/session-store';

const CONFIRM_PHRASE = 'SUPPRIMER';

type Props = {
  /** Indication facultative pour l'utilisateur (ex. "votre compte marchand"). */
  accountLabel?: string;
};

function hapticWarn(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

function hapticSuccess(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function DeleteAccountSection({ accountLabel }: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setPassword('');
    setShowPassword(false);
    setConfirmText('');
    setReason('');
    setSubmitting(false);
    setError(null);
  };

  const openDialog = () => {
    hapticWarn();
    reset();
    setOpen(true);
  };

  const closeDialog = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const goStep2 = () => {
    setError(null);
    if (!password) {
      setError('Saisissez votre mot de passe.');
      return;
    }
    setStep(2);
  };

  const confirmDelete = async () => {
    setError(null);
    if (confirmText.trim().toUpperCase() !== CONFIRM_PHRASE) {
      setError(`Tapez exactement « ${CONFIRM_PHRASE} » pour confirmer.`);
      return;
    }

    setSubmitting(true);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous.');

      await deleteAccountRemote({
        token,
        password,
        reason: reason.trim() || null,
      });

      hapticSuccess();

      // Désinscription push best-effort (le backend l'a déjà fait, mais on nettoie le device)
      try {
        const { getExpoPushToken } = await import('@/lib/notifications-service');
        const { unregisterPushToken } = await import('@/lib/push-token-api');
        const expoToken = await getExpoPushToken();
        if (expoToken) await unregisterPushToken(expoToken).catch(() => {});
      } catch {
        /* non bloquant */
      }

      try {
        const { clearClientDataCache } = await import('@/lib/client-data');
        clearClientDataCache();
      } catch {
        /* non bloquant */
      }

      await clearSessionSnapshot();
      await clearSessionToken();
      await saveCart(null);

      setOpen(false);
      reset();

      // Petit délai pour laisser la modal se fermer proprement avant la navigation
      setTimeout(() => {
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') {
            window.alert('Votre compte a été supprimé. À bientôt.');
          }
        } else {
          Alert.alert('Compte supprimé', 'Votre compte a été définitivement supprimé. À bientôt.');
        }
        navigateToAuthAfterLogout();
      }, 200);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : 'Suppression impossible. Réessayez.');
    }
  };

  return (
    <>
      <View style={[styles.dangerCard, { borderColor: colors.error, backgroundColor: colors.errorSoft }]}>
        <View style={styles.dangerHead}>
          <View style={[styles.dangerIcon, { backgroundColor: colors.surface }]}>
            <AlertTriangle size={18} color={colors.error} strokeWidth={LUCIDE_STROKE} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.dangerTitle, { color: colors.error }]}>Zone de danger</ThemedText>
            <ThemedText style={[styles.dangerBody, { color: colors.textSecondary }]}>
              Suppression définitive de {accountLabel || 'votre compte'}. Vos données personnelles seront
              anonymisées et la connexion sera bloquée. Cette action est irréversible.
            </ThemedText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.dangerBtn,
            { borderColor: colors.error, backgroundColor: pressed ? colors.error : colors.surface },
          ]}
          onPress={openDialog}
          android_ripple={{ color: 'rgba(220,38,38,0.18)' }}
          accessibilityRole="button"
          accessibilityLabel="Supprimer mon compte">
          {({ pressed }) => (
            <View style={styles.dangerBtnInner}>
              <Trash2
                size={18}
                color={pressed ? colors.onPrimary : colors.error}
                strokeWidth={LUCIDE_STROKE}
              />
              <ThemedText style={[styles.dangerBtnLabel, { color: pressed ? colors.onPrimary : colors.error }]}>
                Supprimer mon compte
              </ThemedText>
            </View>
          )}
        </Pressable>
      </View>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={closeDialog}>
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={closeDialog} />
          <View style={[styles.modalCard, { backgroundColor: colors.surface, marginBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.errorSoft }]}>
                <AlertTriangle size={22} color={colors.error} strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText type="subtitle" style={[styles.modalTitle, { color: colors.text }]}>
                {step === 1 ? 'Confirmer la suppression' : 'Dernière étape'}
              </ThemedText>
              <Pressable
                style={styles.modalClose}
                onPress={closeDialog}
                disabled={submitting}
                hitSlop={12}
                accessibilityLabel="Fermer">
                <X size={22} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {step === 1 ? (
                <>
                  <ThemedText style={[styles.modalText, { color: colors.textSecondary }]}>
                    En supprimant votre compte :
                  </ThemedText>
                  <View style={styles.bulletList}>
                    <BulletRow text="Votre nom, téléphone, e-mail et photo seront anonymisés" colors={colors} />
                    <BulletRow text="Vous ne pourrez plus vous connecter avec ce numéro" colors={colors} />
                    <BulletRow text="Vos notifications et sessions seront supprimées" colors={colors} />
                    <BulletRow
                      text="Vos commandes historiques restent conservées sans données personnelles (obligation comptable)"
                      colors={colors}
                    />
                  </View>

                  <ThemedText style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    Mot de passe actuel
                  </ThemedText>
                  <View
                    style={[
                      styles.fieldWrap,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                    ]}>
                    <Lock size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                    <TextInput
                      style={[styles.fieldInput, { color: colors.text }]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                      {showPassword ? (
                        <EyeOff size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                      ) : (
                        <Eye size={20} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                      )}
                    </Pressable>
                  </View>

                  <ThemedText style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 14 }]}>
                    Raison du départ (facultatif)
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.textarea,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                    ]}
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    placeholder="Aidez-nous à nous améliorer…"
                    placeholderTextColor={colors.placeholder}
                    maxLength={500}
                  />
                </>
              ) : (
                <>
                  <ThemedText style={[styles.modalText, { color: colors.textSecondary }]}>
                    Pour confirmer définitivement, tapez le mot{' '}
                    <ThemedText style={[styles.confirmKeyword, { color: colors.error }]}>
                      {CONFIRM_PHRASE}
                    </ThemedText>{' '}
                    ci-dessous.
                  </ThemedText>

                  <TextInput
                    style={[
                      styles.confirmInput,
                      {
                        color: colors.text,
                        borderColor: colors.error,
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder={CONFIRM_PHRASE}
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </>
              )}

              {error ? (
                <View style={[styles.errBox, { borderColor: colors.error, backgroundColor: colors.errorSoft }]}>
                  <ThemedText style={[styles.errText, { color: colors.error }]}>{error}</ThemedText>
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.footerBtn, styles.cancelBtn, { borderColor: colors.border }]}
                onPress={closeDialog}
                disabled={submitting}>
                <ThemedText style={[styles.cancelBtnText, { color: colors.text }]}>Annuler</ThemedText>
              </Pressable>

              {step === 1 ? (
                <Pressable
                  style={[styles.footerBtn, styles.nextBtn, { backgroundColor: colors.error }, submitting && styles.btnDisabled]}
                  onPress={goStep2}
                  disabled={submitting}>
                  <ThemedText style={styles.nextBtnText}>Continuer</ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.footerBtn, styles.nextBtn, { backgroundColor: colors.error }, submitting && styles.btnDisabled]}
                  onPress={() => void confirmDelete()}
                  disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.nextBtnText}>Supprimer définitivement</ThemedText>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function BulletRow({ text, colors }: { text: string; colors: ReturnType<typeof useAppColors> }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: colors.error }]} />
      <ThemedText style={[styles.bulletText, { color: colors.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  dangerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 22,
    gap: 14,
    overflow: 'hidden',
  },
  dangerHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dangerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dangerBody: { fontSize: 13, lineHeight: 18 },
  dangerBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  dangerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dangerBtnLabel: { fontSize: 15, fontWeight: '800' },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 6,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  modalClose: { padding: 4 },
  modalBody: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
  modalText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  bulletList: { gap: 8, marginBottom: 18 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 18 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  fieldInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  confirmKeyword: { fontWeight: '900' },
  confirmInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 6,
  },
  errBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  errText: { fontSize: 13, fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1 },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  nextBtn: {},
  nextBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.7 },
});
