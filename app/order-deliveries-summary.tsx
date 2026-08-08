import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Check, Package, Store, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GOLIVRA_BRAND_SHADOW } from '@/constants/app-palette';
import { formatHumanMinutes } from '@/lib/format';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

type DeliveryRow = {
  enterpriseNom: string;
  minutesEstimate: number;
  kind: 'restaurant' | 'boutique' | 'commerce';
};

function iconFor(kind: DeliveryRow['kind'], color: string) {
  if (kind === 'restaurant') return <UtensilsCrossed size={22} color={color} strokeWidth={LUCIDE_STROKE} />;
  if (kind === 'boutique') return <Store size={22} color={color} strokeWidth={LUCIDE_STROKE} />;
  return <Package size={22} color={color} strokeWidth={LUCIDE_STROKE} />;
}

function normalizeParam(data: string | string[] | undefined): string | undefined {
  if (data === undefined) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

function parseRows(data: string | undefined): DeliveryRow[] | null {
  if (!data || typeof data !== 'string') return null;
  try {
    const decoded = decodeURIComponent(data);
    const raw = JSON.parse(decoded) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: DeliveryRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.enterpriseNom !== 'string') continue;
      const minutes = Number(o.minutesEstimate);
      const k = o.kind;
      const kind: DeliveryRow['kind'] =
        k === 'restaurant' || k === 'boutique' || k === 'commerce' ? k : 'commerce';
      out.push({
        enterpriseNom: o.enterpriseNom,
        minutesEstimate: Number.isFinite(minutes) ? Math.max(5, Math.floor(minutes)) : 30,
        kind,
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export default function OrderDeliveriesSummaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const raw = useLocalSearchParams<{ data?: string | string[] }>().data;
  const data = useMemo(() => normalizeParam(raw), [raw]);

  const rows = useMemo(() => parseRows(data), [data]);

  useEffect(() => {
    if (!rows) {
      router.replace('/(tabs)/explore');
    }
  }, [rows, router]);

  if (!rows) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.center}>
          <ThemedText style={styles.muted}>Redirection…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const n = rows.length;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.successBadge, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
          <Check size={32} color={colors.success} strokeWidth={LUCIDE_STROKE + 0.5} />
        </View>
        <ThemedText type="title" style={[styles.title, { color: colors.primaryDeep }]}>
          Commande confirmée
        </ThemedText>
        <ThemedText style={[styles.sub, { color: colors.textSecondary }]}>
          {n === 1
            ? 'Votre commande est en cours de traitement.'
            : `Votre commande est divisée en ${n} livraisons :`}
        </ThemedText>

        <View style={styles.list}>
          {rows.map((row, i) => (
            <View
              key={`${row.enterpriseNom}-${i}`}
              style={[
                styles.rowCard,
                { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: GOLIVRA_BRAND_SHADOW },
              ]}>
              {iconFor(row.kind, colors.primary)}
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                  {row.enterpriseNom}
                </ThemedText>
                <ThemedText style={[styles.eta, { color: colors.textMuted }]}>
                  🛵 Livraison prévue dans environ {formatHumanMinutes(row.minutesEstimate)}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <ThemedText style={[styles.hint, { color: colors.textMuted }]}>
          Vous êtes informé en temps réel dès qu’un commerce accepte ou prépare votre commande.
        </ThemedText>

        <Pressable
          style={[styles.primary, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)/explore')}
          android_ripple={{ color: colors.primaryMuted }}>
          <ThemedText style={[styles.primaryTxt, { color: colors.onPrimary }]}>Continuer</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { fontSize: 14 },
  scroll: { paddingHorizontal: 16 },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 22 },
  list: { gap: 12, marginBottom: 20 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rowTitle: { fontSize: 16 },
  eta: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  primary: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryTxt: { fontWeight: '800', fontSize: 16 },
});
