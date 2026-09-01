import Constants from 'expo-constants';
import { useRouter } from '@/hooks/use-safe-router';
import { SITE_URLS } from '@/lib/config';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Info,
  Shield,
} from 'lucide-react-native';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

const PRIVACY_URL = SITE_URLS.privacy;
const TERMS_URL = SITE_URLS.terms;
const WEBSITE_URL = SITE_URLS.home;
const ABOUT_URL = SITE_URLS.about;

export default function LegalInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          Informations légales
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>

        {/* ── Documents légaux ── */}
        <ThemedText style={styles.sectionLabel}>Documents</ThemedText>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<Shield size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Politique de confidentialité"
            subtitle="Comment nous protégeons vos données"
            onPress={() => Linking.openURL(PRIVACY_URL)}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<FileText size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Conditions générales d'utilisation"
            subtitle="Termes et conditions d'utilisation"
            onPress={() => Linking.openURL(TERMS_URL)}
            colors={colors}
          />
        </View>

        {/* ── À propos ── */}
        <ThemedText style={styles.sectionLabel}>À propos de GoLivra</ThemedText>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<Info size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Notre mission"
            subtitle="Découvrez GoLivra et son équipe"
            onPress={() => Linking.openURL(ABOUT_URL)}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<Globe size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Site web"
            subtitle="Site officiel GoLivra"
            onPress={() => Linking.openURL(WEBSITE_URL)}
            colors={colors}
          />
          <View style={styles.divider} />
          <MenuRow
            icon={<BookOpen size={20} color={colors.primary} strokeWidth={LUCIDE_STROKE} />}
            iconBg={colors.primarySoft}
            title="Blog"
            subtitle="Actualités et conseils"
            onPress={() => Linking.openURL(SITE_URLS.blog)}
            colors={colors}
          />
        </View>

        {/* ── Version ── */}
        <View style={styles.versionBlock}>
          <ThemedText type="muted" style={styles.versionText}>
            GoLivra {appVersion}
          </ThemedText>
          <ThemedText type="muted" style={styles.versionSub}>
            by Synex
          </ThemedText>
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
  versionBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  versionText: { fontSize: 13, fontWeight: '600' },
  versionSub: { fontSize: 12 },
});
