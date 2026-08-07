import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ArrowLeft, Bike, CheckCircle2, Clock, CreditCard, MapPin, PhoneCall, Star, Store, Wallet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EventTimeline } from '@/components/event-timeline';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import { apiFetch } from '@/lib/api';
import { getSessionToken } from '@/lib/auth';
import { formatDateTimeFr, type TimelineStep } from '@/lib/datetime';
import { orderPollingIntervalMs } from '@/lib/order-status';

type DeliveryStatus =
  | 'en_attente'
  | 'attribuee'
  | 'en_collecte'
  | 'collectee'
  | 'en_route'
  | 'livree'
  | 'annulee'
  | 'echec';

type DeliveryDetails = {
  livraison: {
    id: string;
    statut: DeliveryStatus | string;
    type_livraison: 'commande' | 'externe';
    created_at: string;
    attribuee_at?: string | null;
    collectee_at?: string | null;
    livree_at?: string | null;
    montant_total?: number | null;
    frais_livraison?: number | null;
    note?: string | null;
    adresse_livraison: string;
    adresse_retrait: string;
    client_nom?: string | null;
    client_telephone?: string | null;
  };
  livreur: {
    id: string;
    nom: string;
    telephone: string | null;
    image_url: string | null;
    type_vehicule: string | null;
    note_moyenne: number | null;
    nb_livraisons_reussies?: number;
    position_actuelle?: { latitude: number; longitude: number; at: string } | null;
  } | null;
  commerce: {
    id: string;
    type: 'restaurant' | 'boutique';
    nom: string;
    telephone: string | null;
    adresse: string | null;
    image_url: string | null;
  } | null;
  commande: {
    id: string;
    numero: string;
    statut: string;
    total: number | null;
    cree_le: string;
    methode_paiement: string | null;
  } | null;
  sous_commande: {
    id: string;
    numero: string;
    statut: string;
    total: number | null;
    frais_livraison: number | null;
    prete_at?: string | null;
    collectee_at?: string | null;
    livree_at?: string | null;
    reglee_at?: string | null;
  } | null;
  articles: { id: string; nom: string; description?: string | null; quantite: number; prix_unitaire: number | null }[];
  paiement: {
    id: string;
    statut: string;
    methode: string;
    montant: number | null;
    paye_at: string | null;
  } | null;
  distance_km: number | null;
  timeline: { key: string; titre: string; date: string | null; type: 'fait' | 'encours' | 'afaire' }[];
};

const STATUS_LABELS: Record<string, { label: string; tone: 'progress' | 'success' | 'warn' | 'danger' }> = {
  en_attente: { label: 'En attente', tone: 'warn' },
  attribuee: { label: 'Livreur assigné', tone: 'progress' },
  en_collecte: { label: 'En route vers le commerce', tone: 'progress' },
  collectee: { label: 'Récupérée chez le commerce', tone: 'progress' },
  en_route: { label: 'En route vers le client', tone: 'progress' },
  livree: { label: 'Livrée', tone: 'success' },
  annulee: { label: 'Annulée', tone: 'danger' },
  echec: { label: 'Échec', tone: 'danger' },
};

function deliveryStatusLabel(statut: string) {
  return STATUS_LABELS[statut]?.label ?? statut;
}

function deliveryStatusTone(statut: string): 'progress' | 'success' | 'warn' | 'danger' {
  return STATUS_LABELS[statut]?.tone ?? 'warn';
}

function adaptTimeline(d: DeliveryDetails): TimelineStep[] {
  return d.timeline.map((s) => ({
    key: s.key,
    label: s.titre,
    at: s.date || '',
    label_fr: s.date ? formatDateTimeFr(s.date) : null,
  }));
}

function formatFcfa(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  const [data, setData] = useState<DeliveryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Marque si des données sont déjà affichées : un refresh en arrière-plan qui
  // échoue ne doit pas remplacer l'écran par un bandeau d'erreur.
  const hasDataRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Nouvelle livraison affichée : on repart d'un premier chargement propre.
    hasDataRef.current = false;

    const run = async () => {
      try {
        const token = await getSessionToken();
        if (!token) throw new Error('Non authentifié');
        const res = await apiFetch<DeliveryDetails>(`/api/delivery/${id}/details`, { method: 'GET', token });
        if (!alive) return;
        hasDataRef.current = true;
        setData(res);
        setLoading(false);
        // Suivi en temps réel : refresh silencieux selon l'avancement,
        // arrêté dès que la livraison est terminée (livrée / annulée / échec).
        if (timer) clearTimeout(timer);
        const terminal = res.livraison.statut === 'echec';
        const interval = terminal ? false : orderPollingIntervalMs(res.livraison.statut);
        if (interval !== false) {
          timer = setTimeout(() => void run(), interval);
        }
      } catch (e) {
        if (alive) {
          if (!hasDataRef.current) {
            setError(e instanceof Error ? e.message : 'Impossible de charger la livraison.');
          }
          setLoading(false);
          // Reprise après une erreur réseau transitoire (sinon l'écran gèle).
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void run(), 15_000);
        }
      }
    };

    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const callNumber = (raw: string | null | undefined) => {
    if (!raw) return;
    const digits = String(raw).replace(/[^\d+]/g, '');
    if (digits) void Linking.openURL(`tel:${digits}`);
  };

  if (loading) {
    return (
      <ThemedView style={styles.center} lightColor={colors.background} darkColor={colors.background}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView style={styles.screen} lightColor={colors.background} darkColor={colors.background}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Livraison</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ThemedText style={{ color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }}>
            {error || 'Livraison introuvable.'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const { livraison: liv, livreur, commerce, commande, sous_commande: sc, articles, paiement, distance_km } = data;
  const steps = adaptTimeline(data);
  const tone = deliveryStatusTone(liv.statut);
  const toneColor =
    tone === 'success' ? colors.success : tone === 'danger' ? colors.error : tone === 'warn' ? colors.warning : colors.primary;
  const toneSoft =
    tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.errorSoft : tone === 'warn' ? colors.warningSoft : colors.primarySoft;

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Détail livraison</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.heroLabel, { color: colors.textMuted }]}>
              {liv.type_livraison === 'externe' ? 'Livraison externe' : commande?.numero || sc?.numero || liv.id.slice(0, 8).toUpperCase()}
            </ThemedText>
            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>{commerce?.nom || 'Commerce'}</ThemedText>
            <View style={styles.heroMetaRow}>
              <Clock size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.heroMeta, { color: colors.textMuted }]}>
                Créée {formatDateTimeFr(liv.created_at)}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.statutPill, { backgroundColor: toneSoft }]}>
            <ThemedText style={[styles.statutPillText, { color: toneColor }]}>{deliveryStatusLabel(liv.statut)}</ThemedText>
          </View>
        </View>

        {livreur ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Bike size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Livreur</ThemedText>
            </View>
            <View style={styles.courierRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                {livreur.image_url ? (
                  <Image source={{ uri: livreur.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <ThemedText style={{ color: colors.primary, fontSize: 20, fontWeight: '800' }}>
                    {String(livreur.nom || '?').charAt(0).toUpperCase()}
                  </ThemedText>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.courierName, { color: colors.text }]}>{livreur.nom}</ThemedText>
                <View style={styles.ratingRow}>
                  <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.courierMeta, { color: colors.textMuted }]}>
                    {livreur.note_moyenne != null ? `${Number(livreur.note_moyenne).toFixed(1)} · ` : ''}
                    {livreur.nb_livraisons_reussies || 0} livraisons
                  </ThemedText>
                </View>
                {livreur.type_vehicule ? (
                  <ThemedText style={[styles.courierMeta, { color: colors.textMuted }]}>{livreur.type_vehicule}</ThemedText>
                ) : null}
              </View>
              {livreur.telephone ? (
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: colors.successSoft }]}
                  onPress={() => callNumber(livreur.telephone)}
                  hitSlop={8}>
                  <PhoneCall size={20} color={colors.success} strokeWidth={LUCIDE_STROKE} />
                </Pressable>
              ) : null}
            </View>
            {distance_km != null ? (
              <ThemedText style={[styles.distance, { color: colors.textMuted }]}>
                Distance livreur → client : {distance_km} km
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Bike size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Livreur</ThemedText>
            </View>
            <ThemedText style={{ color: colors.textMuted, fontSize: 14 }}>
              {"Aucun livreur n'a encore été assigné à cette livraison."}
            </ThemedText>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <Store size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Point de retrait</ThemedText>
          </View>
          <ThemedText style={[styles.body, { color: colors.text }]}>{commerce?.nom || '—'}</ThemedText>
          <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>{liv.adresse_retrait || '—'}</ThemedText>
          {commerce?.telephone ? (
            <Pressable style={styles.phoneRow} onPress={() => callNumber(commerce.telephone)}>
              <PhoneCall size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.phoneText, { color: colors.primary }]}>{commerce.telephone}</ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <MapPin size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Adresse de livraison</ThemedText>
          </View>
          {liv.client_nom ? (
            <ThemedText style={[styles.body, { color: colors.text }]}>
              {liv.client_nom}
              {liv.client_telephone ? ` · ${liv.client_telephone}` : ''}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>{liv.adresse_livraison || '—'}</ThemedText>
          {liv.note ? (
            <View style={[styles.note, { backgroundColor: colors.warningSoft, borderColor: colors.border }]}>
              <ThemedText style={[styles.noteText, { color: colors.text }]}>{liv.note}</ThemedText>
            </View>
          ) : null}
        </View>

        {articles.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Articles</ThemedText>
            </View>
            {articles.map((a) => (
              <View key={a.id} style={styles.articleRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.body, { color: colors.text }]}>
                    {a.quantite} × {a.nom}
                  </ThemedText>
                  {a.description ? (
                    <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>{a.description}</ThemedText>
                  ) : null}
                </View>
                {a.prix_unitaire != null ? (
                  <ThemedText style={[styles.body, { color: colors.text }]}>{formatFcfa(a.prix_unitaire * a.quantite)}</ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {(commande || paiement) && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <CreditCard size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Commande & Paiement</ThemedText>
            </View>
            {commande ? (
              <View style={styles.kvRow}>
                <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>N° commande</ThemedText>
                <ThemedText style={[styles.kvValue, { color: colors.text }]}>{commande.numero}</ThemedText>
              </View>
            ) : null}
            {commande?.total != null ? (
              <View style={styles.kvRow}>
                <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Total</ThemedText>
                <ThemedText style={[styles.kvValue, { color: colors.text }]}>{formatFcfa(commande.total)}</ThemedText>
              </View>
            ) : null}
            {liv.frais_livraison != null ? (
              <View style={styles.kvRow}>
                <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Frais livraison</ThemedText>
                <ThemedText style={[styles.kvValue, { color: colors.text }]}>{formatFcfa(liv.frais_livraison)}</ThemedText>
              </View>
            ) : null}
            {paiement ? (
              <>
                <View style={styles.kvRow}>
                  <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Méthode</ThemedText>
                  <ThemedText style={[styles.kvValue, { color: colors.text }]}>{paiement.methode}</ThemedText>
                </View>
                <View style={styles.kvRow}>
                  <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Statut paiement</ThemedText>
                  <ThemedText style={[styles.kvValue, { color: paiement.statut === 'valide' ? colors.success : colors.text }]}>
                    {paiement.statut}
                  </ThemedText>
                </View>
                {paiement.paye_at ? (
                  <View style={styles.kvRow}>
                    <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Payé le</ThemedText>
                    <ThemedText style={[styles.kvValue, { color: colors.text }]}>{formatDateTimeFr(paiement.paye_at)}</ThemedText>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHead}>
            <CheckCircle2 size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Étapes de la livraison</ThemedText>
          </View>
          <EventTimeline steps={steps} title="" />
        </View>

        {sc?.reglee_at ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Wallet size={18} color={colors.success} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Règlement effectué</ThemedText>
            </View>
            <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>
              Cette livraison a été réglée le {formatDateTimeFr(sc.reglee_at)}.
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: 16, gap: 14 },
  hero: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  heroLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  heroMeta: { fontSize: 13, fontWeight: '600' },
  statutPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statutPillText: { fontSize: 12, fontWeight: '800' },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  courierName: { fontSize: 16, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  courierMeta: { fontSize: 13, fontWeight: '600' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distance: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  body: { fontSize: 15, fontWeight: '700' },
  bodyMuted: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  phoneText: { fontSize: 14, fontWeight: '700' },
  note: { marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  noteText: { fontSize: 14, fontWeight: '600' },
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvLabel: { fontSize: 13, fontWeight: '600' },
  kvValue: { fontSize: 14, fontWeight: '700' },
});
