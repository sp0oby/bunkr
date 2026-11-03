// Big images that must be on screen the instant they're needed (the drop scene).
const cache = new Map<string, Promise<void>>();

/** Fetch and decode an image once; resolves when it can be drawn (or failed). */
export function preload(url: string): Promise<void> {
  let p = cache.get(url);
  if (!p) {
    const img = new Image();
    img.src = url;
    p = img.decode().catch(() => undefined);
    cache.set(url, p);
  }
  return p;
}

export const blastArt = (nukeSkin: string | null | undefined) => `/art/${nukeSkin === 'dog' ? 'drop-dog' : 'drop-end'}.webp`;
export const CALM_ART = '/art/cine-calm-clean.webp';
