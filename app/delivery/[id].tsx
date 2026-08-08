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

/** Ton du statut pour la couleur (jamais affiché tel quel au client). */
const STATUS_TONES: Record<string, 'progress' | 'success' | 'warn' | 'danger'> = {
  en_attente: 'warn',
  attribuee: 'progress',
  en_collecte: 'progress',
  collectee: 'progress',
  en_route: 'progress',
  livree: 'success',
  annulee: 'danger',
  echec: 'danger',
};

/** Titres humains — le client voit ce qu'il veut savoir, pas un statut brut. */
const HUMAN_STATUS_TITLES: Record<string, string> = {
  en_attente: "En attente d'un livreur",
  attribuee: 'Votre livreur est en route',
  en_collecte: 'Votre livreur arrive au commerce',
  collectee: 'Commande récupérée',
  en_route: 'En route vers vous',
  livree: 'Livrée ✓',
  annulee: 'Commande annulée',
  echec: 'Livraison impossible',
};

/** Les étapes du suivi, racontées comme une histoire. */
const FRIENDLY_TIMELINE_TITLES: Record<string, string> = {
  en_attente: "En attente d'un livreur",
  attribuee: 'Livreur assigné',
  en_collecte: 'Votre livreur se rend au commerce',
  collectee: 'Commande récupérée',
  en_route: 'Votre commande est en route vers vous',
  livree: 'Commande livrée',
  annulee: 'Commande annulée',
  echec: 'Livraison impossible',
};

function humanStatusTitle(statut: string): string {
  return HUMAN_STATUS_TITLES[statut] ?? 'Livraison en cours';
}

function deliveryStatusTone(statut: string): 'progress' | 'success' | 'warn' | 'danger' {
  return STATUS_TONES[statut] ?? 'warn';
}

function adaptTimeline(d: DeliveryDetails): TimelineStep[] {
  return d.timeline.map((s) => ({
    key: s.key,
    label: FRIENDLY_TIMELINE_TITLES[s.key] ?? s.titre,
    at: s.date || '',
    label_fr: s.date ? formatDateTimeFr(s.date) : null,
  }));
}

function formatFcfa(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

/** « +242 06 48 22 244 » au lieu d'un bloc de chiffres. */
function formatPhone(raw: string | null | undefined): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('242') && d.length >= 12) {
    const n = d.slice(3, 12);
    return `+242 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
  }
  return String(raw || '');
}

/** Nom du moyen de paiement, lisible (« Airtel Money », « MTN MoMo »…). */
function paymentMethodLabel(m: string | null | undefined): string {
  const v = String(m || '').toLowerCase();
  if (v.includes('airtel')) return 'Airtel Money';
  if (v.includes('mtn')) return 'MTN MoMo';
  if (v.includes('especes') || v.includes('cash')) return 'Espèces';
  if (v.includes('portefeuille') || v.includes('wallet')) return 'Portefeuille GoLivra';
  if (v.includes('carte')) return 'Carte bancaire';
  return m || '—';
}

/** Statut du paiement pour le client : « Payé ✓ », jamais « valide ». */
function paymentStatusLabel(s: string | null | undefined): string {
  const v = String(s || '').toLowerCase();
  if (v === 'valide' || v === 'paye' || v === 'completed') return 'Payé ✓';
  if (v === 'en_attente' || v === 'pending') return 'En attente';
  if (v === 'echoue' || v === 'failed') return 'Échec du paiement';
  if (v === 'rembourse' || v === 'refunded') return 'Remboursé';
  return 'Non payé';
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

  const { livraison: liv, livreur, commerce, commande, sous_commande: sc, articles, paiement } = data;
  const steps = adaptTimeline(data);
  const tone = deliveryStatusTone(liv.statut);
  const toneColor =
    tone === 'success' ? colors.success : tone === 'danger' ? colors.error : tone === 'warn' ? colors.warning : colors.primary;

  const isExterne = liv.type_livraison === 'externe';
  const refLabel = commande?.numero || sc?.numero || liv.id.slice(0, 8).toUpperCase();

  // Point de retrait : jamais « — ». Si le nom est déjà dans l'adresse, on ne
  // l'affiche pas deux fois.
  const retraitName = commerce?.nom || null;
  const retraitAddr = String(liv.adresse_retrait || '').trim();
  const addrHasName =
    retraitName != null &&
    retraitAddr.length > 0 &&
    retraitAddr.toLowerCase().startsWith(retraitName.toLowerCase());

  // Livreur : une note de 0.0 n'est pas une mauvaise note — c'est juste un
  // livreur pas encore évalué.
  const courierNb = livreur?.nb_livraisons_reussies || 0;
  const courierHasRating = livreur != null && livreur.note_moyenne != null && livreur.note_moyenne > 0;
  const vehicleEmoji = String(livreur?.type_vehicule || '').toLowerCase().includes('moto')
    ? '🏍️'
    : String(livreur?.type_vehicule || '').toLowerCase().includes('voiture') ||
        String(livreur?.type_vehicule || '').toLowerCase().includes('auto')
      ? '🚗'
      : '🛵';

  return (
    <ThemedView style={styles.screen} lightColor={colors.backgroundAlt} darkColor={colors.backgroundAlt}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={24} color={colors.text} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {isExterne ? 'Votre livraison' : 'Votre commande'}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {/* ── En-tête : ce que le client veut savoir en premier ── */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.heroStatus, { color: toneColor }]}>{humanStatusTitle(liv.statut)}</ThemedText>
          <ThemedText style={[styles.heroRef, { color: colors.textMuted }]}>
            {isExterne ? 'Livraison' : 'Commande'} {refLabel}
          </ThemedText>
          {commerce?.nom ? (
            <ThemedText style={[styles.heroCommerce, { color: colors.text }]}>{commerce.nom}</ThemedText>
          ) : null}
          <View style={styles.heroMetaRow}>
            <Clock size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.heroMeta, { color: colors.textMuted }]}>
              {isExterne ? 'Demandée' : 'Commandée'} le {formatDateTimeFr(liv.created_at)}
            </ThemedText>
          </View>
        </View>

        {livreur ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Bike size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Votre livreur</ThemedText>
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
                <ThemedText style={[styles.courierName, { color: colors.text }]}>
                  {vehicleEmoji} {livreur.nom}
                </ThemedText>
                <ThemedText style={[styles.courierMeta, { color: colors.textMuted, marginTop: 2 }]}>
                  {[
                    livreur.type_vehicule ? String(livreur.type_vehicule) : null,
                    courierNb > 0 ? `${courierNb} livraisons` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Livreur GoLivra'}
                </ThemedText>
                <View style={styles.ratingRow}>
                  <Star size={14} color={colors.warning} fill={colors.warning} strokeWidth={LUCIDE_STROKE} />
                  <ThemedText style={[styles.courierMeta, { color: colors.textMuted }]}>
                    {courierHasRating ? `${Number(livreur.note_moyenne).toFixed(1)}` : 'Nouveau livreur'}
                  </ThemedText>
                </View>
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
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <Bike size={18} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Votre livreur</ThemedText>
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
          {addrHasName ? (
            <ThemedText style={[styles.body, { color: colors.text }]}>{retraitAddr}</ThemedText>
          ) : (
            <>
              <ThemedText style={[styles.body, { color: colors.text }]}>
                {retraitName || 'Point de retrait du commerce'}
              </ThemedText>
              {retraitAddr ? (
                <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>{retraitAddr}</ThemedText>
              ) : null}
            </>
          )}
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
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Livré à</ThemedText>
          </View>
          {liv.client_nom ? (
            <>
              <ThemedText style={[styles.body, { color: colors.text }]}>{liv.client_nom}</ThemedText>
              {liv.client_telephone ? (
                <ThemedText style={[styles.phoneInline, { color: colors.textMuted }]}>{formatPhone(liv.client_telephone)}</ThemedText>
              ) : null}
            </>
          ) : null}
          {liv.adresse_livraison ? (
            <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>
              {String(liv.adresse_livraison)
                .split(' · ')
                .map((part) => part.trim())
                .filter(Boolean)
                .join('\n')}
            </ThemedText>
          ) : null}
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
            {articles.map((a) => {
              const desc = String(a.description || '').trim();
              // On ne répète pas le nom de l'article en dessous (description
              // quasi identique au nom : inutile et confus).
              const descDiffers =
                desc.length > 0 &&
                desc.toLowerCase() !== a.nom.toLowerCase() &&
                !desc.toLowerCase().includes(a.nom.toLowerCase());
              return (
                <View key={a.id} style={styles.articleRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.body, { color: colors.text }]}>
                      {a.quantite} × {a.nom}
                    </ThemedText>
                    {descDiffers ? (
                      <ThemedText style={[styles.bodyMuted, { color: colors.textMuted }]}>{a.description}</ThemedText>
                    ) : null}
                  </View>
                  {a.prix_unitaire != null ? (
                    <ThemedText style={[styles.body, { color: colors.text }]}>{formatFcfa(a.prix_unitaire * a.quantite)}</ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {(commande || paiement) && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHead}>
              <CreditCard size={18} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Commande & paiement</ThemedText>
            </View>
            {commande ? (
              <View style={styles.kvRow}>
                <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>N° de commande</ThemedText>
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
                <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Frais de livraison</ThemedText>
                <ThemedText style={[styles.kvValue, { color: colors.text }]}>{formatFcfa(liv.frais_livraison)}</ThemedText>
              </View>
            ) : null}
            {paiement ? (
              <>
                <View style={styles.kvRow}>
                  <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Paiement</ThemedText>
                  <ThemedText style={[styles.kvValue, { color: colors.text }]}>{paymentMethodLabel(paiement.methode)}</ThemedText>
                </View>
                <View style={styles.kvRow}>
                  <ThemedText style={[styles.kvLabel, { color: colors.textMuted }]}>Statut</ThemedText>
                  <ThemedText style={[styles.kvValue, { color: paiement.statut === 'valide' ? colors.success : colors.text }]}>
                    {paymentStatusLabel(paiement.statut)}
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
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Suivi de votre livraison</ThemedText>
          </View>
          <EventTimeline steps={steps} title="" />
        </View>

        {liv.statut === 'livree' ? (
          <View style={[styles.deliveredCard, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
            <ThemedText style={[styles.deliveredTitle, { color: colors.success }]}>
              Votre commande est bien arrivée 😊
            </ThemedText>
            <ThemedText style={[styles.deliveredSub, { color: colors.textMuted }]}>
              Livrée le {formatDateTimeFr(liv.livree_at || liv.created_at)}
            </ThemedText>
          </View>
        ) : null}

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
    gap: 6,
    borderWidth: 1,
  },
  heroStatus: { fontSize: 22, fontWeight: '900' },
  heroRef: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroCommerce: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  heroMeta: { fontSize: 13, fontWeight: '600' },
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
  body: { fontSize: 15, fontWeight: '700' },
  bodyMuted: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  phoneText: { fontSize: 14, fontWeight: '700' },
  phoneInline: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  note: { marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  noteText: { fontSize: 14, fontWeight: '600' },
  articleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvLabel: { fontSize: 13, fontWeight: '600' },
  kvValue: { fontSize: 14, fontWeight: '700' },
  deliveredCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  deliveredTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  deliveredSub: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
