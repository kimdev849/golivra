import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, CheckCircle2, Clock, Info, Power, Sunrise, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { showToast } from '@/lib/app-toast';
import {
  fetchEnterpriseHoraires,
  saveEnterpriseHoraires,
  type EnterpriseHoraires,
} from '@/lib/enterprise';
import { computeOpenStatus } from '@/lib/horaires-status';
import { useVendor } from '@/contexts/vendor-context';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type DayState = {
  jour: number;
  ouvert: boolean;
  ouverture: Date;
  fermeture: Date;
};

type PickerTarget = { jour: number; field: 'ouverture' | 'fermeture'; value: Date };

function dateFromHour(h: string | null | undefined): Date {
  const d = new Date(2000, 0, 1, 9, 0);
  if (h) {
    const m = String(h).match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      d.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
    }
  }
  return d;
}

function hourFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function defaultDays(): DayState[] {
  return DAY_NAMES.map((_, jour) => ({
    jour,
    ouvert: true,
    ouverture: new Date(2000, 0, 1, 9, 0),
    fermeture: new Date(2000, 0, 1, 22, 0),
  }));
}

function sameHours(a: DayState, b: DayState): boolean {
  return (
    hourFromDate(a.ouverture) === hourFromDate(b.ouverture) &&
    hourFromDate(a.fermeture) === hourFromDate(b.fermeture)
  );
}

/** Résumé humain et compact de la semaine (groupes de jours consécutifs). */
function humanWeekSummary(days: DayState[]): string {
  const open = days.filter((d) => d.ouvert);
  if (open.length === 0) return 'Aucun jour d\u2019ouverture \u2014 vous ne recevrez aucune commande.';
  if (open.length === 7 && open.every((d) => sameHours(d, open[0]))) {
    return `Tous les jours \u00b7 ${hourFromDate(open[0].ouverture)}\u2013${hourFromDate(open[0].fermeture)}`;
  }
  const groups: { days: number[]; hours: string }[] = [];
  for (const d of open) {
    const hours = `${hourFromDate(d.ouverture)}\u2013${hourFromDate(d.fermeture)}`;
    const last = groups[groups.length - 1];
    if (last && last.hours === hours && last.days[last.days.length - 1] === d.jour - 1) {
      last.days.push(d.jour);
    } else {
      groups.push({ days: [d.jour], hours });
    }
  }
  return groups
    .map((g) => {
      const names = g.days.map((j) => DAY_SHORT[j]);
      const range = names.length > 1 ? `${names[0]}\u2013${names[names.length - 1]}` : names[0];
      return `${range} \u00b7 ${g.hours}`;
    })
    .join('  |  ');
}

const IS_ANDROID = Platform.OS === 'android';

export default function VendorHorairesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { shop } = useVendor();
  const params = useLocalSearchParams<{ id?: string }>();
  const enterpriseId = typeof params.id === 'string' && params.id ? params.id : shop?.id || '';

  const [days, setDays] = useState<DayState[]>(defaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Picker state ---
  // Android: native dialog (no Modal needed). iOS: Modal + spinner.
  const [androidPicker, setAndroidPicker] = useState<PickerTarget | null>(null);
  const [iosPicker, setIosPicker] = useState<PickerTarget | null>(null);
  const [pendingTime, setPendingTime] = useState<Date | null>(null);

  // Ref to track the picker target during Android onChange callbacks
  const androidPickerRef = useRef<PickerTarget | null>(null);

  const [hasSavedHours, setHasSavedHours] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!enterpriseId) {
        if (alive) setLoading(false);
        return;
      }
      try {
        const token = await getSessionToken();
        if (!token) throw new Error('Session expirée.');
        const horaires = await fetchEnterpriseHoraires(token, enterpriseId);
        if (!alive) return;
        const next = defaultDays();
        for (const h of horaires) {
          const day = next.find((d) => d.jour === Number(h.jour));
          if (!day) continue;
          day.ouvert = true;
          day.ouverture = dateFromHour(h.ouverture);
          day.fermeture = dateFromHour(h.fermeture);
        }
        setDays(next);
        setHasSavedHours(horaires.length > 0);
      } catch {
        /* silencieux : on garde les valeurs par défaut */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [enterpriseId]);

  const updateDay = useCallback((jour: number, patch: Partial<DayState>) => {
    setDays((prev) => prev.map((d) => (d.jour === jour ? { ...d, ...patch } : d)));
  }, []);

  // ─── Picker openers ────────────────────────────────────────────────────
  const openPicker = useCallback(
    (target: PickerTarget) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (IS_ANDROID) {
        androidPickerRef.current = target;
        setAndroidPicker(target);
      } else {
        setPendingTime(target.value);
        setIosPicker(target);
      }
    },
    [],
  );

  // ─── iOS: close / apply ────────────────────────────────────────────────
  const closeIosPicker = useCallback(() => {
    setIosPicker(null);
    setPendingTime(null);
  }, []);

  const applyIosPicker = useCallback(() => {
    if (!iosPicker) return;
    updateDay(iosPicker.jour, { [iosPicker.field]: pendingTime ?? iosPicker.value });
    setIosPicker(null);
    setPendingTime(null);
  }, [iosPicker, pendingTime, updateDay]);

  // ─── Android: native dialog onChange ────────────────────────────────────
  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, _date?: Date) => {
      const target = androidPickerRef.current;
      // Always clear the picker so the dialog closes
      setAndroidPicker(null);
      androidPickerRef.current = null;

      if (event.type === 'set' && event.nativeEvent.timestamp && target) {
        const date = new Date(event.nativeEvent.timestamp);
        updateDay(target.jour, { [target.field]: date });
      }
    },
    [updateDay],
  );

  const allOpen = () => setDays(defaultDays());
  const allClosed = () =>
    setDays(
      DAY_NAMES.map((_, jour) => ({
        jour,
        ouvert: false,
        ouverture: new Date(2000, 0, 1, 9, 0),
        fermeture: new Date(2000, 0, 1, 22, 0),
      })),
    );

  const openCount = days.filter((d) => d.ouvert).length;

  const previewRows = useMemo<EnterpriseHoraires[]>(
    () =>
      days
        .filter((d) => d.ouvert)
        .map((d) => ({
          jour: d.jour,
          ouverture: hourFromDate(d.ouverture),
          fermeture: hourFromDate(d.fermeture),
        })),
    [days],
  );

  const preview = computeOpenStatus(previewRows);
  const summary = useMemo(() => humanWeekSummary(days), [days]);
  const todayIdx = new Date().getDay();

  const previewTone = previewRows.length === 0 ? colors.error : preview.open ? colors.success : colors.warning;
  const previewSoft =
    previewRows.length === 0 ? colors.errorSoft : preview.open ? colors.successSoft : colors.warningSoft;

  let previewTitle: string;
  let previewSub: string;
  if (previewRows.length === 0) {
    previewTitle = 'Fermé';
    previewSub = 'Ouvrez au moins un jour pour recevoir des commandes.';
  } else if (preview.open) {
    previewTitle = 'Ouvert aujourd\u2019hui';
    previewSub = preview.todayHours
      ? `Vos clients peuvent commander \u00b7 ${preview.todayHours}`
      : 'Vos clients peuvent commander.';
  } else if (preview.nextLabel.startsWith('aujourd')) {
    previewTitle = 'Fermé pour le moment';
    previewSub = `Rouvre ${preview.nextLabel}.`;
  } else if (preview.nextLabel) {
    previewTitle = 'Fermé aujourd\u2019hui';
    previewSub = `Réouverture ${preview.nextLabel}.`;
  } else {
    previewTitle = 'Fermé';
    previewSub = 'Aucune ouverture prévue cette semaine.';
  }

  const save = async () => {
    if (!enterpriseId) {
      setError('Commerce introuvable. Réessayez.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const rows: EnterpriseHoraires[] = days
        .filter((d) => d.ouvert)
        .map((d) => ({
          jour: d.jour,
          ouverture: hourFromDate(d.ouverture),
          fermeture: hourFromDate(d.fermeture),
        }));
      await saveEnterpriseHoraires(token, enterpriseId, rows);
      setHasSavedHours(rows.length > 0);
      showToast({ message: 'Horaires enregistrés.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader
        title="Horaires d'ouverture"
        subtitle="Disponibilité de votre commerce"
        right={
          <View style={[styles.statusPill, { backgroundColor: previewSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: previewTone }]} />
            <ThemedText style={[styles.statusPillTxt, { color: previewTone }]}>
              {previewRows.length === 0 ? 'Fermé' : preview.open ? 'Ouvert' : 'Fermé'}
            </ThemedText>
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 12) + 168 }]}>
        {/* Aperçu client en direct */}
        <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.previewIcon, { backgroundColor: previewSoft }]}>
            <Clock size={22} color={previewTone} strokeWidth={LUCIDE_STROKE} />
          </View>
          <View style={styles.previewBody}>
            <ThemedText style={[styles.previewTitle, { color: colors.text }]}>{previewTitle}</ThemedText>
            <ThemedText style={[styles.previewSub, { color: colors.textMuted }]}>{previewSub}</ThemedText>
          </View>
        </View>

        {/* Rappel bref */}
        <View style={[styles.infoBanner, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Info size={15} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
            Vos clients ne peuvent commander que pendant ces horaires. Le changement s'applique
            immédiatement.
          </ThemedText>
        </View>

        {!hasSavedHours && !loading ? (
          <View style={[styles.warnBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <ThemedText style={[styles.warnText, { color: colors.warning }]}>
              Horaires non définis : vous ne recevez aucune commande pour le moment.
            </ThemedText>
          </View>
        ) : null}

        {/* Actions rapides */}
        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressedDim,
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              allOpen();
            }}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir tous les jours">
            <Sunrise size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.quickTxt, { color: colors.primary }]}>Tout ouvrir</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressedDim,
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              allClosed();
            }}
            accessibilityRole="button"
            accessibilityLabel="Fermer tous les jours">
            <Power size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.quickTxt, { color: colors.error }]}>Tout fermer</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Jours de la semaine
        </ThemedText>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {days.map((d, i) => {
              const isToday = d.jour === todayIdx;
              const dayStyle = { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong };
              return (
                <View key={d.jour}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <View style={styles.dayRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.dayNameRow}>
                        <ThemedText
                          style={[styles.dayName, { color: d.ouvert ? colors.text : colors.textMuted }]}>
                          {DAY_NAMES[d.jour]}
                        </ThemedText>
                        {isToday ? (
                          <View style={[styles.todayPill, { backgroundColor: colors.primarySoft }]}>
                            <ThemedText style={[styles.todayPillTxt, { color: colors.primary }]}>
                              Aujourd'hui
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      {d.ouvert ? (
                        <View style={styles.timeRow}>
                          <Pressable
                            style={[styles.timeChip, dayStyle]}
                            onPress={() => openPicker({ jour: d.jour, field: 'ouverture', value: d.ouverture })}
                            accessibilityRole="button"
                            accessibilityLabel={`${DAY_NAMES[d.jour]} — heure d'ouverture`}>
                            <Clock size={13} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                            <ThemedText style={[styles.timeChipTxt, { color: colors.primary }]}>
                              {hourFromDate(d.ouverture)}
                            </ThemedText>
                          </Pressable>
                          <ThemedText style={[styles.timeSep, { color: colors.textMuted }]}>—</ThemedText>
                          <Pressable
                            style={[styles.timeChip, dayStyle]}
                            onPress={() => openPicker({ jour: d.jour, field: 'fermeture', value: d.fermeture })}
                            accessibilityRole="button"
                            accessibilityLabel={`${DAY_NAMES[d.jour]} — heure de fermeture`}>
                            <Clock size={13} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                            <ThemedText style={[styles.timeChipTxt, { color: colors.primary }]}>
                              {hourFromDate(d.fermeture)}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <ThemedText style={[styles.closedTxt, { color: colors.textMuted }]}>Fermé</ThemedText>
                      )}
                    </View>
                    <Switch
                      value={d.ouvert}
                      onValueChange={(v) => updateDay(d.jour, { ouvert: v })}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={colors.borderStrong}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Résumé de la semaine */}
        <View style={[styles.summaryRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Calendar size={15} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.summaryTxt, { color: colors.textSecondary }]} numberOfLines={2}>
            {summary}
          </ThemedText>
        </View>
      </ScrollView>

      {/* Barre d'enregistrement fixe */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}>
        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.errorSoft }]}>
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: saving || loading ? colors.borderStrong : colors.primary },
            pressed && styles.pressedDim,
          ]}
          disabled={saving || loading}
          onPress={() => void save()}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.saveText}>
                {loading
                  ? 'Chargement…'
                  : openCount > 0
                    ? `Enregistrer · ${openCount} jour${openCount > 1 ? 's' : ''}`
                    : 'Enregistrer'}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Android: native clock dialog (no Modal needed) ── */}
      {IS_ANDROID && androidPicker ? (
        <DateTimePicker
          value={androidPicker.value}
          mode="time"
          is24Hour
          display="default"
          accentColor={colors.primary}
          onChange={handleAndroidChange}
        />
      ) : null}

      {/* ── iOS: spinner inside a bottom sheet Modal ── */}
      {!IS_ANDROID && (
        <Modal visible={iosPicker !== null} transparent animationType="fade" onRequestClose={closeIosPicker}>
          <Pressable style={styles.modalBackdrop} onPress={closeIosPicker} />
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border },
            ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            <ThemedText style={[styles.sheetTitle, { color: colors.text }]}>
              {iosPicker
                ? `${DAY_NAMES[iosPicker.jour]} · ${iosPicker.field === 'ouverture' ? 'Ouverture' : 'Fermeture'}`
                : ''}
            </ThemedText>
            {iosPicker ? (
              <DateTimePicker
                value={pendingTime ?? iosPicker.value}
                mode="time"
                is24Hour
                display="spinner"
                accentColor={colors.primary}
                onChange={(_event, date) => {
                  if (date) setPendingTime(date);
                }}
              />
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable
                style={[styles.sheetCancel, { borderColor: colors.border }]}
                onPress={closeIosPicker}
                accessibilityRole="button"
                accessibilityLabel="Annuler">
                <X size={17} color={colors.textSecondary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.sheetCancelTxt, { color: colors.textSecondary }]}>Annuler</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.sheetDone, { backgroundColor: colors.primary }]}
                onPress={() => applyIosPicker()}
                accessibilityRole="button"
                accessibilityLabel="Valider l'heure">
                <ThemedText style={styles.sheetDoneText}>Valider</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 18, gap: 12 },
  pressedDim: { opacity: 0.82 },

  /* Pastille de statut du header */
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillTxt: { fontSize: 12.5, fontWeight: '800' },

  /* Carte d'aperçu client */
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  previewIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: { flex: 1, gap: 3 },
  previewTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  previewSub: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },

  warnBanner: { padding: 12, borderRadius: 14, borderWidth: 1 },
  warnText: { fontSize: 12.5, fontWeight: '800', lineHeight: 18 },

  quickRow: { flexDirection: 'row', gap: 10 },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickTxt: { fontSize: 14, fontWeight: '800' },

  sectionLabel: { fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },

  center: { paddingVertical: 40, alignItems: 'center' },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dayName: { fontSize: 16, fontWeight: '800' },
  todayPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  todayPillTxt: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeChipTxt: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeSep: { fontSize: 14, fontWeight: '700' },
  closedTxt: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  summaryTxt: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },

  /* Barre d'enregistrement fixe */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  errorBox: { borderRadius: 12, borderWidth: 1, padding: 11 },
  errorText: { fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },

  /* Bottom sheet (iOS only) */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  sheetCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sheetCancelTxt: { fontWeight: '800', fontSize: 15 },
  sheetDone: { flex: 1.6, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  sheetDoneText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
