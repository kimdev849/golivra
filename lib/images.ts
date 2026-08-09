export type ResizeOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'origin';
};

/**
 * URL affichable pour Expo Image (HTTP/S ou data URL renvoyée par l'API).
 * Inclut le support pour le redimensionnement dynamique via Supabase Storage.
 */
export function resolveRemoteImageUrl(
  url: string | null | undefined,
  options?: ResizeOptions
): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  // Si c'est une image Supabase, on peut injecter les paramètres de redimensionnement
  if (u.includes('supabase.co/storage/v1/object/public/')) {
    // Idempotence : l'URL contient déjà nos paramètres de redimensionnement
    // (ex. déjà passée dans resolveRemoteImageUrl) → on la retourne telle quelle.
    // Évite les doublons du type ?width=800&format=webp&...&width=800 qui
    // font échouer le rendu chez Supabase (galerie sombre/vide).
    if (/\?[^#]*\b(width|height|format|quality)=/.test(u)) return u;

    const { width, height, quality = 80, format = 'webp' } = options || {};
    
    // Si aucune option de redimensionnement, on retourne l'URL telle quelle
    if (!width && !height && format !== 'webp') return u;

    const params = new URLSearchParams();
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (quality) params.append('quality', quality.toString());
    if (format === 'webp') params.append('format', 'webp');

    const separator = u.includes('?') ? '&' : '?';
    return `${u}${separator}${params.toString()}`;
  }

  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('data:image/')) return u;
  return null;
}

/** Taille maximale (px) demandée pour les visionneuses plein écran. */
export const ZOOM_VIEWER_EDGE = 1800;

/**
 * URL d'image BORNÉE pour les visionneuses plein écran zoomables.
 *
 * Charger la photo en pleine résolution d'origine puis la zoomer fait exploser
 * la mémoire Android → l'app s'arrête (OOM). On demande un webp plafonné à
 * ZOOM_VIEWER_EDGE px : net sur tous les écrans, mémoire maîtrisée.
 */
export function resolveZoomImageUrl(url: string | null | undefined): string | null {
  return resolveRemoteImageUrl(url, {
    width: ZOOM_VIEWER_EDGE,
    height: ZOOM_VIEWER_EDGE,
    format: 'webp',
    quality: 82,
  });
}
