import { useRouter } from 'expo-router';
import { ChevronLeft, Smartphone } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { CLIENT_PAYMENT_METHODS } from '@/lib/payment-methods';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const bottomPad = Math.max(insets.bottom, 16) + 24;

  return (
    <ThemedView style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]} onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.primaryDeep }]}>Paiement</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {"Sur GoLivra, le règlement des commandes se fait uniquement par Mobile Money : Airtel Money ou MTN Mobile Money. Vous choisissez l'opérateur au moment de valider le panier."}
        </ThemedText>

        {CLIENT_PAYMENT_METHODS.map((m) => (
          <View key={m.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
              <Smartphone size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={[styles.cardTitle, { color: colors.primaryDeep }]}>{m.label}</ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.textMuted }]}>{"Paiement mobile sécurisé via votre compte "}{m.shortLabel}{". Pas de carte bancaire ni paiement en espèces dans l'application."}</ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cardTitle: { fontSize: 15, marginBottom: 6 },
  cardBody: { fontSize: 13, lineHeight: 19 },
});
