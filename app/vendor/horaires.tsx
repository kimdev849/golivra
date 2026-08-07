import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, CheckCircle2, Clock, Info, Power, Sunrise } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { getSessionToken } from '@/lib/auth';
import { showToast } from '@/lib/app-toast';
import {
  fetchEnterpriseHoraires,
  saveEnterpriseHoraires,
  type EnterpriseHoraires,
} from '@/lib/enterprise';
import { useVendor } from '@/contexts/vendor-context';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

type DayState = {
  jour: number;
  ouvert: boolean;
  ouverture: Date;
  fermeture: Date;
};

type PickerTarget = { jour: number; field: 'ouverture' | 'fermeture'; value: Date } | null;

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

export default function VendorHorairesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { shop } = useVendor();
  const params = useLocalSearchParams<{ id?: string }>();
  const enterpriseId = typeof params.id === 'string' && params.id ? params.id : shop?.id || '';

  const [days, setDays] = useState<DayState[]>(defaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
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

  const applyPicker = useCallback(
    (date: Date) => {
      if (!picker) return;
      updateDay(picker.jour, { [picker.field]: date });
      setPicker(null);
    },
    [picker, updateDay],
  );

  const allOpen = () => setDays(defaultDays());
  const allClosed = () =>
    setDays(DAY_NAMES.map((_, jour) => ({ jour, ouvert: false, ouverture: new Date(2000, 0, 1, 9, 0), fermeture: new Date(2000, 0, 1, 22, 0) })));

  const openCount = days.filter((d) => d.ouvert).length;

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
      setError(e instanceof Error ? e.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          Horaires d&apos;ouverture
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.infoBanner, { backgroundColor: colors.primarySoft }]}>
          <Info size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
            Vos clients ne peuvent commander que pendant ces horaires. Un commerce sans horaires
            est considéré fermé : les commandes sont bloquées tant qu&apos;elles ne sont pas définies.
          </ThemedText>
        </View>

        {!hasSavedHours && !loading ? (
          <View style={[styles.warnBanner, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <ThemedText style={[styles.warnText, { color: colors.warning }]}>
              ⚠️ Horaires non définis : vous ne recevez aucune commande pour le moment.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          <Pressable style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={allOpen}>
            <Sunrise size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.quickTxt, { color: colors.primary }]}>Tout ouvrir</ThemedText>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={allClosed}>
            <Power size={16} color={colors.error} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.quickTxt, { color: colors.error }]}>Tout fermer</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {days.map((d, i) => {
              const dayStyle = d.ouvert
                ? { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }
                : { backgroundColor: colors.surfaceMuted, borderColor: colors.border };
              return (
                <View key={d.jour}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <View style={styles.dayRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.dayName, { color: d.ouvert ? colors.text : colors.textMuted }]}>
                        {DAY_NAMES[d.jour]}
                      </ThemedText>
                      {d.ouvert ? (
                        <View style={styles.timeRow}>
                          <Pressable
                            style={[styles.timeChip, dayStyle]}
                            onPress={() => setPicker({ jour: d.jour, field: 'ouverture', value: d.ouverture })}>
                            <Clock size={13} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                            <ThemedText style={[styles.timeChipTxt, { color: colors.primary }]}>
                              {hourFromDate(d.ouverture)}
                            </ThemedText>
                          </Pressable>
                          <ThemedText style={[styles.timeSep, { color: colors.textMuted }]}>→</ThemedText>
                          <Pressable
                            style={[styles.timeChip, dayStyle]}
                            onPress={() => setPicker({ jour: d.jour, field: 'fermeture', value: d.fermeture })}>
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
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.error }]}>
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
          </View>
        ) : null}

        <Pressable
          style={[styles.saveBtn, { backgroundColor: saving ? colors.borderStrong : colors.primary }]}
          disabled={saving || loading}
          onPress={() => void save()}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={styles.saveText}>
                Enregistrer {openCount > 0 ? `(${openCount} jour${openCount > 1 ? 's' : ''} ouvert${openCount > 1 ? 's' : ''})` : ''}
              </ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Sélecteur d'heure (bottom sheet) */}
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
          <ThemedText style={[styles.sheetTitle, { color: colors.text }]}>
            {picker ? `${DAY_NAMES[picker.jour]} — ${picker.field === 'ouverture' ? 'Ouverture' : 'Fermeture'}` : ''}
          </ThemedText>
          {picker ? (
            <DateTimePicker
              value={picker.value}
              mode="time"
              is24Hour
              display="spinner"
              accentColor={colors.primary}
              onChange={(event, date) => {
                if (event.type === 'set' && date) applyPicker(date);
                else if (event.type === 'dismissed') setPicker(null);
              }}
            />
          ) : null}
          <Pressable
            style={[styles.sheetDone, { backgroundColor: colors.primary }]}
            onPress={() => picker && applyPicker(picker.value)}>
            <ThemedText style={styles.sheetDoneText}>Valider</ThemedText>
          </Pressable>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: 16, gap: 14 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  warnBanner: { padding: 14, borderRadius: 14, borderWidth: 1 },
  warnText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
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
  center: { paddingVertical: 40, alignItems: 'center' },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dayName: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
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
  errorBox: { borderRadius: 12, borderWidth: 1, padding: 12, backgroundColor: 'rgba(220,38,38,0.06)' },
  errorText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  sheetDone: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  sheetDoneText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
