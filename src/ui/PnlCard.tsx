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

  // Background: the drop, darkened, with a terminal grid over it.
  const bg = await load(`/art/${nukeSkin === 'dog' ? 'drop-dog' : 'drop-end'}.webp`);
  ctx.fillStyle = '#120e0b';
  ctx.fillRect(0, 0, W, H);
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
    ctx.globalAlpha = 1;
  }
  const fade = ctx.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0, '#0b0b10f2');
  fade.addColorStop(0.62, '#0b0b10c0');
  fade.addColorStop(1, '#0b0b1040');
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

  // The crew that made it (or the last ones standing).
  const crew = (alive ? game.alive : game.dwellers).slice(0, 6);
  const faces = await Promise.all(crew.map((d) => load(`/art/sprites/${spriteFile(d.arch, d.look)}.webp`)));
  faces.forEach((img, i) => {
    if (!img) return;
    const h = 250;
    const w = (img.width / img.height) * h;
    ctx.save();
    if (!alive) ctx.filter = 'grayscale(1) brightness(0.7)';
    ctx.drawImage(img, 1130 - (crew.length - i) * 92 - w / 2 + 40, 300 + (i % 2) * 18, w, h);
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
