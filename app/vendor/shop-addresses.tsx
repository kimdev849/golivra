import { useRouter } from '@/hooks/use-safe-router';
import { MapPin } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendor } from '@/contexts/vendor-context';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { formatDeliveryAddressText } from '@/lib/format-address';
import { VENDOR_HREF } from '@/lib/vendor-nav';

export default function VendorShopAddressesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useAppColors();
  const { shop } = useVendor();
  const { palette, commerceType } = useVendorTheme();

  const summary = shop && formatDeliveryAddressText({ quartier: shop.adresse_quartier || '', ligne1: shop.adresse || '', ville: shop.adresse_ville || 'Brazzaville', pays: 'Congo' });

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Adresse du commerce" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <ThemedText style={[styles.intro, { color: colors.textMuted }]}>
          {commerceType === 'restaurant'
            ? 'Votre adresse principale (siège) est utilisée pour les livraisons sur place.'
            : "Boutique en ligne ? L'adresse est optionnelle — renseignez-la uniquement si vous recevez des clients sur place."}
        </ThemedText>

        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <MapPin size={22} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.t, { color: colors.text }]}>Adresse principale</ThemedText>
            <ThemedText style={[styles.a, { color: colors.textMuted }]}>{summary && summary.length > 3 ? summary : 'Aucune adresse enregistrée. Complétez la fiche commerce.'}</ThemedText>
          </View>
        </View>

        <Pressable style={[styles.editBtn, { borderColor: palette.primary, backgroundColor: colors.surface }]} onPress={() => router.push(VENDOR_HREF.shopInfo)}>
          <ThemedText style={[styles.editTxt, { color: palette.primaryDeep }]}>{"Modifier l'adresse"}</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: 'flex-start' },
  t: { fontSize: 15 },
  a: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  editBtn: { marginTop: 20, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  editTxt: { fontWeight: '800', fontSize: 15 },
});
