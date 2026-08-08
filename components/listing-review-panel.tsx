import { ScrollView, StyleSheet, View } from 'react-native';

import { InlineFormError } from '@/components/inline-form-error';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import type { AppPalette } from '@/constants/app-palette';
import { formatFcfa } from '@/lib/format';

type Props = {
  colors: AppPalette;
  accent: string;
  title: string;
  nom: string;
  description?: string;
  categoryName?: string | null;
  prix: number;
  prixPromo?: number | null;
  mainImageUri?: string | null;
  galleryUris?: string[];
  tags?: string[];
  optionGroupCount?: number;
  estDisponible?: boolean;
  enVedette?: boolean;
  errors?: Record<string, string | null>;
};

/** Aperçu final avant publication (style marketplace). */
export function ListingReviewPanel({
  colors,
  accent,
  title,
  nom,
  description,
  categoryName,
  prix,
  prixPromo,
  mainImageUri,
  galleryUris = [],
  tags = [],
  optionGroupCount = 0,
  estDisponible = true,
  enVedette = false,
  errors,
}: Props) {
  const errorMsg = errors ? Object.values(errors).find(Boolean) : null;
  const photos = [mainImageUri, ...galleryUris.filter((u) => u && u !== mainImageUri)].filter(Boolean) as string[];

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.headline, { color: accent }]}>{title}</ThemedText>
      <ThemedText style={[styles.sub, { color: colors.textMuted }]}>
        {"Vérifiez l'aperçu tel que vos clients le verront."}
      </ThemedText>

      {errorMsg ? <InlineFormError message={errorMsg} colors={colors} marginTop={8} /> : null}

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((uri) => (
              <ZoomableImage key={uri} source={{ uri }} style={styles.photo} contentFit="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.surfaceMuted }]}>
            <ThemedText style={{ color: colors.textMuted, fontSize: 13 }}>Aucune photo</ThemedText>
          </View>
        )}

        <ThemedText type="defaultSemiBold" style={[styles.nom, { color: colors.text }]}>
          {nom.trim() || '—'}
        </ThemedText>
        {categoryName ? (
          <ThemedText style={[styles.meta, { color: colors.textMuted }]}>{categoryName}</ThemedText>
        ) : null}
        <ThemedText style={[styles.price, { color: colors.text }]}>
          {prixPromo && prixPromo > 0 ? (
            <>
              <ThemedText style={{ color: colors.success, fontWeight: '800' }}>{formatFcfa(prixPromo)}</ThemedText>
              {'  '}
              <ThemedText style={{ color: colors.textMuted, textDecorationLine: 'line-through' }}>{formatFcfa(prix)}</ThemedText>
            </>
          ) : (
            formatFcfa(prix)
          )}
        </ThemedText>
        {description?.trim() ? (
          <ThemedText style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={4}>
            {description.trim()}
          </ThemedText>
        ) : null}
        {optionGroupCount > 0 ? (
          <ThemedText style={[styles.meta, { color: colors.textMuted }]}>
            {optionGroupCount} {"groupe(s) d'options"}
          </ThemedText>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.tagRow}>
            {tags.slice(0, 6).map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                <ThemedText style={[styles.tagTxt, { color: accent }]}>{t}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.statusRow}>
          <ThemedText style={[styles.badge, { color: estDisponible ? colors.success : colors.textMuted }]}>
            {estDisponible ? '● Disponible' : '● Indisponible'}
          </ThemedText>
          {enVedette ? (
            <ThemedText style={[styles.badge, { color: accent }]}>★ En vedette</ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  headline: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  photoRow: { marginHorizontal: -4, marginBottom: 4 },
  photo: { width: 140, height: 140, borderRadius: 12, marginHorizontal: 4 },
  photoPlaceholder: {
    height: 140,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nom: { fontSize: 18 },
  meta: { fontSize: 13 },
  price: { fontSize: 17, fontWeight: '800' },
  desc: { fontSize: 14, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagTxt: { fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  badge: { fontSize: 12, fontWeight: '700' },
});
