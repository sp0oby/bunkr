// The community meme kit (memes.html): pick a template, type, download or share a PNG sized for X.
// Everything is drawn from the game's own art, so posts look like the game, not generic AI.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ARCHS, WEATHER, archTitle, spriteFile } from '../sim/content';
import type { ArchId, HatchMood, Weather } from '../sim/types';
import './page.css';

// ---------- drawing helpers ----------

const INK = '#0b0b10';
const RAD = '#8cff4f';
const AMBER = '#ffbe3d';
const RED = '#ff4b3e';
const TEXT = '#fff8ec';
const DISPLAY = '"Lilita One", sans-serif';
const BODY = '"Nunito", sans-serif';

const images = new Map<string, Promise<HTMLImageElement>>();
function img(src: string): Promise<HTMLImageElement> {
  if (!images.has(src)) {
    images.set(src, new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = src;
    }));
  }
  return images.get(src)!;
}

/** Cover-fit an image into a box, like CSS background-size: cover. */
function cover(c: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5) {
  const s = Math.max(w / im.width, h / im.height);
  const sw = w / s, sh = h / s;
  c.drawImage(im, (im.width - sw) / 2, (im.height - sh) * focusY, sw, sh, x, y, w, h);
}

/** Contain-fit an image into a box. */
function contain(c: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / im.width, h / im.height);
  c.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
}

/** Split text into lines that fit `max` pixels at the current font. */
function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (c.measureText(next).width > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Big outlined meme text, shrunk until it fits `maxLines` lines. Returns the block height. */
function memeText(
  c: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number,
  { size = 96, min = 40, maxLines = 3, color = TEXT, align = 'top' as 'top' | 'bottom', stroke = 0.14 } = {},
): number {
  if (!text.trim()) return 0;
  let s = size, lines: string[] = [];
  for (; s >= min; s -= 4) {
    c.font = `${s}px ${DISPLAY}`;
    lines = wrap(c, text.toUpperCase(), maxW);
    if (lines.length <= maxLines) break;
  }
  const lh = s * 1.05;
  const top = align === 'top' ? y : y - lh * lines.length;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(6, s * stroke);
  c.strokeStyle = INK;
  c.fillStyle = color;
  lines.forEach((l, i) => {
    c.strokeText(l, cx, top + i * lh);
    c.fillText(l, cx, top + i * lh);
  });
  return lh * lines.length;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** The corner tag on every post. */
function watermark(c: CanvasRenderingContext2D, W: number, H: number) {
  c.font = `${Math.round(W * 0.022)}px ${DISPLAY}`;
  c.textAlign = 'right';
  c.textBaseline = 'bottom';
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.fillStyle = RAD;
  const t = 'BUNKR · bunkr.run';
  c.strokeText(t, W - W * 0.025, H - W * 0.02);
  c.fillText(t, W - W * 0.025, H - W * 0.02);
}

/** CRT scanlines, the game's screen texture. */
function scanlines(c: CanvasRenderingContext2D, W: number, H: number, alpha = 0.08) {
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
}

// ---------- templates ----------

type Size = { w: number; h: number; label: string };
const SQUARE: Size = { w: 1080, h: 1080, label: '1080×1080 · square, for replies' };
const WIDE: Size = { w: 1600, h: 900, label: '1600×900 · 16:9, for posts' };

const MOODS: HatchMood[] = ['smug', 'laugh', 'neutral', 'panic', 'angry', 'cry', 'dead', 'sleep'];
const BACKDROPS = { title: 'The degens (title art)', 'surface-clean': 'The street, before', surface: 'The street, after', 'drop-end': 'The mushroom cloud', 'cine-calm': 'The skyline' } as const;
type Backdrop = keyof typeof BACKDROPS;

interface State {
  top: string;
  bottom: string;
  mood: HatchMood;
  vibe: number;
  arch: ArchId;
  look: number;
  weather: Weather;
  change: number;
  headline: string;
  backdrop: Backdrop;
}

interface Template {
  name: string;
  size: Size;
  fields: (keyof State)[];
  defaults: Partial<State>;
  draw: (c: CanvasRenderingContext2D, s: State, W: number, H: number) => Promise<void>;
}

const TEMPLATES: Record<string, Template> = {
  hatch: {
    name: 'HATCH reaction',
    size: SQUARE,
    fields: ['top', 'bottom', 'mood'],
    defaults: { top: 'me watching the chart', bottom: 'from inside the bunker', mood: 'smug' },
    async draw(c, s, W, H) {
      const g = c.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, W * 0.75);
      g.addColorStop(0, '#2c4a22');
      g.addColorStop(1, '#0d0a12');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      scanlines(c, W, H);
      contain(c, await img(`/art/hatch/${s.mood}.webp`), W * 0.16, H * 0.2, W * 0.68, H * 0.62);
      memeText(c, s.top, W / 2, H * 0.04, W * 0.9);
      memeText(c, s.bottom, W / 2, H * 0.94, W * 0.9, { align: 'bottom' });
    },
  },
  vibe: {
    name: 'Vibe meter',
    size: WIDE,
    fields: ['top', 'vibe', 'backdrop'],
    defaults: { top: '$BUNKR holders when the chart moves 0.3%', vibe: 15, backdrop: 'title' },
    async draw(c, s, W, H) {
      cover(c, await img(`/art/${s.backdrop}.webp`), 0, 0, W, H, 0.35);
      c.fillStyle = 'rgba(13,10,18,0.62)';
      c.fillRect(0, 0, W, H);
      scanlines(c, W, H, 0.06);
      memeText(c, s.top, W / 2, H * 0.06, W * 0.9, { size: 84 });
      // The meter.
      const mx = W * 0.08, my = H * 0.55, mw = W * 0.84, mh = H * 0.1;
      const grad = c.createLinearGradient(mx, 0, mx + mw, 0);
      [['#3d6bff', 0], ['#3ff0ff', 0.3], ['#3ee06f', 0.42], ['#3ee06f', 0.58], ['#ff6fbf', 0.7], [RED, 1]].forEach(([col, at]) => grad.addColorStop(at as number, col as string));
      roundRect(c, mx, my, mw, mh, mh / 2);
      c.fillStyle = grad;
      c.fill();
      c.lineWidth = 8;
      c.strokeStyle = INK;
      c.stroke();
      c.setLineDash([18, 12]);
      c.lineWidth = 5;
      c.strokeStyle = '#ffffff';
      roundRect(c, mx + mw * 0.4, my - 16, mw * 0.2, mh + 32, 18);
      c.stroke();
      c.setLineDash([]);
      const nx = mx + mw * (0.5 + s.vibe / 200);
      roundRect(c, nx - 11, my - 34, 22, mh + 68, 8);
      c.fillStyle = TEXT;
      c.fill();
      c.lineWidth = 7;
      c.strokeStyle = INK;
      c.stroke();
      // Ends, and HATCH reacting.
      c.font = `${Math.round(W * 0.032)}px ${DISPLAY}`;
      c.textBaseline = 'top';
      c.lineWidth = 8;
      c.strokeStyle = INK;
      c.textAlign = 'left';
      c.fillStyle = '#3ff0ff';
      c.strokeText('IT\'S SO OVER', mx, my + mh + 30);
      c.fillText('IT\'S SO OVER', mx, my + mh + 30);
      c.textAlign = 'right';
      c.fillStyle = '#ff6fbf';
      c.strokeText('WE\'RE SO BACK', mx + mw, my + mh + 30);
      c.fillText('WE\'RE SO BACK', mx + mw, my + mh + 30);
      const v = s.vibe;
      const mood: HatchMood = v < -70 ? 'cry' : v < -20 ? 'panic' : v > 70 ? 'angry' : v > 20 ? 'laugh' : 'smug';
      contain(c, await img(`/art/hatch/${mood}.webp`), W / 2 - H * 0.12, my + mh + 14, H * 0.24, H * 0.24);
    },
  },
  degen: {
    name: 'Which degen are you',
    size: SQUARE,
    fields: ['top', 'arch', 'look'],
    defaults: { top: 'tag yourself', arch: 'pete', look: 0 },
    async draw(c, s, W, H) {
      const a = ARCHS[s.arch];
      const glow = a.rarity === 'legendary' ? AMBER : a.rarity === 'rare' ? '#3ff0ff' : '#b9b2d6';
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, a.rarity === 'legendary' ? '#4a3210' : a.rarity === 'rare' ? '#163844' : '#2a2440');
      g.addColorStop(1, '#0d0a12');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      scanlines(c, W, H, 0.05);
      const top = memeText(c, s.top, W / 2, H * 0.035, W * 0.9, { size: 84, maxLines: 2 });
      // The card.
      const cx = W * 0.12, cy = H * 0.06 + top + 10, cw = W * 0.76, ch = H * 0.9 - top - 20;
      roundRect(c, cx, cy, cw, ch, 36);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.fill();
      c.lineWidth = 10;
      c.strokeStyle = INK;
      c.stroke();
      c.lineWidth = 4;
      c.strokeStyle = glow;
      roundRect(c, cx + 10, cy + 10, cw - 20, ch - 20, 28);
      c.stroke();
      contain(c, await img(`/art/sprites/${spriteFile(s.arch, s.look)}.webp`), cx + cw * 0.22, cy + 30, cw * 0.56, ch * 0.5);
      c.textAlign = 'center';
      c.textBaseline = 'top';
      let y = cy + ch * 0.56;
      c.font = `${Math.round(W * 0.026)}px ${DISPLAY}`;
      c.fillStyle = glow;
      c.fillText(a.rarity.toUpperCase(), W / 2, y);
      y += W * 0.04;
      y += memeText(c, archTitle(s.arch, s.look), W / 2, y, cw * 0.9, { size: 64, min: 36, maxLines: 1 }) + 12;
      for (const [label, text, col] of [['PERK', a.perk, '#3ee06f'], ['CURSE', a.curse, RED]] as const) {
        c.font = `800 ${Math.round(W * 0.026)}px ${BODY}`;
        const lines = wrap(c, `${label}: ${text}`, cw * 0.82);
        c.fillStyle = col;
        for (const l of lines.slice(0, 2)) {
          c.fillText(l, W / 2, y);
          y += W * 0.034;
        }
        y += 8;
      }
    },
  },
  weather: {
    name: 'Price action weather',
    size: WIDE,
    fields: ['change', 'bottom'],
    defaults: { change: -12, bottom: 'buy-the-dip runs pay' },
    async draw(c, s, W, H) {
      const kind: Weather = s.change >= 8 ? 'bull' : s.change <= -8 ? 'winter' : 'calm';
      const w = WEATHER[kind];
      const sky = c.createLinearGradient(0, 0, 0, H);
      const cols = kind === 'bull' ? ['#2a5a1a', '#0f2a0c'] : kind === 'winter' ? ['#9fd8ff', '#2c4a78'] : ['#5a5470', '#221d33'];
      sky.addColorStop(0, cols[0]);
      sky.addColorStop(1, cols[1]);
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      cover(c, await img('/art/surface.webp'), 0, H * 0.45, W, H * 0.55, 0.9);
      c.fillStyle = kind === 'winter' ? 'rgba(200,230,255,0.35)' : kind === 'bull' ? 'rgba(40,120,20,0.3)' : 'rgba(30,25,45,0.45)';
      c.fillRect(0, H * 0.45, W, H * 0.55);
      // Snow or rising sparks, seeded so every export looks the same.
      let r = 7;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      c.fillStyle = kind === 'winter' ? '#ffffff' : kind === 'bull' ? '#c6ff8f' : 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 160; i++) {
        c.beginPath();
        c.arc(rnd() * W, rnd() * H, 2 + rnd() * 5, 0, Math.PI * 2);
        c.fill();
      }
      scanlines(c, W, H, 0.05);
      const pct = `${s.change > 0 ? '+' : ''}${s.change}%`;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.font = `${Math.round(W * 0.034)}px ${DISPLAY}`;
      c.lineWidth = 8;
      c.strokeStyle = INK;
      c.fillStyle = s.change > 0 ? RAD : s.change < 0 ? '#ff8a80' : TEXT;
      c.strokeText(`$BUNKR ${pct} IN 24H`, W * 0.06, H * 0.08);
      c.fillText(`$BUNKR ${pct} IN 24H`, W * 0.06, H * 0.08);
      c.font = `${Math.round(W * 0.085)}px ${DISPLAY}`;
      c.lineWidth = 16;
      c.fillStyle = TEXT;
      c.strokeText(w.name.toUpperCase(), W * 0.06, H * 0.15);
      c.fillText(w.name.toUpperCase(), W * 0.06, H * 0.15);
      c.font = `800 ${Math.round(W * 0.026)}px ${BODY}`;
      c.lineWidth = 7;
      const desc = wrap(c, w.desc, W * 0.62);
      desc.forEach((l, i) => {
        c.strokeText(l, W * 0.06, H * 0.33 + i * W * 0.034);
        c.fillText(l, W * 0.06, H * 0.33 + i * W * 0.034);
      });
      memeText(c, s.bottom, W / 2, H * 0.92, W * 0.9, { size: 72, align: 'bottom' });
    },
  },
  breaking: {
    name: 'Breaking news',
    size: WIDE,
    fields: ['headline', 'bottom', 'backdrop'],
    defaults: { headline: 'Nukes inbound. Chart still green.', bottom: '75 seconds to get in', backdrop: 'surface-clean' },
    async draw(c, s, W, H) {
      cover(c, await img(`/art/${s.backdrop}.webp`), 0, 0, W, H, 0.4);
      const shade = c.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(120,0,0,0.25)');
      shade.addColorStop(1, 'rgba(10,0,0,0.7)');
      c.fillStyle = shade;
      c.fillRect(0, 0, W, H);
      scanlines(c, W, H, 0.07);
      // The BREAKING slab.
      c.font = `${Math.round(W * 0.06)}px ${DISPLAY}`;
      const bw = c.measureText('BREAKING').width + W * 0.05;
      c.save();
      c.translate(W * 0.06, H * 0.12);
      c.rotate(-0.025);
      roundRect(c, 0, 0, bw, W * 0.085, 18);
      c.fillStyle = RED;
      c.fill();
      c.lineWidth = 10;
      c.strokeStyle = INK;
      c.stroke();
      c.fillStyle = TEXT;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('BREAKING', W * 0.025, W * 0.044);
      c.restore();
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.font = `${Math.round(W * 0.058)}px ${DISPLAY}`;
      c.lineWidth = 14;
      c.lineJoin = 'round';
      c.strokeStyle = INK;
      c.fillStyle = TEXT;
      wrap(c, s.headline.toUpperCase(), W * 0.86).slice(0, 3).forEach((l, i) => {
        c.strokeText(l, W * 0.06, H * 0.3 + i * W * 0.064);
        c.fillText(l, W * 0.06, H * 0.3 + i * W * 0.064);
      });
      // The ticker strip.
      c.fillStyle = AMBER;
      c.fillRect(0, H * 0.84, W, H * 0.1);
      c.fillStyle = INK;
      c.fillRect(0, H * 0.84, W, 6);
      c.fillRect(0, H * 0.94 - 6, W, 6);
      c.font = `${Math.round(W * 0.03)}px ${DISPLAY}`;
      c.textBaseline = 'middle';
      c.fillText(s.bottom.toUpperCase(), W * 0.06, H * 0.89);
    },
  },
};

// ---------- the page ----------

const POST_TEXT = 'Made in the BUNKR Meme Kit ☢ bunkr.run/memes.html';

const ARCH_IDS = Object.keys(ARCHS) as ArchId[];

function Page() {
  const [tid, setTid] = useState('hatch');
  const t = TEMPLATES[tid];
  const [state, setState] = useState<State>({
    top: '', bottom: '', mood: 'smug', vibe: 0, arch: 'pete', look: 0, weather: 'winter', change: -12, headline: '', backdrop: 'title',
    ...TEMPLATES.hatch.defaults,
  });
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.all([document.fonts.load(`80px ${DISPLAY}`), document.fonts.load(`800 30px ${BODY}`)]).then(() => setReady(true));
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !ready) return;
    el.width = t.size.w;
    el.height = t.size.h;
    const c = el.getContext('2d')!;
    c.clearRect(0, 0, el.width, el.height);
    let live = true;
    void t.draw(c, state, el.width, el.height).then(() => live && watermark(c, el.width, el.height));
    return () => { live = false; };
  }, [tid, state, ready]);

  const pick = (id: string) => {
    setTid(id);
    setState((s) => ({ ...s, ...TEMPLATES[id].defaults }));
  };
  const set = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));
  const blob = () => new Promise<Blob | null>((ok) => canvas.current ? canvas.current.toBlob(ok, 'image/png') : ok(null));
  const fileName = () => `bunkr-${tid}-${Date.now()}.png`;
  const download = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const [shared, setShared] = useState(false);
  /** Phones: the share sheet with the image attached. Elsewhere: save it, then open a post on X to attach it to. */
  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName(), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: POST_TEXT });
      } catch {
        /* cancelled */
      }
      return;
    }
    await download();
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(POST_TEXT)}`, '_blank', 'noopener');
    setShared(true);
  };

  const has = (f: keyof State) => t.fields.includes(f);
  return (
    <div class="mk">
      <aside class="mk-side">
        <header class="mk-head">
          <h1>BUNKR MEME KIT</h1>
          <nav><a href="/">PLAY</a><a href="/guide.html">HOW TO PLAY</a></nav>
        </header>
        <p class="mk-sub">Make a meme from the game's own art. It's so over. We're so back. Post it.</p>
        <div class="mk-tpls">
          {Object.entries(TEMPLATES).map(([id, tp]) => (
            <button key={id} class={id === tid ? 'on' : ''} onClick={() => pick(id)}>{tp.name}</button>
          ))}
        </div>
        {has('top') && <label>Top text<textarea rows={2} value={state.top} onInput={(e) => set('top', e.currentTarget.value)} /></label>}
        {has('headline') && <label>Headline<textarea rows={2} value={state.headline} onInput={(e) => set('headline', e.currentTarget.value)} /></label>}
        {has('bottom') && <label>{tid === 'breaking' ? 'Ticker' : 'Bottom text'}<textarea rows={2} value={state.bottom} onInput={(e) => set('bottom', e.currentTarget.value)} /></label>}
        {has('mood') && (
          <label>HATCH's face
            <div class="mk-moods">
              {MOODS.map((m) => (
                <button key={m} class={m === state.mood ? 'on' : ''} onClick={() => set('mood', m)} title={m}><img src={`/art/hatch/${m}.webp`} alt={m} /></button>
              ))}
            </div>
          </label>
        )}
        {has('vibe') && (
          <label>Needle: {state.vibe < -20 ? 'so over' : state.vibe > 20 ? 'so back' : 'balanced'}
            <input type="range" min={-100} max={100} value={state.vibe} onInput={(e) => set('vibe', +e.currentTarget.value)} />
          </label>
        )}
        {has('change') && (
          <label>$BUNKR 24h change: {state.change > 0 ? '+' : ''}{state.change}%
            <input type="range" min={-40} max={40} value={state.change} onInput={(e) => set('change', +e.currentTarget.value)} />
          </label>
        )}
        {has('arch') && (
          <label>Degen
            <select value={state.arch} onChange={(e) => setState((s) => ({ ...s, arch: e.currentTarget.value as ArchId, look: 0 }))}>
              {ARCH_IDS.map((a) => <option key={a} value={a}>{ARCHS[a].name}</option>)}
            </select>
          </label>
        )}
        {has('look') && ARCHS[state.arch].looks > 1 && (
          <label>Look
            <div class="mk-row">
              {Array.from({ length: ARCHS[state.arch].looks }, (_, i) => (
                <button key={i} class={i === state.look ? 'on' : ''} onClick={() => set('look', i)}>Look {i + 1}</button>
              ))}
            </div>
          </label>
        )}
        {has('backdrop') && (
          <label>Background
            <select value={state.backdrop} onChange={(e) => set('backdrop', e.currentTarget.value as Backdrop)}>
              {Object.entries(BACKDROPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
        <div class="mk-btns">
          <button class="mk-dl" onClick={() => void share()}>SHARE ON X</button>
          <button class="mk-save" onClick={() => void download()}>DOWNLOAD PNG</button>
        </div>
        {shared && <small class="mk-hint">Saved. Attach the image to the post that just opened on X.</small>}
        <small>{t.size.label}</small>
      </aside>
      <main class="mk-main">
        <canvas ref={canvas} class={t.size.w === t.size.h ? 'sq' : 'wide'} />
      </main>
    </div>
  );
}

render(<Page />, document.getElementById('memes')!);
