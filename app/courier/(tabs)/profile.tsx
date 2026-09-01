import { useRouter } from '@/hooks/use-safe-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bike,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Lock,
  LogOut,
  Phone,
  Settings,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react-native';

import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { useCourierPalette } from '@/lib/courier-theme';
import { resolveRemoteImageUrl } from '@/lib/images';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useLogout } from '@/hooks/use-logout';

// ─── Cellule stats ────────────────────────────────────────────────

function StatCell({
  Icon,
  value,
  label,
  palette,
  color,
}: {
  Icon: LucideIcon;
  value: number | string;
  label: string;
  palette: ReturnType<typeof useCourierPalette>;
  color: string;
}) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIconWrap, { backgroundColor: color }]}>
        <Icon size={15} color="#FFFFFF" strokeWidth={2.4} />
      </View>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

// ─── Ligne du menu ─────────────────────────────────────────────────

function MenuRow({
  Icon,
  title,
  subtitle,
  onPress,
  palette,
  danger,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  palette: ReturnType<typeof useCourierPalette>;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        { backgroundColor: palette.pillOff },
        pressed && styles.menuRowPressed,
      ]}
      onPress={onPress}
      android_ripple={{ color: palette.primarySoft }}>
      <View
        style={[
          styles.menuIconBox,
          { backgroundColor: danger ? palette.dangerBg : palette.primarySoft },
        ]}>
        <Icon
          size={18}
          color={danger ? palette.danger : palette.primaryDeep}
          strokeWidth={LUCIDE_STROKE}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.menuTitle,
            { color: danger ? palette.danger : palette.text },
          ]}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.menuSubtitle, { color: palette.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );
}

export default function CourierProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { profile, setDisponible } = useCourier();

  const { showConfirm, FeedbackOverlay } = useActionFeedback();
  const { performLogout } = useLogout({ clearCart: false });
  const [acting, setActing] = useState(false);

  const confirmLogout = () => {
    showConfirm({
      title: 'Deconnexion',
      message: 'Voulez-vous vraiment vous deconnecter ?',
      primaryLabel: 'Se deconnecter',
      secondaryLabel: 'Annuler',
      danger: true,
      icon: LogOut,
      onPrimary: () => void performLogout(),
    });
  };

  const u = profile?.utilisateur;
  const l = profile?.livreur;
  const avatar = resolveRemoteImageUrl(u?.imageUrl);
  const disponible = Boolean(l?.est_disponible);
  const bottom = Math.max(insets.bottom, 12) + COURIER_TAB_BAR_PADDING_BOTTOM;

  const toggleDispo = async (value: boolean) => {
    setActing(true);
    try {
      await setDisponible(value);
    } finally {
      setActing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <FeedbackOverlay />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>

        {/* ── Hero header ── */}
        <LinearGradient
          colors={[palette.primary, palette.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={[styles.avatarWrap, { borderColor: 'rgba(255,255,255,0.3)' }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <User size={36} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              )}
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroGreeting}>Bonjour,</Text>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {u?.nom || 'Livreur'}
                </Text>
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
              <Text style={styles.heroSub}>
                {l?.type_vehicule || profile?.entreprise?.nom || 'Livreur GoLivra'}
              </Text>
            </View>
          </View>

          {/* ── Dispo inline ── */}
          <View style={styles.heroDispoRow}>
            <View style={[styles.heroDispoDot, { backgroundColor: disponible ? '#4ADE80' : 'rgba(255,255,255,0.3)' }]} />
            <Text style={styles.heroDispoLabel}>{disponible ? 'En ligne' : 'Hors ligne'}</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={disponible}
              disabled={acting}
              onValueChange={(v) => void toggleDispo(v)}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4ADE80' }}
              thumbColor={disponible ? '#FFFFFF' : '#F9FAFB'}
            />
          </View>
        </LinearGradient>

        {/* ── Stats (3 colonnes) ── */}
        <View style={[styles.statsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <StatCell
            Icon={ClipboardList}
            value={profile?.resume?.missions_actives ?? 0}
            label="En cours"
            palette={palette}
            color="#3B82F6"
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <StatCell
            Icon={CalendarDays}
            value={profile?.resume?.missions_aujourdhui ?? 0}
            label="Aujourd'hui"
            palette={palette}
            color="#F59E0B"
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <StatCell
            Icon={Shield}
            value={profile?.resume?.reussies_historique ?? 0}
            label="Reussies"
            palette={palette}
            color="#22C55E"
          />
        </View>

        {/* ── Contact ── */}
        <View style={[styles.contactCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.contactRow}>
            <Phone size={15} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
            <Text style={[styles.contactValue, { color: palette.text }]} numberOfLines={1}>
              {u?.telephone || '—'}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              { borderColor: palette.primary, backgroundColor: palette.primarySoft },
              pressed && styles.editBtnPressed,
            ]}
            onPress={() => router.push('/courier/account')}>
            <Settings size={12} color={palette.primaryDeep} strokeWidth={2.4} />
            <Text style={[styles.editBtnText, { color: palette.primaryDeep }]}>Modifier le profil</Text>
          </Pressable>
        </View>

        {/* ── Menu ── */}
        <MenuRow
          Icon={Bike}
          title="Mes courses"
          subtitle="Voir l'historique et les courses en cours"
          onPress={() => router.push('/courier/missions')}
          palette={palette}
        />
        <MenuRow
          Icon={Settings}
          title="Parametres"
          subtitle="Apparence, notification, preferences"
          onPress={() => router.push('/courier/settings')}
          palette={palette}
        />
        <MenuRow
          Icon={Lock}
          title="Securite"
          subtitle="Mot de passe, biomtrie"
          onPress={() => router.push('/courier/account')}
          palette={palette}
        />
        <MenuRow
          Icon={HelpCircle}
          title="Centre d'aide"
          subtitle="FAQ et support"
          onPress={() => router.push('/help-center')}
          palette={palette}
        />

        {/* ── Deconnexion ── */}
        <View style={{ marginTop: 8 }}>
          <MenuRow
            Icon={LogOut}
            title="Se deconnecter"
            onPress={confirmLogout}
            palette={palette}
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },

  // ── Hero ──
  hero: {
    borderRadius: 20,
    padding: 20,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarImg: { width: '100%', height: '100%' },
  heroInfo: { flex: 1 },
  heroGreeting: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroName: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, flexShrink: 1 },
  verifiedBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center' },
  heroSub: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  heroDispoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroDispoDot: { width: 8, height: 8, borderRadius: 4 },
  heroDispoLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Contact ──
  contactCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactValue: { fontSize: 15, fontWeight: '600', flex: 1 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  editBtnPressed: { opacity: 0.8 },
  editBtnText: { fontSize: 12, fontWeight: '600' },

  // ── Stats ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 6 },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: { width: StyleSheet.hairlineWidth, height: 38 },
  statValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // ── Menu ──
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  menuRowPressed: { opacity: 0.82 },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 15, fontWeight: '700' },
  menuSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
