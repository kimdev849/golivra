import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';

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

async function assetToVendorImage(asset: ImagePicker.ImagePickerAsset): Promise<VendorImageAsset | null> {
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

type GalleryProps = {
  mainUri: string | null;
  gallery: VendorImageAsset[];
  onPickMain: () => void;
  onPickGallery: () => void;
  onRemoveGallery: (index: number) => void;
  colors: AppPalette;
  accent: string;
  mainRequired?: boolean;
};

/** Champ photos : principale + galerie avec tuile + cliquable. */
export function VendorPhotoGalleryField({
  mainUri,
  gallery,
  onPickMain,
  onPickGallery,
  onRemoveGallery,
  colors,
  accent,
  mainRequired,
}: GalleryProps) {
  const remaining = MAX_GALLERY_PHOTOS - gallery.length;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.hero, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
        onPress={() => void onPickMain()}>
        {mainUri ? (
          <Image source={{ uri: mainUri }} style={styles.heroImg} contentFit="cover" />
        ) : (
          <View style={styles.heroEmpty}>
            <Plus size={28} color={accent} strokeWidth={LUCIDE_STROKE} />
            <ThemedText style={[styles.heroHint, { color: colors.textMuted }]}>
              {mainRequired ? 'Photo principale *' : 'Photo principale'}
            </ThemedText>
          </View>
        )}
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {gallery.map((g, i) => (
          <View key={`${g.uri}-${i}`} style={styles.thumbWrap}>
            <Image source={{ uri: g.uri }} style={styles.thumb} contentFit="cover" />
            <Pressable style={styles.thumbRemove} onPress={() => onRemoveGallery(i)} hitSlop={6}>
              <X size={14} color={colors.onPrimary} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          </View>
        ))}
        {remaining > 0 ? (
          <Pressable
            style={[styles.addTile, { borderColor: accent, backgroundColor: colors.surface }]}
            onPress={() => void onPickGallery()}>
            <Plus size={22} color={accent} strokeWidth={LUCIDE_STROKE} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

// Réexport pour compatibilité avec OptionGroupsEditor dans ce fichier
export { OptionGroupsEditor } from '@/components/vendor-option-groups-editor';

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  hero: {
    height: 200,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImg: { width: '100%', height: '100%' },
  heroEmpty: { alignItems: 'center', gap: 8 },
  heroHint: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 10 },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 2,
  },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
