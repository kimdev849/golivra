import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Package, Store, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

export default function HowMultiDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <ThemedText style={[styles.back, { color: colors.primary }]}>← Retour</ThemedText>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={[styles.title, { color: colors.primaryDeep }]}>
          Livraisons multiples
        </ThemedText>
        <ThemedText style={[styles.lead, { color: colors.textSecondary }]}>
          Chaque commerce est livré séparément par son propre livreur.
        </ThemedText>

        <ThemedText type="defaultSemiBold" style={[styles.exampleTitle, { color: colors.primaryDeep }]}>
          Exemple
        </ThemedText>
        <View style={[styles.exampleBox, { borderColor: colors.border, backgroundColor: colors.primarySoft }]}>
          <Row icon={<UtensilsCrossed size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />} text="Restaurant A → ~25 min" />
          <View style={[styles.div, { backgroundColor: colors.border }]} />
          <Row icon={<Store size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />} text="Boutique B → ~35 min" />
          <View style={[styles.div, { backgroundColor: colors.border }]} />
          <Row icon={<Package size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />} text="Autre commerce → ~45 min" />
        </View>

        <ThemedText style={[styles.note, { color: colors.textMuted }]}>
          Les frais de livraison de chaque commerce s’additionnent dans votre panier.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Row({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.row}>
      {icon}
      <ThemedText style={styles.rowText} type="defaultSemiBold">
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 8 },
  back: { fontSize: 16, fontWeight: '700' },
  scroll: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  exampleTitle: { fontSize: 15, marginBottom: 10, marginTop: 4 },
  exampleBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowText: { flex: 1, fontSize: 15 },
  div: { height: StyleSheet.hairlineWidth, marginLeft: 32 },
  note: { fontSize: 13, lineHeight: 19 },
});
