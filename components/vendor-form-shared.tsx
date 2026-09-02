import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Plus, Star, X } from 'lucide-react-native';

import { GalleryViewer } from '@/components/gallery-viewer';
import { ThemedText } from '@/components/themed-text';
import { LUCIDE_STROKE } from '@/constants/icons';
import type { AppPalette } from '@/constants/app-palette';

export const MAX_GALLERY_PHOTOS = 8;

export type VendorImageAsset = { uri: string; dataUrl: string };

/** Convertit une URI locale en data URL (fallback si le picker ne renvoie pas base64). */
export async function uriToDataUrl(uri: string, mimeType = 'image/jpeg'): Promise<string | null> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    return `data:${mimeType};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function assetToVendorImage(asset: ImagePicker.ImagePickerAsset): Promise<VendorImageAsset | null> {
  if (!asset?.uri) return null;
  const mime = asset.mimeType || 'image/jpeg';
  if (asset.base64) {
    return { uri: asset.uri, dataUrl: `data:${mime};base64,${asset.base64}` };
  }
  const dataUrl = await uriToDataUrl(asset.uri, mime);
  if (!dataUrl) return null;
  return { uri: asset.uri, dataUrl };
}

export async function ensureImageDataUrl(item: { uri: string; dataUrl: string }): Promise<string | null> {
  if (item.dataUrl) return item.dataUrl;
  if (item.uri.startsWith('http')) return null;
  return uriToDataUrl(item.uri);
}

export async function pickVendorImageAsset(): Promise<VendorImageAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission', 'Accès aux photos requis.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.92,
    base64: true,
    allowsEditing: false,
    allowsMultipleSelection: false,
    selectionLimit: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return assetToVendorImage(asset);
}

export async function pickMultipleVendorImages(max: number = MAX_GALLERY_PHOTOS): Promise<VendorImageAsset[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission', 'Accès aux photos requis.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.82,
    base64: true,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, max),
  });
  if (result.canceled || !result.assets?.length) return [];

  const out: VendorImageAsset[] = [];
  for (const asset of result.assets) {
    const img = await assetToVendorImage(asset);
    if (img) out.push(img);
  }
  if (result.assets.length > 0 && out.length === 0) {
    Alert.alert(
      'Photos',
      'Les images sélectionnées n\'ont pas pu être lues. Réessayez ou choisissez une photo à la fois.',
    );
  }
  return out;
}

// ─── Grille de photos réordonnable (glisser-déposer) ─────────────────────────

const GRID_COLS = 3;
const GRID_GAP = 10;
/** Appui long avant d'entrer en mode glisser (ms). */
const LONG_PRESS_MS = 300;

type GalleryProps = {
  /** Toutes les photos : la première (index 0) est la photo principale. */
  images: VendorImageAsset[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Réordonne la liste complète après un glisser-déposer (la 1re reste la principale). */
  onReorder: (ordered: VendorImageAsset[]) => void;
  colors: AppPalette;
  accent: string;
  mainRequired?: boolean;
  max?: number;
};

/**
 * Tuile photo : tap = agrandir, appui long + glisser = réordonner.
 *
 * L'index peut changer pendant un glisser (la liste se réordonne en direct) :
 * on suit donc la position via une shared value mise à jour côté UI thread,
 * ce qui évite tout décalage entre le doigt et la photo déplacée.
 */
function DraggableTile({
  image,
  index,
  count,
  tileSize,
  draggingUri,
  colors,
  accent,
  isMain,
  onView,
  onDrag,
  onDragStateChange,
  onRemove,
  wrapStyle,
}: {
  image: VendorImageAsset;
  index: number;
  count: number;
  tileSize: number;
  /** uri de la photo en cours de glissement (null si aucune). */
  draggingUri: string | null;
  colors: AppPalette;
  accent: string;
  isMain: boolean;
  onView: () => void;
  /** L'index cible (la photo glissée est identifiée par son uri côté parent). */
  onDrag: (to: number) => void;
  onDragStateChange: (uri: string | null) => void;
  onRemove: () => void;
  /** Dimensions explicites de la tuile (grille mesurée) — évite l'étirement. */
  wrapStyle?: StyleProp<ViewStyle>;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const activeIndex = useSharedValue(index);

  // Identité par uri : après un réordonnancement l'index change mais le geste
  // de la photo glissée doit RESTER actif (sinon le glisser s'interrompt).
  const isThisDragging = draggingUri != null && draggingUri === image.uri;
  const gestureEnabled = draggingUri === null || isThisDragging;

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .minDistance(6)
    .enabled(gestureEnabled)
    .onStart(() => {
      activeIndex.value = index;
      scale.value = withTiming(1.1, { duration: 120 });
      zIndex.value = 10;
      runOnJS(onDragStateChange)(image.uri);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      const step = tileSize + GRID_GAP;
      if (step <= 0) return;
      const col = activeIndex.value % GRID_COLS;
      const row = Math.floor(activeIndex.value / GRID_COLS);
      const cx = col * step + e.translationX;
      const cy = row * step + e.translationY;
      const targetCol = Math.round(cx / step);
      const targetRow = Math.round(cy / step);
      const target = Math.max(0, Math.min(count - 1, targetRow * GRID_COLS + targetCol));
      if (target !== activeIndex.value) {
        activeIndex.value = target;
        runOnJS(onDrag)(target);
      }
    })
    .onFinalize(() => {
      translateX.value = withTiming(0, { duration: 140 });
      translateY.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(1, { duration: 140 });
      zIndex.value = 0;
      runOnJS(onDragStateChange)(null);
    });

  const tap = Gesture.Tap()
    .maxDuration(240)
    .enabled(gestureEnabled)
    .onEnd(() => {
      runOnJS(onView)();
    });

  // Tap gagne sur un appui court ; le pan (appui long) ne s'active qu'après l'échec du tap.
  const composed = Gesture.Exclusive(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  return (
    <View style={[styles.tileWrap, wrapStyle]}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.tile,
            { backgroundColor: colors.surfaceMuted },
            isThisDragging && {
              borderColor: accent,
              borderWidth: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
              elevation: 10,
            },
            animatedStyle,
          ]}>
          <Image source={{ uri: image.uri }} style={styles.tileImg} contentFit="cover" transition={120} />
        </Animated.View>
      </GestureDetector>
      {isMain ? (
        <View style={[styles.mainBadge, { backgroundColor: accent }]}>
          <Star size={9} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE + 0.5} />
          <ThemedText style={styles.mainBadgeTxt}>principale</ThemedText>
        </View>
      ) : null}
      <Pressable
        style={styles.tileRemove}
        onPress={onRemove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Supprimer la photo">
        <X size={14} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
      </Pressable>
    </View>
  );
}

/**
 * Champ photos — grille réordonnable :
 *  - Toucher une photo → visionneuse plein écran (zoom, swipe)
 *  - Maintenir + glisser une photo → change son ordre (la 1re reste la principale)
 *  - Chaque photo (y compris la principale) est supprimable
 */
export function VendorPhotoGalleryField({
  images,
  onAdd,
  onRemove,
  onReorder,
  colors,
  accent,
  mainRequired,
  max = MAX_GALLERY_PHOTOS,
}: GalleryProps) {
  const remaining = Math.max(0, max - images.length);
  const isEmpty = images.length === 0;
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [draggingUri, setDraggingUri] = useState<string | null>(null);
  // Mesurée dès le premier rendu (même grille vide) : la taille des tuiles est
  // donc TOUJOURS en pixels précis, aucun pourcentage ne transite à l'écran.
  const [gridWidth, setGridWidth] = useState(0);

  const tileSize = gridWidth > 0 ? (gridWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS : 0;

  // Taille EXPLICITE de chaque tuile : JAMAIS de flexGrow (qui étirait la
  // tuile « ajouter » à 100 % de la largeur quand elle était seule sur sa
  // rangée → énorme carte vide dans le formulaire). Chaque tuile fait
  // exactement 1/3 de la grille, qu'elle soit seule ou non, mesurée ou non.
  const tileStyle = (gridWidth > 0
    ? {
        width: tileSize,
        height: tileSize,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: tileSize as DimensionValue,
      }
    : {
        flexBasis: '30%' as DimensionValue,
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: '30%' as DimensionValue,
      }) as ViewStyle;

  // La position source est recalculée à partir de l'URI à l'appel (jamais
  // d'index périmé : le tableau `images` est toujours le plus récent).
  const handleDrag = useCallback(
    (to: number) => {
      if (draggingUri == null) return;
      const next = [...images];
      const from = next.findIndex((x) => x.uri === draggingUri);
      if (from === -1 || from === to) return;
      void Haptics.selectionAsync();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onReorder(next);
    },
    [images, draggingUri, onReorder],
  );

  // Visionneuse : on privilégie la data URL (toujours résolvable), sinon l'URI.
  const viewerUris = useMemo(() => images.map((i) => i.dataUrl || i.uri), [images]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText style={[styles.headerLabel, { color: colors.text }]}>
          Photos{mainRequired ? ' *' : ''}
        </ThemedText>
        <ThemedText style={[styles.counter, { color: colors.textMuted }]}>
          {images.length}/{max}
        </ThemedText>
      </View>
      <ThemedText style={[styles.hint, { color: colors.textMuted }]}>
        La première photo est la principale. Touchez une photo pour l&apos;agrandir — maintenez-la
        enfoncée puis glissez pour changer l&apos;ordre.
      </ThemedText>

      <View
        style={styles.grid}
        onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
        {images.map((img, i) => (
          <DraggableTile
            key={img.uri}
            image={img}
            index={i}
            count={images.length}
            tileSize={tileSize}
            draggingUri={draggingUri}
            colors={colors}
            accent={accent}
            isMain={i === 0}
            onView={() => setViewIndex(i)}
            onDrag={handleDrag}
            onDragStateChange={setDraggingUri}
            onRemove={() => onRemove(i)}
            wrapStyle={tileStyle}
          />
        ))}

        {remaining > 0 ? (
          <Pressable
            style={[
              isEmpty ? styles.addTileEmpty : styles.addTile,
              isEmpty ? null : tileStyle,
              { borderColor: accent, backgroundColor: colors.surface },
            ]}
            onPress={() => void onAdd()}
            accessibilityRole="button"
            accessibilityLabel="Ajouter des photos">
            <Plus size={isEmpty ? 18 : 24} color={accent} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.addTxt, { color: isEmpty ? colors.text : colors.textMuted }]}>
              {isEmpty ? 'Ajouter des photos' : 'ajouter'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <GalleryViewer
        visible={viewIndex !== null}
        images={viewerUris}
        initialIndex={viewIndex ?? 0}
        onClose={() => setViewIndex(null)}
      />
    </View>
  );
}

// Réexport pour compatibilité avec OptionGroupsEditor dans ce fichier
export { OptionGroupsEditor } from '@/components/vendor-option-groups-editor';

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: { fontSize: 15, fontWeight: '700' },
  counter: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 16, marginBottom: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 4,
    // Hauteur minimale même vide : garantit que la largeur de la grille est
    // mesurée dès le premier rendu (aucun rendu en pourcentage intermédiaire).
    minHeight: 52,
  },
  tileWrap: {
    flexGrow: 0,
    flexShrink: 0,
    position: 'relative',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tileImg: { width: '100%', height: '100%' },
  mainBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  mainBadgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  tileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTileEmpty: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTxt: { fontSize: 13, fontWeight: '600' },
});
