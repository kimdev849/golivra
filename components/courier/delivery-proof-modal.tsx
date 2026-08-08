import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, X } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import {
  assetToVendorImage,
  type VendorImageAsset,
} from '@/components/vendor-form-shared';
import { LUCIDE_STROKE } from '@/constants/icons';
import { getSessionToken } from '@/lib/auth';
import { completeCourierMission, type CourierMission } from '@/lib/courier-api';
import { useCourierPalette } from '@/lib/courier-theme';
import { formatTimeFr } from '@/lib/datetime';
import { captureCurrentPosition } from '@/lib/location';
import { uploadImageBase64 } from '@/lib/uploads';

type DeliveryProofModalProps = {
  deliveryId: string;
  /** Référence affichée (n° commande / course). */
  reference: string;
  onDone: (updated: CourierMission) => void;
  onClose: () => void;
};

/**
 * Preuve de livraison universelle (cas 1 : client GoLivra / cas 2 : livraison externe).
 * La preuve photo (caméra uniquement) + GPS + horodatage font foi — le livreur
 * ne peut pas mentir : sa position est enregistrée à la prise de la photo.
 *
 *  - Photo OBLIGATOIRE, prise depuis l'appareil (jamais la galerie) ;
 *  - heure + position GPS + course ajoutés automatiquement.
 *
 * La livraison n'est marquée « livrée » qu'avec la preuve : c'est elle qui
 * débloque l'escrow (settleDeliveryFeesOnComplete) côté serveur.
 */
export function DeliveryProofModal({
  deliveryId,
  reference,
  onDone,
  onClose,
}: DeliveryProofModalProps) {
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const [photo, setPhoto] = useState<VendorImageAsset | null>(null);
  const [takenAt, setTakenAt] = useState<string | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = useCallback(async () => {
    if (submitting) return;
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Autorisez la caméra pour prendre la photo de preuve.');
        return;
      }
      // GPS capturé en parallèle pendant que la caméra est ouverte (best-effort).
      const positionPromise = captureCurrentPosition();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        // Qualité réduite pour rester sous la limite serveur (8 Mo base64),
        // exif désactivé : les méta-données sont capturées par l'application.
        quality: 0.5,
        exif: false,
        base64: true,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.back,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const img = await assetToVendorImage(asset);
      if (!img) {
        setError('La photo n’a pas pu être lue. Réessayez.');
        return;
      }
      setPhoto(img);
      setTakenAt(new Date().toISOString());
      const pos = await positionPromise;
      setPosition(pos);
    } catch {
      setError('Impossible d’ouvrir la caméra.');
    }
  }, [submitting]);

  const submit = useCallback(async () => {
    if (!photo || !photo.dataUrl || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Session expirée.');
      const uploaded = await uploadImageBase64(token, {
        dataUrl: photo.dataUrl,
        folder: 'deliveries',
      });
      const updated = await completeCourierMission(token, deliveryId, {
        photoUrl: uploaded.url,
        gpsLat: position?.latitude,
        gpsLng: position?.longitude,
        takenAt: takenAt ?? undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Envoi de la preuve impossible.';
      setError(msg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [photo, submitting, deliveryId, position, takenAt, onDone]);

  const canSubmit = photo !== null && !submitting;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, 12), backgroundColor: palette.card, borderBottomColor: palette.border },
          ]}>
          <View style={{ width: 40 }} />
          <View style={styles.headerTitle}>
            <ThemedText style={[styles.headerTitleText, { color: palette.primaryDeep }]}>
              Confirmer la livraison
            </ThemedText>
            <ThemedText style={[styles.headerSub, { color: palette.muted }]}>{reference}</ThemedText>
          </View>
          <Pressable
            onPress={onClose}
            disabled={submitting}
            hitSlop={12}
            style={[styles.closeBtn, { backgroundColor: palette.primarySoft }]}
            accessibilityRole="button"
            accessibilityLabel="Fermer">
            <X size={20} color={palette.primaryDeep} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <View style={[styles.infoBanner, { backgroundColor: palette.primarySoft }]}>
            <ShieldCheck size={18} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.infoText, { color: palette.primaryDeep }]}>
              La preuve photo est obligatoire et débloque la livraison. Heure, position GPS et
              course sont ajoutées automatiquement.
            </ThemedText>
          </View>

          {/* ── Photo de preuve ── */}
          <ThemedText style={[styles.sectionLabel, { color: palette.muted }]}>
            Photo de preuve <ThemedText style={{ color: palette.danger }}>*</ThemedText>
          </ThemedText>

          {photo ? (
            <View style={[styles.photoWrap, { borderColor: palette.border }]}>
              <Image
                source={{ uri: photo.dataUrl || photo.uri }}
                style={styles.photoPreview}
                contentFit="cover"
                transition={150}
              />
              <Pressable
                style={[styles.retakeBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                onPress={() => void takePhoto()}>
                <RefreshCw size={16} color={palette.primary} strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={[styles.retakeText, { color: palette.primary }]}>Reprendre</ThemedText>
              </Pressable>
              <View style={[styles.metaBox, { backgroundColor: palette.card }]}>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaLabel, { color: palette.muted }]}>Heure</ThemedText>
                  <ThemedText style={[styles.metaValue, { color: palette.text }]}>
                    {takenAt ? formatTimeFr(takenAt) : '—'}
                  </ThemedText>
                </View>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaLabel, { color: palette.muted }]}>Position GPS</ThemedText>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    {position ? (
                      <ThemedText style={[styles.metaValue, { color: palette.text }]}>
                        {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                      </ThemedText>
                    ) : (
                      <ThemedText style={[styles.metaValue, { color: palette.muted }]}>
                        Non disponible (autorisez la localisation)
                      </ThemedText>
                    )}
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaLabel, { color: palette.muted }]}>Course</ThemedText>
                  <ThemedText style={[styles.metaValue, { color: palette.text }]}>{reference}</ThemedText>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.cameraBtn, { borderColor: palette.primary, backgroundColor: palette.primarySoft }]}
              onPress={() => void takePhoto()}
              accessibilityRole="button"
              accessibilityLabel="Prendre la photo de preuve">
              <View style={[styles.cameraIconWrap, { backgroundColor: palette.primary }]}>
                <Camera size={26} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
              </View>
              <ThemedText style={[styles.cameraTitle, { color: palette.primaryDeep }]}>
                Prendre la photo
              </ThemedText>
              <ThemedText style={[styles.cameraHint, { color: palette.muted }]}>
                Photo prise depuis l’appareil photo — la galerie n’est pas acceptée.
              </ThemedText>
            </Pressable>
          )}

          {error ? (
            <View style={[styles.errorBox, { borderColor: palette.danger }]}>
              <ThemedText style={[styles.errorText, { color: palette.danger }]}>{error}</ThemedText>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.submitBtn,
              { backgroundColor: canSubmit ? palette.primary : palette.trackStroke },
            ]}
            disabled={!canSubmit}
            onPress={() => void submit()}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={LUCIDE_STROKE} />
                <ThemedText style={styles.submitText}>Valider la livraison</ThemedText>
              </>
            )}
          </Pressable>
          {!photo ? (
            <ThemedText style={[styles.requiredHint, { color: palette.muted }]}>
              La photo est obligatoire pour valider.
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { alignItems: 'center', gap: 2 },
  headerTitleText: { fontSize: 17, fontWeight: '900' },
  headerSub: { fontSize: 12, fontWeight: '700' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 12 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  cameraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 26,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  cameraIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: { fontSize: 16, fontWeight: '900' },
  cameraHint: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  photoWrap: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', gap: 10 },
  photoPreview: { width: '100%', height: 220, backgroundColor: '#000' },
  retakeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  retakeText: { fontSize: 13, fontWeight: '800' },
  metaBox: { padding: 14, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  metaLabel: { fontSize: 12.5, fontWeight: '700' },
  metaValue: { fontSize: 13, fontWeight: '800' },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    backgroundColor: 'rgba(220,38,38,0.06)',
  },
  errorText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  requiredHint: { textAlign: 'center', fontSize: 12.5, fontWeight: '600' },
});
