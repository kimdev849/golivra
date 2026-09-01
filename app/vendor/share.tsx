import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from '@/hooks/use-safe-router';
import { Copy, Share2, ExternalLink, CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VendorScreenHeader } from '@/components/vendor-screen-header';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { useVendorTheme } from '@/hooks/use-vendor-theme';
import { useGuardedCallback } from '@/hooks/use-guarded-callback';
import { useVendor } from '@/contexts/vendor-context';
import { showToast } from '@/lib/app-toast';

/** Build the public marketplace URL for this shop. */
function buildShopUrl(shopId: string): string {
  // Web URL — opens in browser for clients
  const webBase = Platform.select({
    android: 'https://golivra.com',
    ios: 'https://golivra.com',
    default: 'https://golivra.com',
  });
  return `${webBase}/marketplace/${shopId}`;
}

/** Simple deterministic QR code SVG via a public API. */
function qrCodeUrl(data: string, size = 280): string {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10&format=png`;
}

export default function VendorShareScreen() {
  const insets = useSafeAreaInsets();
  const guarded = useGuardedCallback();
  const colors = useAppColors();
  const router = useRouter();
  const { shop } = useVendor();
  const { palette } = useVendorTheme();
  const [copied, setCopied] = useState(false);

  const shopUrl = buildShopUrl(shop?.id ?? '');
  const qrUrl = qrCodeUrl(shopUrl);
  const shopName = shop?.nom || 'Mon commerce';

  const handleShare = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share(
        {
          message: `Découvrez ${shopName} sur GoLivra ! 🛒\n\n${shopUrl}`,
          title: `Partager ${shopName}`,
          url: Platform.OS === 'ios' ? shopUrl : undefined,
        },
        { dialogTitle: `Partager ${shopName}` },
      );
    } catch {
      // user cancelled
    }
  };

  const handleCopyLink = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // expo-clipboard not installed — use Clipboard API via Share as fallback
      await Share.share({ message: shopUrl, url: Platform.OS === 'ios' ? shopUrl : undefined });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled
    }
  };

  const handleOpenInBrowser = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Use Linking to open in browser
    import('expo-linking').then(({ openURL }) => {
      openURL(shopUrl).catch(() => {});
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <VendorScreenHeader title="Partager ma boutique" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
        {/* Shop info */}
        <View style={[styles.shopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.shopAvatar, { backgroundColor: palette.primarySoft, borderColor: palette.primary }]}>
            <ThemedText style={[styles.shopInitial, { color: palette.primary }]}>
              {shopName.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" style={[styles.shopName, { color: colors.text }]}>
              {shopName}
            </ThemedText>
            <ThemedText style={[styles.shopType, { color: colors.textMuted }]}>
              {shop?.type === 'restaurant' ? 'Restaurant' : 'Boutique'} · GoLivra
            </ThemedText>
          </View>
        </View>

        {/* QR Code */}
        <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>QR Code</ThemedText>
        <View style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.qrHint, { color: colors.textMuted }]}>
            Scannez pour ouvrir la page de votre boutique
          </ThemedText>
          <View style={[styles.qrWrap, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
            <Image
              source={{ uri: qrUrl }}
              style={styles.qrImage}
              contentFit="contain"
              transition={300}
            />
          </View>
          <ThemedText style={[styles.qrUrl, { color: colors.textMuted }]} numberOfLines={2}>
            {shopUrl}
          </ThemedText>
        </View>

        {/* Share link */}
        <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Lien de partage</ThemedText>
        <View style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.linkUrl, { color: colors.text }]} numberOfLines={2}>
            {shopUrl}
          </ThemedText>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, { backgroundColor: palette.primary }, pressed && styles.pressedDim]}
            onPress={() => guarded(() => void handleShare())}
            accessibilityRole="button">
            <Share2 size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={styles.shareBtnText}>Partager</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, pressed && styles.pressedDim]}
            onPress={() => guarded(() => void handleCopyLink())}
            accessibilityRole="button">
            {copied ? (
              <CheckCircle2 size={18} color={colors.success} strokeWidth={LUCIDE_STROKE} />
            ) : (
              <Copy size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            )}
            <ThemedText style={[styles.secondaryBtnText, { color: copied ? colors.success : colors.text }]}>
              {copied ? 'Copié !' : 'Copier le lien'}
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, pressed && styles.pressedDim]}
            onPress={handleOpenInBrowser}
            accessibilityRole="button">
            <ExternalLink size={18} color={colors.text} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.secondaryBtnText, { color: colors.text }]}>Ouvrir dans le navigateur</ThemedText>
          </Pressable>
        </View>

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <ThemedText style={[styles.tipsTitle, { color: colors.primary }]}>💡 Comment partager ?</ThemedText>
          <ThemedText style={[styles.tipsText, { color: colors.textSecondary }]}>
            • Imprimez le QR code et placez-le sur votre devanture{'\n'}
            • Partagez le lien par SMS ou WhatsApp{'\n'}
            • Ajoutez-le à votre compte Instagram / Facebook
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 18, gap: 12 },

  // Shop card
  shopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1,
  },
  shopAvatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  shopInitial: { fontSize: 22, fontWeight: '900' },
  shopName: { fontSize: 17, fontWeight: '800' },
  shopType: { fontSize: 13, marginTop: 2 },

  // QR
  sectionLabel: { fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  qrCard: {
    alignItems: 'center', gap: 14,
    padding: 20, borderRadius: 18, borderWidth: 1,
  },
  qrHint: { fontSize: 13, fontWeight: '600' },
  qrWrap: {
    width: 200, height: 200, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, overflow: 'hidden',
  },
  qrImage: { width: 180, height: 180 },
  qrUrl: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

  // Link
  linkCard: {
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  linkUrl: { fontSize: 14, fontWeight: '600' },

  // Actions
  actions: { gap: 10, marginTop: 4 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  shareBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  secondaryBtnText: { fontWeight: '800', fontSize: 15 },
  pressedDim: { opacity: 0.85 },

  // Tips
  tipsCard: {
    padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 4,
  },
  tipsTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  tipsText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
});
