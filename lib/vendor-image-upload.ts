import { Alert } from 'react-native';

import { ensureImageDataUrl, type VendorImageAsset } from '@/components/vendor-form-shared';
import { uploadImageBase64 } from '@/lib/uploads';

export type UploadedListingImages = {
  mainUrl?: string;
  galleryUrls: string[];
  allUrls: string[];
};

async function uploadOne(token: string, item: { uri: string; dataUrl: string }): Promise<string | null> {
  if (item.uri.startsWith('http') && !item.dataUrl) return item.uri;

  const dataUrl = item.dataUrl || (await ensureImageDataUrl(item));
  if (!dataUrl) return null;

  const up = await uploadImageBase64(token, { dataUrl, folder: 'products' });
  return up.url?.startsWith('http') ? up.url : null;
}

/**
 * Upload photo principale + galerie en parallèle pour plus de rapidité.
 */
export async function uploadVendorListingImages(
  token: string,
  main: { uri: string | null; dataUrl: string | null },
  gallery: VendorImageAsset[],
): Promise<UploadedListingImages> {
  // 1. Upload de l'image principale en priorité
  let mainUrl: string | undefined;
  if (main.uri || main.dataUrl) {
    mainUrl = (await uploadOne(token, {
      uri: main.uri ?? '',
      dataUrl: main.dataUrl ?? '',
    })) || undefined;
  }

  // 2. Upload de la galerie en parallèle
  const galleryPromises = gallery.map(item => uploadOne(token, item));
  const results = await Promise.all(galleryPromises);

  const galleryUrls: string[] = [];
  let failed = 0;

  for (const url of results) {
    if (url) {
      // Éviter de dupliquer l'image principale dans la galerie si elle a été choisie deux fois
      if (url !== mainUrl) {
        galleryUrls.push(url);
      }
    } else {
      failed++;
    }
  }

  if (failed > 0) {
    Alert.alert(
      'Photos',
      `${failed} photo(s) n'ont pas pu être envoyées. Vérifiez votre connexion et réessayez.`,
    );
  }

  const allUrls = [...(mainUrl ? [mainUrl] : []), ...galleryUrls];
  return { mainUrl, galleryUrls, allUrls };
}
