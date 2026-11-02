// Drawn icon set (Higgsfield, same style as the rest of the art). The sim writes
// resources as short tokens in its text; <Rich> swaps them for these icons so no
// emoji ever reaches the screen.

export type IconName = 'ramen' | 'water' | 'power' | 'copium' | 'rads' | 'degens' | 'bag' | 'log' | 'shill' | 'dig' | 'sound' | 'mute';

export const iconUrl = (n: IconName) => `/art/icons/${n}.webp`;

export function Icon({ name, size = 20, class: cls = '' }: { name: IconName; size?: number; class?: string }) {
  return <img class={`ico ${cls}`} src={iconUrl(name)} width={size} height={size} alt="" draggable={false} />;
}

/** Resource glyphs the sim uses inside its strings. */
const TOKENS: Record<string, IconName> = { '🍜': 'ramen', '💧': 'water', '⚡': 'power', '💊': 'copium', '☢': 'rads' };
const TOKEN_RE = /(🍜|💧|⚡|💊|☢)/u;
/** Anything else emoji-like is dropped. */
const STRAY = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?/gu;

/** Render sim text with resource tokens as inline icons and stray emoji removed. */
export function Rich({ text, size = 16 }: { text: string; size?: number }) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((p, i) => (TOKENS[p] ? <Icon key={i} name={TOKENS[p]} size={size} class="inline" /> : p.replace(STRAY, '').replace(/ {2,}/g, ' ')))}
    </>
  );
}

/** Same as <Rich>, as an HTML string for DOM nodes made outside Preact (world popups). */
export function richHtml(text: string, size = 18): string {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return text
    .split(TOKEN_RE)
    .map((p) => (TOKENS[p] ? `<img class="ico inline" src="${iconUrl(TOKENS[p])}" width="${size}" height="${size}" alt="">` : esc(p.replace(STRAY, ''))))
    .join('');
}
