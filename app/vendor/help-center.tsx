import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, Headphones, Mail, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';

import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

const FAQ = [
  {
    q: 'Comment accepter ou refuser une commande ?',
    a: 'Dans l\'onglet Commandes, ouvrez la fiche : vous pouvez changer le statut (accepter, en préparation, prête, etc.) selon les actions proposées.',
  },
  {
    q: 'Que faire si un produit est en rupture ?',
    a: 'Mettez le stock à jour dans Produits ou contactez le client via les coordonnées fournies sur la commande pour proposer un remplacement.',
  },
  {
    q: 'Comment sont calculées les commissions ?',
    a: 'Les règles de commission et de reversement sont définies dans votre contrat partenaire. Un détail sera disponible ici une fois branché sur la facturation réelle.',
  },
  {
    q: 'Un livreur n\'est pas encore assigné',
    a: 'GoLivra assigne un livreur disponible près de votre zone. Si le délai dépasse l\'estimation, contactez le support avec le numéro de commande.',
  },
] as const;

export default function VendorHelpCenterScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="CENTRE D'AIDE" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {"Questions fréquentes et canaux pour joindre l'équipe GoLivra."}
        </ThemedText>

        <View style={[styles.contactCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <ThemedText type="defaultSemiBold" style={[styles.contactTitle, { color: colors.text }]}>
            Contacter le support
          </ThemedText>
          <Pressable
            style={styles.contactRow}
            onPress={() => void Linking.openURL('mailto:support@golivra.cg')}>
            <Mail size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactLink, { color: colors.primary }]}>support@golivra.cg</ThemedText>
          </Pressable>
          <Pressable style={styles.contactRow} onPress={() => void Linking.openURL('tel:+242000000000')}>
            <Headphones size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactLink, { color: colors.primary }]}>+242 XX XXX XXXX</ThemedText>
          </Pressable>
          <View style={styles.contactRow}>
            <MessageCircle size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactMuted, { color: colors.textMuted }]}>WhatsApp : bientôt disponible</ThemedText>
          </View>
        </View>

        <ThemedText type="defaultSemiBold" style={[styles.faqSection, { color: colors.text }]}>
          FAQ
        </ThemedText>

        {FAQ.map((item, i) => {
          const expanded = open === i;
          return (
            <View key={item.q} style={[styles.faqItem, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable
                style={styles.faqHead}
                onPress={() => setOpen(expanded ? null : i)}
                android_ripple={{ color: colors.primarySoft }}>
                <ThemedText type="defaultSemiBold" style={[styles.faqQ, { color: colors.text }]}>
                  {item.q}
                </ThemedText>
                {expanded ? (
                  <ChevronUp size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                ) : (
                  <ChevronDown size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                )}
              </Pressable>
              {expanded ? <ThemedText style={[styles.faqA, { color: colors.textSecondary }]}>{item.a}</ThemedText> : null}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  contactCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 22,
    gap: 12,
  },
  contactTitle: { fontSize: 16, marginBottom: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactLink: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  contactMuted: { fontSize: 14 },
  faqSection: { fontSize: 16, marginBottom: 10 },
  faqItem: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  faqQ: { flex: 1, fontSize: 15, lineHeight: 21 },
  faqA: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    fontSize: 14,
    lineHeight: 21,
  },
});
