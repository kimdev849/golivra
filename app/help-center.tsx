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
    q: 'Comment suivre ma commande ?',
    a: "Ouvrez l'onglet Commandes puis la commande concernée : vous y verrez le suivi en temps réel, du restaurant à la livraison.",
  },
  {
    q: 'Comment passer une commande ?',
    a: "Choisissez un restaurant ou une boutique, ajoutez vos articles au panier, puis validez en renseignant votre adresse de livraison.",
  },
  {
    q: 'Quels moyens de paiement sont acceptés ?',
    a: "Le paiement à la livraison est disponible. D'autres moyens de paiement seront ajoutés progressivement.",
  },
  {
    q: 'Comment modifier mes informations ?',
    a: "Depuis votre profil, touchez « Modifier le profil » pour changer votre nom, votre photo ou vos coordonnées.",
  },
  {
    q: 'Un problème avec une commande livrée ?',
    a: "Contactez le support avec votre numéro de commande : nous vous répondrons rapidement.",
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
          <Pressable
            style={styles.contactRow}
            onPress={() => void Linking.openURL('tel:+242000000000')}>
            <Headphones size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.contactLink, { color: colors.primary }]}>
              +242 XX XXX XXXX
            </ThemedText>
          </Pressable>
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
