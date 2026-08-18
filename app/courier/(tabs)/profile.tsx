import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  Bell,
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
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useLogout } from '@/hooks/use-logout';

// ─── Cellule stats (carte 3 colonnes) ─────────────────────────────

function StatCell({
  Icon,
  value,
  label,
  palette,
}: {
  Icon: LucideIcon;
  value: number | string;
  label: string;
  palette: ReturnType<typeof useCourierPalette>;
}) {
  return (
    <View style={styles.statCell}>
      <Icon size={19} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

// ─── Ligne du menu ─────────────────────────────────────────────────

function MenuRow({
  Icon,
  title,
  onPress,
  palette,
  danger,
}: {
  Icon: LucideIcon;
  title: string;
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
      <Text
        style={[
          styles.menuTitle,
          { color: danger ? palette.danger : palette.text },
        ]}
        numberOfLines={1}>
        {title}
      </Text>
      <ChevronRight size={17} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );
}

export default function CourierProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { profile, setDisponible } = useCourier();
  const { unreadCount } = useUnreadNotifications();
  const { showConfirm, FeedbackOverlay } = useActionFeedback();
  const { performLogout } = useLogout({ clearCart: false });
  const [acting, setActing] = useState(false);

  const confirmLogout = () => {
    showConfirm({
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      primaryLabel: 'Se déconnecter',
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

        {/* ── En-tête : Bonjour + cloche + réglages ── */}
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={[styles.greeting, { color: palette.muted }]}>Bonjour,</Text>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: palette.text }]} numberOfLines={1}>
                {u?.nom || 'Livreur'}
              </Text>
              <View style={[styles.verifiedBadge, { backgroundColor: palette.primary }]}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => router.push('/courier/notifications')}
              hitSlop={8}>
              <Bell size={18} color={palette.text} strokeWidth={LUCIDE_STROKE} />
              {unreadCount > 0 ? (
                <View style={[styles.notifDot, { backgroundColor: palette.primary, borderColor: palette.card }]}>
                  <Text style={styles.notifDotTxt}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={[styles.headerBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => router.push('/courier/settings')}
              hitSlop={8}>
              <Settings size={18} color={palette.text} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </View>
        </View>

        {/* ── Bloc profil : avatar + contact ── */}
        <View style={styles.profileRow}>
          <View style={[styles.avatarWrap, { backgroundColor: palette.primarySoft }]}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <User size={42} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <Phone size={15} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
              <Text style={[styles.infoPhone, { color: palette.text }]} numberOfLines={1}>
                {u?.telephone || '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Bike size={15} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
              <Text style={[styles.infoMember, { color: palette.muted }]} numberOfLines={1}>
                {l?.type_vehicule || profile?.entreprise?.nom || 'Livreur GoLivra'}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.editBtn,
                { borderColor: palette.primary, backgroundColor: palette.primarySoft },
                pressed && styles.editBtnPressed,
              ]}
              onPress={() => router.push('/courier/account')}>
              <Settings size={13} color={palette.primaryDeep} strokeWidth={2.4} />
              <Text style={[styles.editBtnText, { color: palette.primaryDeep }]}>Modifier le profil</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Carte stats (3 colonnes) ── */}
        <View style={[styles.statsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <StatCell
            Icon={ClipboardList}
            value={profile?.resume?.missions_actives ?? 0}
            label="En cours"
            palette={palette}
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <StatCell
            Icon={CalendarDays}
            value={profile?.resume?.missions_aujourdhui ?? 0}
            label="Aujourd'hui"
            palette={palette}
          />
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <StatCell
            Icon={Shield}
            value={profile?.resume?.reussies_historique ?? 0}
            label="Réussies"
            palette={palette}
          />
        </View>

        {/* ── Disponibilité ── */}
        <View style={[styles.dispoCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.dispoRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dispoTitle, { color: palette.primaryDeep }]}>Disponible pour les courses</Text>
              <Text style={[styles.dispoHint, { color: palette.muted }]}>
                {disponible ? 'Vous êtes en ligne, GoLivra peut vous envoyer des courses.' : 'Hors ligne pour le moment.'}
              </Text>
            </View>
            <Switch
              value={disponible}
              disabled={acting}
              onValueChange={(v) => void toggleDispo(v)}
              trackColor={{ false: palette.trackStroke, true: palette.primary }}
              thumbColor={disponible ? palette.primary : '#F9FAFB'}
            />
          </View>
        </View>

        {/* ── Mon activité ── */}
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Mon activité</Text>
        <View style={styles.menuList}>
          <MenuRow
            Icon={Bike}
            title="Mes courses"
            onPress={() => router.push('/courier/missions')}
            palette={palette}
          />
          <MenuRow
            Icon={Settings}
            title="Paramètres"
            onPress={() => router.push('/courier/settings')}
            palette={palette}
          />
          <MenuRow
            Icon={Lock}
            title="Sécurité"
            onPress={() => router.push('/courier/account')}
            palette={palette}
          />
          <MenuRow
            Icon={HelpCircle}
            title="Centre d'aide"
            onPress={() => router.push('/help-center')}
            palette={palette}
          />
        </View>

        {/* ── Déconnexion ── */}
        <MenuRow
          Icon={LogOut}
          title="Se déconnecter"
          onPress={confirmLogout}
          palette={palette}
          danger
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },

  // ── En-tête ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextBlock: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 1 },
  displayName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, flexShrink: 1 },
  verifiedBadge: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifDotTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // ── Bloc profil ──
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  profileInfo: { flex: 1, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoPhone: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  infoMember: { fontSize: 13, flexShrink: 1 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  editBtnPressed: { opacity: 0.8 },
  editBtnText: { fontSize: 12.5, fontWeight: '600' },

  // ── Stats card ──
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 34 },
  statValue: { fontSize: 19, fontWeight: '700', marginTop: 2, letterSpacing: -0.2 },
  statLabel: { fontSize: 12, fontWeight: '400' },

  // ── Disponibilité ──
  dispoCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  dispoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dispoTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  dispoHint: { fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // ── Menu ──
  sectionTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2, marginTop: 2 },
  menuList: { gap: 10 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  menuRowPressed: { opacity: 0.82 },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
});
