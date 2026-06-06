import { Wallet } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';

export default function VendorShopPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { palette } = useVendorTheme();

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Moyens de paiement" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <Wallet size={28} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
          <ThemedText type="defaultSemiBold" style={[styles.title, { color: colors.text }]}>Paiements clients</ThemedText>
          <ThemedText style={[styles.body, { color: colors.textMuted }]}>{"Les commandes utilisent les méthodes définies au moment du paiement (espèces, Mobile Money, etc.). Il n'y a pas de compte bancaire boutique séparé dans le schéma actuel."}</ThemedText>
          <ThemedText style={[styles.body, { color: colors.textMuted }]}>{"Le solde vendeur et l'historique sont disponibles dans l'écran Portefeuille, basés sur les commandes livrées réelles."}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  box: { borderRadius: 14, borderWidth: 1, padding: 18, gap: 12 },
  title: { fontSize: 17 },
  body: { fontSize: 14, lineHeight: 21 },
});
