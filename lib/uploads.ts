import { apiFetch } from '@/lib/api';

export type UploadImageResult = {
  url: string;
  path: string;
  contentType: string;
  size: number;
};

/** Dossiers d'upload autorisés par l'API (voir upload.controller.js). */
export type UploadFolder = 'profiles' | 'enterprises' | 'products' | 'campagnes' | 'deliveries';

export async function uploadImageBase64(
  token: string,
  params: { dataUrl: string; folder: UploadFolder },
): Promise<UploadImageResult> {
  return apiFetch<UploadImageResult>('/api/uploads/image', {
    method: 'POST',
    token,
    jsonBody: params,
  });
}

export async function uploadImageBase64Public(params: {
  dataUrl: string;
  folder: UploadFolder;
}): Promise<UploadImageResult | null> {
  try {
    return await apiFetch<UploadImageResult>('/api/uploads/public-image', {
      method: 'POST',
      jsonBody: params,
    });
  } catch {
    return null;
  }
}

/**
 * Upload image : authentifié si token, sinon endpoint public.
 * Lève une erreur explicite si l’upload échoue (ne pas masquer l’échec à l’inscription).
 */
export async function uploadImageForSignup(
  token: string | null,
  params: { dataUrl: string; folder: UploadFolder },
): Promise<string> {
  if (token) {
    try {
      const result = await uploadImageBase64(token, params);
      return result.url;
    } catch (e) {
      const pub = await uploadImageBase64Public(params);
      if (pub?.url) return pub.url;
      throw e instanceof Error ? e : new Error("Impossible d'envoyer l'image.");
    }
  }
  const pub = await uploadImageBase64Public(params);
  if (!pub?.url) {
    throw new Error("Impossible d'envoyer l'image. Vérifiez votre connexion.");
  }
  return pub.url;
}
