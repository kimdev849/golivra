import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X, Camera, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCourierPalette } from '@/lib/courier-theme';
import { LUCIDE_STROKE } from '@/constants/icons';

export const PROBLEM_REASONS = [
  { key: 'panne_vehicule', label: 'Panne du véhicule', emoji: '🛵' },
  { key: 'accident', label: 'Accident / incident routier', emoji: '🚧' },
  { key: 'trafic', label: 'Trafic important', emoji: '🚦' },
  { key: 'probleme_colis', label: 'Problème avec le colis', emoji: '📦' },
  { key: 'adresse_incorrecte', label: "Problème d'accès / localisation", emoji: '📍' },
  { key: 'probleme_technique', label: 'Problème technique', emoji: '📱' },
  { key: 'incident_grave', label: 'Incident grave', emoji: '🚨' },
  { key: 'client_injoignable', label: 'Client injoignable', emoji: '📞' },
  { key: 'autre', label: 'Autre', emoji: '⚠️' },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, detail: string) => Promise<void>;
};

export function ReportProblemModal({ visible, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const palette = useCourierPalette();
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onSubmit(selected, detail);
      setSelected('');
      setDetail('');
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.card,
              paddingBottom: insets.bottom + 16,
            },
          ]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <AlertTriangle size={20} color="#F59E0B" strokeWidth={2.5} />
              <Text style={[styles.sheetTitle, { color: palette.primaryDeep }]}>
                Signaler un problème
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={palette.muted} strokeWidth={2} />
            </Pressable>
          </View>

          <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
            Sélectionnez le motif du problème. L'entreprise sera notifiée.
          </Text>

          {/* Reasons grid */}
          <ScrollView
            style={styles.reasonsScroll}
            contentContainerStyle={styles.reasonsGrid}
            showsVerticalScrollIndicator={false}>
            {PROBLEM_REASONS.map((r) => {
              const isActive = selected === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setSelected(r.key)}
                  style={[
                    styles.reasonChip,
                    {
                      backgroundColor: isActive ? palette.primarySoft : palette.bg,
                      borderColor: isActive ? palette.primary : palette.border,
                    },
                  ]}>
                  <Text style={styles.reasonEmoji}>{r.emoji}</Text>
                  <Text
                    style={[
                      styles.reasonLabel,
                      {
                        color: isActive ? palette.primaryDeep : palette.text,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Detail */}
          <View style={styles.detailSection}>
            <Text style={[styles.detailLabel, { color: palette.text }]}>
              Description (optionnel)
            </Text>
            <TextInput
              style={[
                styles.detailInput,
                {
                  backgroundColor: palette.bg,
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              placeholder="Décrivez le problème..."
              placeholderTextColor={palette.muted}
              value={detail}
              onChangeText={setDetail}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={!selected || submitting}
            style={[
              styles.submitBtn,
              {
                backgroundColor: selected ? '#F59E0B' : palette.border,
              },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: selected ? '#FFF' : palette.muted },
                ]}>
                Envoyer le signalement
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 16,
  },
  reasonsScroll: {
    maxHeight: 320,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  reasonEmoji: {
    fontSize: 16,
  },
  reasonLabel: {
    fontSize: 13,
  },
  detailSection: {
    marginTop: 16,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  submitBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
