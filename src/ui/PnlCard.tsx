// The shareable "PnL card": one image that sums up a run, made to be posted.
import { useEffect, useState } from 'preact/hooks';
import { MUTATORS, WEATHER, spriteFile } from '../sim/content';
import type { Game } from '../sim/game';

const W = 1200;
const H = 675;

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

const GOOD_TAGS = new Set(['SURVIVED', 'SOLD THE TOP']);

function status(e: NonNullable<Game['ending']>): string {
  if (e.survived) return 'SURVIVED';
  if (e.title === 'EXIT LIQUIDITY') return 'SOLD THE TOP';
  if (e.title === 'RUGGED YOUR OWN BUNKER') return 'RUG PULLED';
  if (e.tent) return 'TENT COLLAPSED';
  return 'LIQUIDATED';
}

/** Each ending gets its own scene; a plain liquidation keeps the drop (or the Good Boy Nuke). */
const ENDING_ART: Record<string, string> = {
  'MOON MISSION': 'moon',
  'WHALE HUNTER': 'whale',
  'EXIT LIQUIDITY': 'rug',
  'RUGGED YOUR OWN BUNKER': 'rug',
  'TENT COLLAPSED': 'tent',
  'BECAME THE RAIDERS': 'raiders',
  'RAMEN BARON': 'ramen',
};

function endingArt(e: NonNullable<Game['ending']>, nukeSkin: string | null): string {
  const scene = ENDING_ART[e.title] ?? (e.survived ? 'survived' : null);
  if (scene) return `/art/pnl/${scene}.webp`;
  return `/art/${nukeSkin === 'dog' ? 'drop-dog' : 'drop-end'}.webp`;
}

/** Net Worth After Apocalypse as a PnL: 1,000 is breaking even. */
export function pnlPercent(score: number): number {
  return Math.round((score / 1000 - 1) * 100);
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke = 8): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = '#0b0b10';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export async function renderPnlCard(game: Game, nukeSkin: string | null): Promise<HTMLCanvasElement> {
  const e = game.ending!;
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background: art for how the run ended, darkened, with a terminal grid over it.
  const bg = await load(endingArt(e, nukeSkin));
  ctx.fillStyle = '#120e0b';
  ctx.fillRect(0, 0, W, H);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    ctx.globalAlpha = 1;
  }
  const fade = ctx.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0, '#0b0b10f2');
  fade.addColorStop(0.5, '#0b0b10b0');
  fade.addColorStop(1, '#0b0b1018');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#ffffff10';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Brand + kicker.
  ctx.textBaseline = 'alphabetic';
  ctx.font = '64px "Lilita One", sans-serif';
  outlined(ctx, 'BUNKR', 56, 100, '#8cff4f', 10);
  ctx.font = '800 20px Nunito, sans-serif';
  ctx.fillStyle = '#b9b2d6';
  ctx.fillText('NET WORTH AFTER APOCALYPSE', 60, 136);

  // Ending + score + PnL.
  ctx.font = '72px "Lilita One", sans-serif';
  outlined(ctx, e.title, 56, 236, '#fff8ec', 10);
  const pnl = pnlPercent(e.score);
  ctx.font = '120px "Lilita One", sans-serif';
  outlined(ctx, e.score.toLocaleString(), 56, 372, '#ffbe3d', 12);
  const scoreW = ctx.measureText(e.score.toLocaleString()).width;
  ctx.font = '52px "Lilita One", sans-serif';
  outlined(ctx, `${pnl >= 0 ? '+' : ''}${pnl}%`, 80 + scoreW, 368, pnl >= 0 ? '#3ee06f' : '#ff4b3e', 8);

  // Tags.
  const tags = [
    e.daily ? 'DAILY DOOM' : `DEFCON ${e.defcon}`,
    ...(e.mutator ? [MUTATORS[e.mutator].name.toUpperCase()] : []),
    ...(e.weather && e.weather !== 'calm' ? [WEATHER[e.weather].name.toUpperCase()] : []),
    status(e),
  ];
  ctx.font = '22px "Lilita One", sans-serif';
  let tx = 58;
  for (const t of tags) {
    const w = ctx.measureText(t).width + 26;
    const isStatus = t === tags[tags.length - 1];
    ctx.fillStyle = !isStatus ? '#312d48' : GOOD_TAGS.has(t) ? '#3ee06f' : '#ff4b3e';
    ctx.strokeStyle = '#0b0b10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(tx, 404, w, 38, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isStatus ? '#0b0b10' : '#fff8ec';
    ctx.fillText(t, tx + 13, 431);
    tx += w + 10;
  }

  // Stats.
  const alive = game.alive.length;
  const stats: [string, string][] = [
    ['DAYS', String(Math.min(game.day, 30))],
    ['SURVIVORS', String(alive)],
    ['RAIDS WON', String(game.stats.raidsWon)],
    ['BAGS HELD', String(game.bags.length)],
    ['F REVIVES', String(game.stats.revives)],
  ];
  stats.forEach(([k, v], i) => {
    const x = 58 + i * 150;
    ctx.font = '800 15px Nunito, sans-serif';
    ctx.fillStyle = '#b9b2d6';
    ctx.fillText(k, x, 492);
    ctx.font = '44px "Lilita One", sans-serif';
    outlined(ctx, v, x, 540, '#fff8ec', 6);
  });

  // The crew that made it (or the last ones standing), kept in the right-hand zone so they
  // never cover the score or stats. Bigger crews squeeze together instead of spreading left.
  const seen = new Set<string>();
  const crew = (alive ? game.alive : game.dwellers)
    .filter((d) => !seen.has(`${d.arch}:${d.look}`) && !!seen.add(`${d.arch}:${d.look}`))
    .slice(0, 6);
  const faces = (await Promise.all(crew.map((d) => load(`/art/sprites/${spriteFile(d.arch, d.look)}.webp`)))).filter(
    (img): img is HTMLImageElement => !!img,
  );
  const ZONE_L = 790;
  const ZONE_R = 1175;
  const h = faces.length <= 3 ? 270 : faces.length <= 4 ? 250 : 225;
  const widths = faces.map((img) => (img.width / img.height) * h);
  const maxW = Math.max(0, ...widths);
  const step = faces.length > 1 ? Math.min(maxW * 0.9, (ZONE_R - ZONE_L - maxW) / (faces.length - 1)) : 0;
  const groupW = step * (faces.length - 1) + maxW;
  const left = ZONE_L + (ZONE_R - ZONE_L - groupW) / 2;
  faces.forEach((img, i) => {
    const w = widths[i];
    const cx = left + maxW / 2 + i * step;
    const y = H - 56 - h - 14 + (i % 2 ? 0 : -16);
    ctx.save();
    if (!alive) ctx.filter = 'grayscale(1) brightness(0.7)';
    ctx.drawImage(img, cx - w / 2, y, w, h);
    ctx.restore();
  });

  // Footer.
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, H - 56, W, 56);
  ctx.font = '800 18px Nunito, sans-serif';
  ctx.fillStyle = '#b9b2d6';
  const date = new Date().toISOString().slice(0, 10);
  ctx.fillText(`${location.host || 'bunkr'} · $BUNKR on Robinhood Chain · seed ${game.seed} · ${date}`, 58, H - 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8cff4f';
  ctx.font = '22px "Lilita One", sans-serif';
  ctx.fillText('the world is ending. the chart is green.', W - 40, H - 21);
  ctx.textAlign = 'left';
  return canvas;
}

/** Preview + download / copy / post. */
export function PnlModal({ game, nukeSkin, onClose }: { game: Game; nukeSkin: string | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void renderPnlCard(game, nukeSkin).then((c) => {
      setUrl(c.toDataURL('image/png'));
      c.toBlob((b) => setBlob(b), 'image/png');
    });
  }, []);
  const e = game.ending!;
  const pnl = pnlPercent(e.score);
  const text = `${e.title} in BUNKR. Net worth after the apocalypse: ${e.score.toLocaleString()} (${pnl >= 0 ? '+' : ''}${pnl}%). The world is ending. The chart is green. $BUNKR`;
  const copy = async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal pnl" onClick={(ev) => ev.stopPropagation()}>
        <div class="modal-title">YOUR PNL CARD</div>
        {url ? <img class="pnl-img" src={url} alt="PnL card" /> : <div class="board-empty">Printing your PnL…</div>}
        <div class="pnl-btns">
          <a class={`btn btn-green ${url ? '' : 'disabled'}`} href={url ?? undefined} download={`bunkr-pnl-${e.score}.png`}>DOWNLOAD</a>
          <button class="btn btn-dark" disabled={!blob} onClick={() => void copy()}>{copied ? 'COPIED' : 'COPY IMAGE'}</button>
          <a class="btn btn-amber" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">POST ON X</a>
        </div>
        <div class="deed-note">Posting opens X with the text ready. Attach the image you downloaded or copied.</div>
        <button class="btn btn-dark card-ok" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}
