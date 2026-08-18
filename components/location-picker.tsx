import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ChevronDown, MapPin, Navigation } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';
import {
  fetchPays,
  fetchVillesByPays,
  detectLocation,
  type Pays,
  type Ville,
} from '@/lib/location';

export type LocationValue = {
  pays: Pays | null;
  ville: Ville | null;
};

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Détection automatique par IP au montage. */
  autoDetect?: boolean;
  /** Afficher un indicateur de chargement pour la détection IP. */
  showDetectIndicator?: boolean;
  /** Texte du placeholder. */
  placeholder?: string;
  /** Désactiver l'interaction. */
  disabled?: boolean;
  /** Style compact (pour formulaire intégré). */
  compact?: boolean;
};

export function LocationPicker({
  value,
  onChange,
  autoDetect = true,
  showDetectIndicator = true,
  placeholder = 'Votre ville',
  disabled = false,
  compact = false,
}: Props) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  const [paysList, setPaysList] = useState<Pays[]>([]);
  const [villesList, setVillesList] = useState<Ville[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(autoDetect);
  const [paysOpen, setPaysOpen] = useState(false);
  const [villeOpen, setVilleOpen] = useState(false);
  const [paysError, setPaysError] = useState<string | null>(null);

  // Charger la liste des pays au montage
  const loadPays = useCallback(() => {
    let alive = true;
    setLoading(true);
    setPaysError(null);
    fetchPays()
      .then((list) => { if (alive) setPaysList(list); })
      .catch((err) => {
        if (alive) {
          const msg = err instanceof Error ? err.message : 'Impossible de charger les pays';
          if (__DEV__) console.warn('[LocationPicker] fetchPays error:', msg);
          setPaysError(msg);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(loadPays, [loadPays]);

  // Détection automatique par IP
  useEffect(() => {
    if (!autoDetect || value.pays) return;
    let alive = true;
    setDetecting(true);
    setPaysError(null);
    detectLocation()
      .then((result) => {
        if (!alive) return;
        if (result.pays) {
          onChange({ pays: result.pays, ville: result.ville_suggestion || null });
        }
      })
      .catch((err) => {
        if (alive && __DEV__) console.warn('[LocationPicker] detectLocation error:', err);
      })
      .finally(() => { if (alive) setDetecting(false); });
    return () => { alive = false; };
    // tant qu'aucun pays n'est choisi (guard `value.pays` ci-dessus).
  }, [autoDetect, onChange, value.pays]);

  // Charger les villes quand le pays change
  useEffect(() => {
    if (!value.pays) { setVillesList([]); return; }
    let alive = true;
    setLoading(true);
    setPaysError(null);
    fetchVillesByPays(value.pays.id)
      .then((list) => { if (alive) setVillesList(list); })
      .catch((err) => {
        if (alive) {
          const msg = err instanceof Error ? err.message : 'Impossible de charger les villes';
          if (__DEV__) console.warn('[LocationPicker] fetchVilles error:', msg);
          setPaysError(msg);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [value.pays?.id, value.pays]);

  const selectPays = useCallback((p: Pays) => {
    onChange({ pays: p, ville: null });
    setPaysOpen(false);
  }, [onChange]);

  const selectVille = useCallback((v: Ville) => {
    onChange({ pays: value.pays, ville: v });
    setVilleOpen(false);
  }, [onChange, value.pays]);

  const paysLabel = value.pays?.nom || 'Sélectionner un pays';
  const villeLabel = value.ville?.nom || 'Sélectionner une ville';

  return (
    <View style={styles.wrap}>
      {/* Détection IP active */}
      {detecting && showDetectIndicator ? (
        <View style={[styles.detectRow, { backgroundColor: colors.primarySoft }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <ThemedText style={[styles.detectText, { color: colors.primary }]}>
            Détection de votre localisation…
          </ThemedText>
        </View>
      ) : null}

      {/* Pays */}
      {compact ? (
        <Pressable
          disabled={disabled}
          style={[styles.compactRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setPaysOpen(true)}>
          <MapPin size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.compactLabel, { color: colors.text }]} numberOfLines={1}>
            {paysLabel}
          </ThemedText>
          <ChevronDown size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      ) : (
        <Pressable
          disabled={disabled}
          style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => setPaysOpen(true)}>
          <MapPin size={14} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
          <ThemedText style={[styles.pillText, { color: colors.text }]}>{paysLabel}</ThemedText>
          <ChevronDown size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
      )}

      {/* Villes (apparaît quand un pays est sélectionné) */}
      {value.pays ? (
        compact ? (
          <Pressable
            disabled={disabled}
            style={[styles.compactRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setVilleOpen(true)}>
            <Navigation size={16} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.compactLabel, { color: colors.text }]} numberOfLines={1}>
              {villeLabel}
            </ThemedText>
            <ChevronDown size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : (
          <Pressable
            disabled={disabled}
            style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setVilleOpen(true)}>
            <Navigation size={14} color={colors.primary} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.pillText, { color: colors.text }]}>{villeLabel}</ThemedText>
            <ChevronDown size={14} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        )
      ) : null}

      {/* --- MODAL PAYS --- */}
      <Modal visible={paysOpen} transparent animationType="slide" onRequestClose={() => setPaysOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPaysOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <ThemedText type="defaultSemiBold" style={[styles.modalTitle, { color: colors.text }]}>
              Choisissez votre pays
            </ThemedText>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : paysError ? (
              <View style={styles.errorBox}>
                <ThemedText style={[styles.errorText, { color: colors.error }]}>{paysError}</ThemedText>
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={loadPays}>
                  <ThemedText style={[styles.retryBtnText, { color: colors.onPrimary }]}>Réessayer</ThemedText>
                </Pressable>
              </View>
            ) : paysList.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                Aucun pays disponible.
              </ThemedText>
            ) : (
              <ScrollView>
                {paysList.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[styles.optionRow, { borderBottomColor: colors.border }, value.pays?.id === p.id && { backgroundColor: colors.successSoft }]}
                    onPress={() => selectPays(p)}>
                    <ThemedText style={[styles.optionText, { color: colors.text }]}>{p.nom}</ThemedText>
                    {p.indicatif ? (
                      <ThemedText style={[styles.optionHint, { color: colors.textMuted }]}>{p.indicatif}</ThemedText>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* --- MODAL VILLE --- */}
      <Modal visible={villeOpen} transparent animationType="slide" onRequestClose={() => setVilleOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVilleOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <ThemedText type="defaultSemiBold" style={[styles.modalTitle, { color: colors.text }]}>
              Choisissez votre ville
            </ThemedText>
            {value.pays ? (
              <ThemedText style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {value.pays.nom}
              </ThemedText>
            ) : null}
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : villesList.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
                Aucune ville trouvée pour ce pays.
              </ThemedText>
            ) : (
              <ScrollView>
                {villesList.map((v) => (
                  <Pressable
                    key={v.id}
                    style={[styles.optionRow, { borderBottomColor: colors.border }, value.ville?.id === v.id && { backgroundColor: colors.successSoft }]}
                    onPress={() => selectVille(v)}>
                    <ThemedText style={[styles.optionText, { color: colors.text }]}>{v.nom}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  detectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  detectText: { fontSize: 12, fontWeight: '600' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 13, fontWeight: '700' },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 17, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 16, fontWeight: '600' },
  optionHint: { fontSize: 13 },
  emptyText: { textAlign: 'center', marginVertical: 20, fontSize: 14 },
  errorBox: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { fontWeight: '800', fontSize: 14 },
});
