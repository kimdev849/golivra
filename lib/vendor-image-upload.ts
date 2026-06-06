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
 * Upload photo principale + galerie. Retourne toutes les URLs HTTPS prêtes pour l'API.
 */
export async function uploadVendorListingImages(
  token: string,
  main: { uri: string | null; dataUrl: string | null },
  gallery: VendorImageAsset[],
): Promise<UploadedListingImages> {
  let mainUrl: string | undefined;
  const galleryUrls: string[] = [];

  if (main.uri || main.dataUrl) {
    const url = await uploadOne(token, {
      uri: main.uri ?? '',
      dataUrl: main.dataUrl ?? '',
    });
    if (url) mainUrl = url;
  }

  let failed = 0;
  for (const item of gallery) {
    const url = await uploadOne(token, item);
    if (url && url !== mainUrl) galleryUrls.push(url);
    else if (!url) failed += 1;
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
