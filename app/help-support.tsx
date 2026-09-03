import { useRouter } from '@/hooks/use-safe-router';
import { SITE_URL, SITE_URLS } from '@/lib/config';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mail,
  Phone,
  Share2,
  Star,
  Bug,
  ExternalLink,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  Text,
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
    a: "Le paiement se fait uniquement par Mobile Money : Airtel Money ou MTN MoMo. Après acceptation du commerce, vous recevrez une demande de paiement sur votre téléphone.",
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
    a: "Vous pouvez suivre votre commande en temps réel depuis la section « Commandes en cours ». Vous verrez le statut de préparation, l'assignation du livreur et la livraison en direct.",
  },
  {
    q: 'Comment annuler une commande ?',
    a: "Vous pouvez annuler une commande tant qu'elle n'est pas encore en cours de livraison. Allez dans « Mes commandes », sélectionnez la commande et appuyez sur « Annuler ».",
  },
  {
    q: 'Comment modifier mon adresse de livraison ?',
    a: "Allez dans « Mon profil » → « Mes adresses ». Vous pouvez ajouter, modifier ou supprimer des adresses. Sélectionnez l'adresse par défaut pour vos prochaines commandes.",
  },
  {
    q: "Je n'ai pas reçu ma commande, que faire ?",
    a: "Contactez notre support via WhatsApp ou email. Nous vérifierons le statut de votre commande et organiserons une livraison alternative ou un remboursement si nécessaire.",
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvrez GoLivra 🚀\nLa meilleure application de livraison et marketplace.\n\nTéléchargez-la ici : ${SITE_URL}`,
        title: 'Partager GoLivra',
      });
    } catch { /* cancelled */ }
  };

  const handleRate = async () => {
    try { await Linking.openURL(SITE_URL); } catch { /* ignore */ }
  };

  const handleContactEmail = () => {
    Linking.openURL(`mailto:${SITE_URLS.supportEmail}?subject=Support GoLivra`);
  };

  const handleWhatsApp = () => {
    Linking.openURL(`${SITE_URLS.whatsapp}?text=Bonjour, j'ai besoin d'aide`);
  };

  const handleReportBug = () => {
    Linking.openURL(`mailto:${SITE_URLS.supportEmail}?subject=Signaler un bug&body=Décrivez le bug rencontré :`);
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Aide & support
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>

        {/* ── Contact rapide ── */}
        <ThemedText style={styles.sectionLabel}>Contact rapide</ThemedText>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<Image source={require('@/assets/images/logo.whastapp.png')} style={styles.whatsappLogo} contentFit="contain" cachePolicy="memory-disk" />}
            iconBg="transparent"
            title="WhatsApp"
            subtitle="Réponse rapide, 7j/7"
            onPress={handleWhatsApp}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<Mail size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="E-mail"
            subtitle={SITE_URLS.supportEmail}
            onPress={handleContactEmail}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<Phone size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Téléphone"
            subtitle="Contactez-nous directement"
            onPress={() => Linking.openURL(`tel:${SITE_URLS.supportPhone}`)}
            colors={colors}
          />
        </View>

        {/* ── FAQ ── */}
        <ThemedText style={styles.sectionLabel}>Questions fréquentes</ThemedText>
        <View style={styles.menuCard}>
          {FAQ.map((item, idx) => {
            const expanded = expandedFaq === idx;
            return (
              <View key={idx}>
                <Pressable
                  style={({ pressed }) => [
                    styles.faqRow,
                    pressed && { backgroundColor: colors.primarySoft },
                  ]}
                  onPress={() => setExpandedFaq(expanded ? null : idx)}>
                  <View style={[styles.faqIcon, { backgroundColor: colors.primarySoft }]}>
                    <HelpCircle size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
                  </View>
                  <Text style={[styles.faqQuestion, { color: colors.text }]} numberOfLines={2}>
                    {item.q}
                  </Text>
                  {expanded ? (
                    <ChevronUp size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                  ) : (
                    <ChevronDown size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
                  )}
                </Pressable>
                {expanded ? (
                  <View style={styles.faqAnswer}>
                    <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>
                      {item.a}
                    </Text>
                  </View>
                ) : null}
                {idx < FAQ.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
        </View>

        {/* ── Autres actions ── */}
        <ThemedText style={styles.sectionLabel}>Autres</ThemedText>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<Bug size={20} color={colors.error} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.errorSoft}
            title="Signaler un problème"
            subtitle="Besoin d'aide urgent ?"
            onPress={handleReportBug}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<Share2 size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Partager GoLivra"
            subtitle="Recommandez à vos amis"
            onPress={handleShare}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<Star size={20} color="#F5A524" strokeWidth={LUCIDE_STROKE} />}
            iconBg="#FEF3C7"
            title="Noter l'application"
            subtitle="Donnez-nous 5 étoiles ⭐"
            onPress={handleRate}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<ExternalLink size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Site web"
            subtitle="Site officiel GoLivra"
            onPress={() => Linking.openURL(SITE_URLS.home)}
            colors={colors}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function MenuRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  colors,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}>
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.menuSub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B6B45',
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
    marginLeft: 2,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowPressed: { opacity: 0.82 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 14, fontWeight: '600' },
  menuSub: { fontSize: 12, marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  faqIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  faqAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingLeft: 62,
  },
  whatsappLogo: {
    width: 22,
    height: 22,
  },
  faqAnswerText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
