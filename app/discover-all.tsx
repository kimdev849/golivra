import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  Store,
  UtensilsCrossed,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LUCIDE_STROKE } from '@/constants/icons';
import type { AppPalette } from '@/constants/app-palette';
import { createScreenStyles } from '@/constants/ui-styles';
import { useAppColors } from '@/hooks/use-app-colors';
import { useDeliveryEstimate } from '@/hooks/use-delivery-estimate';
import { useEnterprises } from '@/hooks/useMarketplace';
import {
  sortEnterprisesByPopularity,
  sortEnterprisesByRecency,
  type EnterprisePublic,
} from '@/lib/catalog';
import { resolveRemoteImageUrl } from '@/lib/images';

type SortKey = 'popular' | 'recent';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Plus populaires' },
  { key: 'recent', label: 'Plus récents' },
];

/** « À découvrir » : tous les commerces (restaurants + boutiques) mélangés. */
export default function DiscoverAllScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const screenStyles = useMemo(() => createScreenStyles(colors), [colors]);
  const styles = useMemo(() => makeLocalStyles(colors), [colors]);

  const { data: enterprises, isLoading } = useEnterprises('all');
  // ⚡ Temps de livraison dynamique (GoLivra) selon la zone de l'adresse principale.
  const { minutes: deliveryMinutes } = useDeliveryEstimate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');

  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    let list: EnterprisePublic[] = enterprises ?? [];
    if (sort === 'popular') list = sortEnterprisesByPopularity(list);
    if (sort === 'recent') list = sortEnterprisesByRecency(list);
    if (needle.length >= 2) {
      list = list.filter(
        (e) =>
          (e.nom ?? '').toLowerCase().includes(needle) ||
          (e.categorie_nom ?? '').toLowerCase().includes(needle) ||
          (e.adresse ?? '').toLowerCase().includes(needle),
      );
    }
    return list;
  }, [enterprises, sort, needle]);

  const bottomPad = Math.max(insets.bottom, 16) + 24;

  return (
    <ThemedView style={screenStyles.screen}>
      <View style={[screenStyles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={screenStyles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={26} color={colors.primaryDeep} strokeWidth={LUCIDE_STROKE} />
        </Pressable>
        <ThemedText type="subtitle" style={screenStyles.headerTitle}>
          À découvrir
        </ThemedText>
        <View style={screenStyles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        {/* Recherche */}
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Search size={17} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Rechercher un commerce…"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ) : null}
        </View>

        {/* Tri : juste au-dessus de la liste */}
        <View style={styles.sortRowWrap}>
          {SORT_OPTIONS.map((o) => {
            const active = sort === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSort(o.key);
                }}
                style={[
                  styles.sortChip,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
                ]}>
                <Text style={[styles.sortChipTxt, { color: active ? colors.onPrimary : colors.text }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
        ) : visible.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun commerce</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Modifiez la recherche ou revenez un peu plus tard.
            </Text>
          </View>
        ) : (
          <>
            {visible.map((ent) => {
              const img = resolveRemoteImageUrl(ent.image_url, { width: 120, format: 'webp', quality: 75 });
              return (
              <Pressable
                key={ent.id}
                style={({ pressed }) => [
                  styles.entRow,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.93 : 1 },
                ]}
                onPress={() => router.push(`/marketplace/${ent.id}` as never)}
                android_ripple={{ color: colors.primaryMuted }}>
                <View style={[styles.entRowImg, { backgroundColor: colors.primarySoft }]}>
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : ent.type === 'restaurant' ? (
                    <UtensilsCrossed size={20} color={colors.primary} strokeWidth={1.5} />
                  ) : (
                    <Store size={20} color={colors.primary} strokeWidth={1.5} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entRowName, { color: colors.text }]} numberOfLines={1}>
                    {ent.nom}
                  </Text>
                  <Text style={[styles.entRowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {[
                      ent.type === 'restaurant' ? 'Restaurant' : 'Boutique',
                      ent.categorie_nom,
                      (deliveryMinutes ?? ent.delai_livraison_min)
                        ? `${deliveryMinutes ?? ent.delai_livraison_min} min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {ent.note_moyenne && ent.note_moyenne > 0 ? (
                  <View style={styles.entRowRating}>
                    <Star size={12} color="#F5A524" fill="#F5A524" strokeWidth={0} />
                    <Text style={[styles.entRowRatingTxt, { color: colors.text }]}>
                      {ent.note_moyenne.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                <ChevronRight size={16} color={colors.textMuted} strokeWidth={LUCIDE_STROKE} />
              </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function makeLocalStyles(c: AppPalette) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
    sortRowWrap: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    sortChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    sortChipTxt: { fontSize: 13, fontWeight: '600' },
    entRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 8,
      shadowColor: '#0C3020',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    entRowImg: {
      width: 52,
      height: 52,
      borderRadius: 14,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    entRowName: { fontSize: 15, fontWeight: '700' },
    entRowMeta: { fontSize: 12, marginTop: 2 },
    entRowRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    entRowRatingTxt: { fontSize: 13, fontWeight: '700' },
    emptyCard: {
      padding: 20,
      borderRadius: 14,
      gap: 6,
      marginTop: 8,
      alignItems: 'center',
    },
    emptyTitle: { fontSize: 15, fontWeight: '700' },
    emptyBody: { fontSize: 13, textAlign: 'center' },
  });
}
