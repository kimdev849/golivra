import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Headphones,
  Mail,
  MessageCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

const FAQ = [
  {
    q: 'Comment passer une commande ?',
    a: "Choisissez un restaurant ou une boutique, ajoutez vos articles au panier, puis validez en renseignant votre adresse de livraison. Le délai de préparation est indiqué sur la fiche du commerce.",
  },
  {
    q: 'Quels moyens de paiement sont acceptés ?',
    a: "Le paiement se fait uniquement par Mobile Money : Airtel Money ou MTN MoMo. Après acceptation du commerce, vous recevrez une demande de paiement sur votre téléphone. Aucun paiement en espèces n'est accepté. Le débit a lieu au moment de la validation.",
  },
  {
    q: 'Combien coûte la livraison ?',
    a: "Les frais de livraison dépendent de votre zone (arrondissement). Le montant exact est calculé automatiquement selon votre adresse et affiché avant la validation. Le tarif de base est de 500 FCFA.",
  },
  {
    q: 'Quel est le délai de livraison ?',
    a: "Le délai total dépend du temps de préparation du commerce (10 à 30 min) et de la distance. Une estimation est affichée sur la fiche du commerce et dans votre panier.",
  },
  {
    q: 'Comment suivre ma commande ?',
    a: "Ouvrez l'onglet Commandes puis la commande concernée : vous y verrez le suivi en temps réel, du restaurant à la livraison. Vous pouvez contacter le livreur directement.",
  },
  {
    q: 'Puis-je annuler ma commande ?',
    a: "Oui, tant que le commerce ne l'a pas acceptée. Après acceptation, contactez le support pour une annulation. Le remboursement dépend du statut.",
  },
  {
    q: 'Comment modifier mon adresse ?',
    a: "Depuis votre profil, touchez Mes adresses. Vous pouvez ajouter, modifier ou supprimer des adresses. Sélectionnez l'adresse principale pour vos commandes.",
  },
  {
    q: 'Un problème avec une commande ?',
    a: "Contactez le support à support@golivra.cg avec votre numéro de commande. Nous vous répondrons rapidement.",
  },
] as const;

export default function HelpCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [open, setOpen] = useState<number | null>(0);

  const bottomPad = Math.max(insets.bottom, 16) + 24;

  return (
    <ThemedView style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 12),
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}>
        <Pressable
          style={[
            styles.backBtn,
            { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
          ]}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour">
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: colors.primaryDeep }]}>
          {"Centre d’aide"}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {"Questions fréquentes et canaux pour joindre l’équipe GoLivra."}
        </ThemedText>

        {/* ── Contacter le support ── */}
        <View
          style={[
            styles.contactCard,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
          ]}>
          <ThemedText type="defaultSemiBold" style={[styles.contactTitle, { color: colors.text }]}>
            Contacter le support
          </ThemedText>
          <Pressable
            style={styles.contactRow}
            onPress={() => void Linking.openURL('mailto:support@golivra.cg')}>
            <Mail size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactLink, { color: colors.primary }]}>
              support@golivra.cg
            </ThemedText>
          </Pressable>
          <View style={styles.contactRow}>
            <Headphones size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactMuted, { color: colors.textMuted }]}>
              Support téléphonique : bientôt disponible
            </ThemedText>
          </View>
          <View style={styles.contactRow}>
            <MessageCircle size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactMuted, { color: colors.textMuted }]}>
              WhatsApp : bientôt disponible
            </ThemedText>
          </View>
        </View>

        {/* ── FAQ ── */}
        <ThemedText type="defaultSemiBold" style={[styles.faqSection, { color: colors.text }]}>
          FAQ
        </ThemedText>

        {FAQ.map((item, i) => {
          const expanded = open === i;
          return (
            <View
              key={item.q}
              style={[
                styles.faqItem,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}>
              <Pressable
                style={styles.faqHead}
                onPress={() => setOpen(expanded ? null : i)}
                android_ripple={{ color: colors.primarySoft }}>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.faqQ, { color: colors.text }]}>
                  {item.q}
                </ThemedText>
                {expanded ? (
                  <ChevronUp size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                ) : (
                  <ChevronDown size={22} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                )}
              </Pressable>
              {expanded ? (
                <ThemedText style={[styles.faqA, { color: colors.textSecondary }]}>
                  {item.a}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
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
