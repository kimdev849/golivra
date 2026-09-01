import { useRouter } from '@/hooks/use-safe-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft, Type } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemeModePicker } from '@/components/theme-mode-picker';
import { BiometricLockToggle } from '@/components/biometric-lock-toggle';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourierPalette } from '@/lib/courier-theme';
import { useTextScale, TEXT_SCALE_OPTIONS, type TextScaleKey } from '@/contexts/text-scale-context';

export default function CourierSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { key: textScaleKey, setKey: setTextScaleKey } = useTextScale();

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <Pressable style={[styles.back, { backgroundColor: palette.primarySoft }]} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: palette.primaryDeep }]}>Paramètres</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>

        {/* ── Apparence ── */}
        <ThemedText style={[styles.section, { color: palette.primaryDeep }]}>Apparence</ThemedText>
        <ThemeModePicker
          palette={palette}
          title="Mode clair / sombre"
          hint="L'apparence s'applique à tout l'espace livreur."
        />

        {/* ── Taille du texte ── */}
        <View style={[styles.menuCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: palette.primarySoft }]}>
              <Type size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.rowTitle, { color: palette.text }]}>Taille du texte</ThemedText>
              <ThemedText style={[styles.rowSub, { color: palette.muted }]}>
                Affichez les textes plus petits ou plus grands
              </ThemedText>
            </View>
          </View>
          <View style={[styles.segmented, { backgroundColor: palette.pillOff }]}>
            {TEXT_SCALE_OPTIONS.map((opt) => {
              const active = textScaleKey === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.segment, active && { backgroundColor: palette.primary }]}
                  onPress={() => setTextScaleKey(opt.key as TextScaleKey)}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.segmentTxt, { color: active ? '#FFFFFF' : palette.textSecondary }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Sécurité (biométrie) ── */}
        <ThemedText style={[styles.section, { color: palette.primaryDeep }]}>Sécurité</ThemedText>
        <View style={[styles.menuCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <BiometricLockToggle
            colors={{
              primary: palette.primary,
              primaryMuted: palette.primaryMuted,
              primarySoft: palette.primarySoft,
              surfaceElevated: palette.surfaceElevated,
              borderStrong: palette.trackStroke,
              text: palette.text,
              textMuted: palette.muted,
            }}
            cardBackground={palette.card}
            cardBorder={palette.border}
            hint="Déverrouillez l'app avec votre empreinte ou visage (optionnel, désactivable à tout moment)"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '800', fontSize: 17 },
  scroll: { padding: 16, gap: 14 },
  section: { fontWeight: '900', fontSize: 14, marginBottom: -4 },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentTxt: { fontSize: 13 },
});
