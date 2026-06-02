import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ChevronRight, Lock, Settings, User } from 'lucide-react-native';

import { AppContentWidth } from '@/components/app-content-width';
import { AppLogoutButton } from '@/components/app-logout-button';
import { ThemeModePicker } from '@/components/theme-mode-picker';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { COURIER_TAB_BAR_PADDING_BOTTOM } from '@/constants/courier-layout';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useCourier } from '@/contexts/courier-context';
import { useCourierPalette } from '@/lib/courier-theme';
import { resolveRemoteImageUrl } from '@/lib/images';

export default function CourierProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const { profile, setDisponible } = useCourier();
  const [acting, setActing] = useState(false);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: bottom }]}>
        <AppContentWidth phonePadding={0}>
        <View style={[styles.headerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarPh, { backgroundColor: palette.primarySoft }]}>
              <User size={40} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
            </View>
          )}
          <ThemedText style={[styles.name, { color: palette.primaryDeep }]}>{u?.nom || 'Livreur'}</ThemedText>
          <ThemedText style={[styles.tel, { color: palette.text }]}>{u?.telephone || '—'}</ThemedText>
          <ThemedText style={[styles.ent, { color: palette.muted }]}>{profile?.entreprise?.nom || 'GoLivra'}</ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <ThemedText style={[styles.cardTitle, { color: palette.primaryDeep }]}>Mon activité</ThemedText>
          <InfoRow label="Véhicule" value={l?.type_vehicule || '—'} palette={palette} />
          {l?.plaque_immatriculation ? (
            <InfoRow label="Plaque" value={l.plaque_immatriculation} palette={palette} />
          ) : null}
          <InfoRow label="Livraisons réussies" value={String(l?.nb_livraisons_reussies ?? 0)} palette={palette} />
          <View style={[styles.dispoRow, { borderTopColor: palette.border }]}>
            <ThemedText style={[styles.dispoLabel, { color: palette.primaryDeep }]}>Disponible pour les courses</ThemedText>
            <Switch
              value={disponible}
              disabled={acting}
              onValueChange={(v) => void toggleDispo(v)}
              trackColor={{ false: palette.trackStroke, true: palette.primary }}
              thumbColor={disponible ? palette.primary : '#F9FAFB'}
            />
          </View>
        </View>

        <ThemeModePicker
          palette={palette}
          title="Mode clair / sombre"
          hint="Choisissez l’apparence de l’espace livreur (clair, sombre ou selon le téléphone)."
        />

        <View style={[styles.menu, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <MenuItem
            icon={<Settings size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
            label="Modifier mes informations"
            sub="Nom, téléphone, mot de passe"
            onPress={() => router.push('/courier/settings')}
            palette={palette}
          />
          <MenuItem
            icon={<Lock size={20} color={palette.primary} strokeWidth={LUCIDE_STROKE} />}
            label="Sécurité"
            sub="Changer le mot de passe"
            onPress={() => router.push('/courier/settings')}
            palette={palette}
          />
        </View>

        <AppLogoutButton clearCart={false} />
        </AppContentWidth>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, palette }: { label: string; value: string; palette: ReturnType<typeof useCourierPalette> }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: palette.muted }]}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, { color: palette.text }]}>{value}</ThemedText>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
  palette: ReturnType<typeof useCourierPalette>;
}) {
  return (
    <Pressable style={[styles.menuItem, { borderBottomColor: palette.border }]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: palette.primarySoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.menuLabel, { color: palette.text }]}>{label}</ThemedText>
        <ThemedText style={[styles.menuSub, { color: palette.muted }]}>{sub}</ThemedText>
      </View>
      <ChevronRight size={18} color={palette.muted} strokeWidth={LUCIDE_STROKE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 18, gap: 14, flexGrow: 1 },
  headerCard: {
    alignItems: 'center',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarPh: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '900' },
  tel: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  ent: { fontSize: 13, marginTop: 2 },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  cardTitle: { fontWeight: '900', fontSize: 16 },
  infoRow: { gap: 2 },
  infoLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  dispoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dispoLabel: { fontSize: 14, fontWeight: '700', flex: 1 },
  menu: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontWeight: '800', fontSize: 16 },
  menuSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  logoutText: { fontWeight: '800', fontSize: 15 },
});
