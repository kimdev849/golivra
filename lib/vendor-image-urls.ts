/** Découpe image principale / galerie pour les formulaires vendeur. */
export function normalizeImageUrlList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u).trim()).filter((u) => u.startsWith('http'));
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    // Format JSON standard
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((u) => String(u).trim()).filter((u) => u.startsWith('http'));
        }
      } catch {
        /* ignore */
      }
    }
    // Format PostgreSQL array standard : {url1,url2}
    if (s.startsWith('{') && s.endsWith('}')) {
      return s
        .slice(1, -1)
        .split(',')
        .map((u) => u.replace(/^"(.*)"$/, '$1').trim())
        .filter((u) => u.startsWith('http'));
    }
  }
  return [];
}

export function splitMainAndGalleryUrls(
  imageUrl: string | null | undefined,
  imagesUrls: string[] | null | undefined,
): { main: string | null; gallery: string[] } {
  const raw = normalizeImageUrlList(imagesUrls);

  const main = imageUrl?.trim().startsWith('http') ? imageUrl.trim() : raw[0] ?? null;
  const gallery = main ? raw.filter((u) => u !== main) : raw.slice(main ? 0 : 1);

  return { main, gallery };
}

export function galleryAssetsFromUrls(urls: string[]): { uri: string; dataUrl: string }[] {
  return urls.map((uri) => ({ uri, dataUrl: '' }));
}
