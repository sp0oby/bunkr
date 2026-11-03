import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import { ARCHS, BAGS, LOCATIONS, PREP_NEWS, ROOMS, ROOM_ORDER, RUN_DAYS, TENT_DAYS, archTitle, spriteFile } from '../sim/content';
import { AUDIT_FORM_SECONDS, type Game } from '../sim/game';
import type { RunRewards } from '../meta';
import { HOTSPOTS, WORKER_QUIPS } from '../sim/hotspots';
import type { BagId, Dweller, ResKey, Room } from '../sim/types';
import type { BunkerView } from '../render/view';
import { audio } from '../audio/audio';
import { Icon, Rich, type IconName } from './icons';
import { DeedModal, ForgePanel, enterAndGo } from './Deed';
import type { FinishReply } from '../chain/server';

export type Drawer = 'degens' | 'bags' | 'log' | null;

export interface UiState {
  selected: number | null;
  buildAt: { floor: number; col: number } | null;
  speed: number;
  drawer: Drawer;
  /** Room popped out into the big view. */
  roomView: number | null;
  /** Bag open in the inspect view. */
  inspectBag: BagId | null;
  /** What the finished run earned (set once the run is banked). */
  rewards: RunRewards | null;
  /** The results server's verdict on a ticketed run. Absent for Tent Mode and offline play. */
  verdict?: { state: 'pending' } | { state: 'ok'; reply: FinishReply } | { state: 'error'; error: string };
  verify?: () => void;
}

type Set = (fn: () => void) => void;

const RES: { k: ResKey; name: string }[] = [
  { k: 'ramen', name: 'Ramen — food AND money' },
  { k: 'water', name: 'Water' },
  { k: 'power', name: 'Hopium — power' },
  { k: 'copium', name: 'Copium — spend it to calm the vibes' },
];
const CARD_COLORS = ['btn-green', 'btn-pink', 'btn-red'];
const spriteUrl = (d: Dweller) => `/art/sprites/${spriteFile(d.arch, d.look)}.webp`;
const sprite = (d: Dweller) => `url(${spriteUrl(d)})`;

function useFrame(game: Game): void {
  const [, set] = useState(0);
  useEffect(() => {
    let last = '';
    const id = setInterval(() => {
      const key = `${game.version}:${game.time.toFixed(1)}`;
      if (key !== last) {
        last = key;
        set((n) => n + 1);
      }
    }, 100);
    return () => clearInterval(id);
  }, [game]);
}

export function App({ game, ui, view }: { game: Game; ui: UiState; view: BunkerView }) {
  useFrame(game);
  const focusFloor = (f: number) => view.focusFloor(f);
  const popped = ui.roomView != null ? game.roomById(ui.roomView) : undefined;
  const sel = game.dwellers.find((d) => d.id === ui.selected && d.status === 'active') ?? null;
  const set: Set = (fn) => {
    fn();
    game.touch();
  };

  return (
    <div class={`ui ${game.phase === 'prep' ? 'prep-on' : ''}`}>
      <TopBar game={game} ui={ui} set={set} />
      <Toasts game={game} />
      {game.phase === 'prep' && <NewsTicker game={game} />}
      {game.raid && <RaidBar game={game} />}
      <Hatch game={game} />
      <Dock game={game} ui={ui} set={set} focusFloor={focusFloor} />
      {sel && !popped && <DwellerCard game={game} d={sel} ui={ui} set={set} />}
      {popped && <RoomPopup key={popped.id} game={game} room={popped} ui={ui} set={set} view={view} />}
      {ui.buildAt && <BuildMenu game={game} ui={ui} set={set} />}
      {game.newLegend != null && !game.card && <LegendReveal game={game} set={set} />}
      {game.newBag && game.newLegend == null && !game.card && !ui.inspectBag && <BagReveal game={game} ui={ui} set={set} />}
      {ui.inspectBag && <BagInspect key={ui.inspectBag} game={game} id={ui.inspectBag} ui={ui} set={set} />}
      {game.audit && <AuditModal game={game} />}
      {game.card && <Card game={game} />}
      {game.phase === 'drop' && <Cinematic game={game} />}
      {game.ending && <End game={game} ui={ui} />}
    </div>
  );
}

function TopBar({ game, ui, set }: { game: Game; ui: UiState; set: Set }) {
  const caps = game.caps();
  return (
    <div class="topbar">
      <div class="brand">BUNKR</div>
      <div class="res-row">
        {RES.map(({ k, name }) => {
          const r = game.rates[k];
          const v = game.res[k];
          return (
            <div class={`ticker ${v <= 0.5 ? 'empty' : v < caps[k] * 0.15 ? 'low' : ''}`} key={k} title={name}>
              <span class={`t-icon t-${k}`}><Icon name={k as IconName} size={26} /></span>
              <span class="t-main">
                <span class="t-val">{Math.floor(v)}<small>/{caps[k]}</small></span>
                <span class={`t-rate ${r >= 0 ? 'up' : 'down'}`}>{r >= 0 ? '+' : '−'}{Math.abs(r * 24).toFixed(0)}/day</span>
              </span>
              <span class="t-fill" style={{ width: `${Math.min(100, (v / caps[k]) * 100)}%` }} />
            </div>
          );
        })}
        <div class={`ticker ${game.rads > 50 ? 'empty' : ''}`} title="Radiation. Above 50 it hurts everyone. Liquidity Pools scrub it.">
          <span class="t-icon t-rads"><Icon name="rads" size={26} /></span>
          <span class="t-main">
            <span class="t-val">{Math.round(game.rads)}</span>
            <span class={`t-rate ${game.rads > 50 ? 'down' : 'up'}`}>{game.rads > 50 ? 'HURTING' : 'rads'}</span>
          </span>
        </div>
      </div>
      <VibeBar game={game} />
      <div class={`clock ${game.phase === 'prep' ? 'counting' : ''}`}>
        {game.phase === 'prep' && (
          <>
            <span class="t-icon t-bomb"><Icon name="rads" size={26} /></span>
            <span class="t-main">
              <span class="t-val tminus">{Math.ceil(game.prepLeft)}<small>s</small></span>
              <span class="t-rate down" title="Everything costs more as the panic builds">prices {game.panicMult.toFixed(2)}×</span>
            </span>
            <button class="skip" onClick={() => game.skipPrep()} title="Drop the bombs now">SKIP</button>
          </>
        )}
        {game.phase === 'drop' && (
          <>
            <span class="t-icon t-bomb"><Icon name="rads" size={26} /></span>
            <span class="t-main"><span class="t-val tminus">NOW</span></span>
          </>
        )}
        {(game.phase === 'underground' || game.phase === 'ended') && (
          <>
            <span class="t-icon t-day">D</span>
            <span class="t-main">
              <span class="t-val">DAY {Math.min(game.day, RUN_DAYS)}<small>/{game.config.tent ? `${TENT_DAYS} TENT` : RUN_DAYS}</small></span>
              <span class="daybar"><span style={{ width: `${game.dayProgress * 100}%` }} /></span>
            </span>
          </>
        )}
      </div>
      <div class="speed">
        <button class={audio.muted ? '' : 'on-soft'} onClick={() => set(() => audio.toggleMute())} title="Sound on/off (M)">
          <Icon name={audio.muted ? 'mute' : 'sound'} size={24} />
        </button>
        {[0, 1, 2, 4].map((s) => (
          <button key={s} class={ui.speed === s ? 'on' : ''} onClick={() => set(() => (ui.speed = s))} title={s === 0 ? 'Pause (Space)' : `${s}x speed`}>
            {s === 0 ? <span class="pause-bars"><i /><i /></span> : `${s}×`}
          </button>
        ))}
      </div>
    </div>
  );
}

function VibeBar({ game }: { game: Game }) {
  const z = game.vibeZone();
  const zoneText = { cooked: 'DEGENS QUITTING', over: 'OUTPUT −25%', balanced: 'BALANCED · OUTPUT +20%', back: 'OUTPUT +10%', manic: 'DEGENS YOLO-ING OUTSIDE' }[z];
  return (
    <div class={`vibe zone-${z}`} title="Keep the needle inside the dashed zone. It swings on its own — COPE calms it.">
      <span class="v-end over">IT'S SO<br />OVER</span>
      <div class="v-mid">
        <span class="vibe-zone">{zoneText}</span>
        <div class="vibe-track">
          <div class="vibe-sweet" />
          <div class="vibe-needle" style={{ left: `${50 + game.vibe / 2}%` }} />
        </div>
      </div>
      <span class="v-end back">WE'RE<br />SO BACK</span>
      <button class="btn btn-pink cope" disabled={game.res.copium < game.copeCost()} onClick={() => game.cope()} title={`Spend ${game.copeCost()} copium to calm the swing`}>
        <Icon name="copium" size={20} /> COPE
      </button>
    </div>
  );
}

function Toasts({ game }: { game: Game }) {
  const items = game.log.filter((l) => game.time - l.t < 5 && !l.text.startsWith('—')).slice(-3);
  return (
    <div class="toasts">
      {items.map((l) => (
        <div class={`toast toast-${l.kind}`} key={l.id}><Rich text={l.text} /></div>
      ))}
    </div>
  );
}

/** HATCH, the bunker AI: a bobbing CRT that glitches when its mood changes and
 *  types its lines out in a comic speech bubble that tucks away when idle. */
function Hatch({ game }: { game: Game }) {
  const line = game.hatchLine;
  const [shown, setShown] = useState('');
  const [open, setOpen] = useState(false);
  const [glitch, setGlitch] = useState(0);

  useEffect(() => {
    setGlitch((n) => n + 1);
  }, [game.hatchMood]);

  useEffect(() => {
    if (!line) return;
    if (game.hatchVoice) void audio.voice(`/audio/hatch/${game.hatchVoice}.mp3`);
    setOpen(true);
    setShown('');
    let i = 0;
    const type = setInterval(() => {
      i += 2;
      setShown(line.slice(0, i));
      if (i >= line.length) clearInterval(type);
    }, 22);
    const hide = setTimeout(() => setOpen(false), 4000 + line.length * 45);
    return () => {
      clearInterval(type);
      clearTimeout(hide);
    };
  }, [line]);

  return (
    <div class={`hatch mood-${game.hatchMood}`} onClick={() => setOpen((o) => !o)}>
      <div class="hatch-bot">
        <img class={`hatch-img g${glitch % 2}`} src={`/art/hatch/${game.hatchMood}.webp`} alt="HATCH" draggable={false} />
        <span class="hatch-scan" />
      </div>
      {open && line && (
        <div class="hatch-bubble">
          <div class="hatch-name">HATCH<span>bunker OS v6.9</span></div>
          <p><Rich text={shown} /><span class="caret">▌</span></p>
        </div>
      )}
    </div>
  );
}

function Dock({ game, ui, set, focusFloor }: { game: Game; ui: UiState; set: Set; focusFloor: (f: number) => void }) {
  const idle = game.present.filter((d) => d.roomId == null).length;
  const toggle = (d: Drawer) => set(() => (ui.drawer = ui.drawer === d ? null : d));
  return (
    <div class="dock">
      {ui.drawer && (
        <div class="drawer panel scroll">
          {ui.drawer === 'degens' && <Roster game={game} ui={ui} set={set} focusFloor={focusFloor} />}
          {ui.drawer === 'bags' && <Bags game={game} ui={ui} set={set} />}
          {ui.drawer === 'log' && <Log game={game} />}
        </div>
      )}
      <div class="dock-row">
        {game.phase === 'prep' && (
          <button class="dock-btn recruit" disabled={game.res.ramen < game.recruitCost()} onClick={() => game.recruit()} title="Shill the group chat: +1 degen">
            <span class="dock-ico"><Icon name="shill" size={34} /></span>
            <span>SHILL</span>
            <b class="badge cost">{game.recruitCost()}<Icon name="ramen" size={13} class="inline" /></b>
          </button>
        )}
        <button class={`dock-btn ${ui.drawer === 'degens' ? 'on' : ''}`} onClick={() => toggle('degens')}>
          <span class="dock-ico"><Icon name="degens" size={34} /></span>
          <span>DEGENS</span>
          <b class="badge">{game.alive.length}</b>
          {idle > 0 && <b class="badge warn">{idle} idle</b>}
        </button>
        <button class={`dock-btn ${ui.drawer === 'bags' ? 'on' : ''}`} onClick={() => toggle('bags')}>
          <span class="dock-ico"><Icon name="bag" size={34} /></span>
          <span>BAGS</span>
          <b class="badge">{game.bags.length}</b>
        </button>
        <button class={`dock-btn ${ui.drawer === 'log' ? 'on' : ''}`} onClick={() => toggle('log')}>
          <span class="dock-ico"><Icon name="log" size={34} /></span>
          <span>LOG</span>
        </button>
      </div>
    </div>
  );
}

function Roster({ game, ui, set, focusFloor }: { game: Game; ui: UiState; set: Set; focusFloor: (f: number) => void }) {
  const list = game.dwellers.filter((d) => d.status !== 'gone');
  return (
    <>
      <div class="drawer-title">DEGENS</div>
      <div class="drawer-hint">Drag a degen into a room to put them to work.</div>
      {list.map((d) => {
        const room = game.roomById(d.roomId);
        const where = d.status === 'dead' ? `liquidated day ${d.deathDay}` : d.status === 'expedition' ? 'on the surface' : room ? ROOMS[room.type].short : 'IDLE';
        return (
          <div
            key={d.id}
            class={`r-row ${d.id === ui.selected ? 'sel' : ''} ${d.status} ${!room && d.status === 'active' ? 'idle' : ''}`}
            onClick={() => set(() => {
              if (d.status !== 'active') return;
              ui.selected = ui.selected === d.id ? null : d.id;
              focusFloor(room ? room.floor : 0);
            })}
          >
            <span class={`face r-${ARCHS[d.arch].rarity}`} style={{ backgroundImage: sprite(d) }} />
            <span class="r-text">
              <span class="r-name">{d.name}</span>
              <span class="r-where">{where}</span>
            </span>
            {d.status === 'dead' ? (
              <button class="f" disabled={d.fPaid} onClick={(e) => { e.stopPropagation(); game.payRespects(d.id); }}>F</button>
            ) : (
              <span class="hp"><span style={{ width: `${d.hp}%`, background: d.hp < 40 ? '#ff4b3e' : '#3ee06f' }} /></span>
            )}
          </div>
        );
      })}
    </>
  );
}

function Bags({ game, ui, set }: { game: Game; ui: UiState; set: Set }) {
  return (
    <>
      <div class="drawer-title">BAGS {game.bags.length}/{game.bagCap}{game.bags.length > game.bagCap ? ' — BAGHOLDER' : ''}</div>
      {game.bags.length === 0 && <div class="drawer-hint">No bags yet. Find them on expeditions, in the Meme Lab, or off dead raiders.</div>}
      <div class="bag-grid">
        {game.bags.map((b) => (
          <button class={`bag-tile r-${BAGS[b].rarity}`} key={b} onClick={() => set(() => (ui.inspectBag = b))} title={BAGS[b].desc}>
            <img src={`/art/bags/${b}.webp`} alt="" draggable={false} />
            <span>{BAGS[b].name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** A legendary degen crawled out of the porta-potty. */
function LegendReveal({ game, set }: { game: Game; set: Set }) {
  const d = game.dwellers.find((x) => x.id === game.newLegend);
  if (!d) return null;
  const a = ARCHS[d.arch];
  const close = () => set(() => (game.newLegend = null));
  return (
    <div class="modal-bg bag-reveal-bg" onClick={close}>
      <div class="bag-reveal legend r-legendary" onClick={(e) => e.stopPropagation()}>
        <div class="rays" />
        <div class="br-kicker">LEGENDARY DEGEN HAS ARRIVED</div>
        <img class="br-item legend-sprite" src={spriteUrl(d)} alt="" draggable={false} />
        <div class="br-name">{d.name}</div>
        <div class="legend-arch">{archTitle(d.arch, d.look)}</div>
        <div class="br-desc"><span class="up"><b>PERK</b> {a.perk}</span><br /><span class="down"><b>CURSE</b> {a.curse}</span></div>
        <div class="br-row"><button class="btn btn-amber" onClick={close}>WELCOME TO THE BUNKER</button></div>
      </div>
    </div>
  );
}

/** Big "you found a Bag" moment. */
function BagReveal({ game, ui, set }: { game: Game; ui: UiState; set: Set }) {
  const id = game.newBag!;
  const def = BAGS[id];
  useEffect(() => {
    const t = setTimeout(() => set(() => (game.newBag = null)), 7000);
    return () => clearTimeout(t);
  }, [id]);
  return (
    <div class="modal-bg bag-reveal-bg" onClick={() => set(() => (game.newBag = null))}>
      <div class={`bag-reveal r-${def.rarity}`} onClick={(e) => e.stopPropagation()}>
        <div class="rays" />
        <div class="br-kicker">NEW BAG · {def.rarity.toUpperCase()}</div>
        <img class="br-item" src={`/art/bags/${id}.webp`} alt="" draggable={false} />
        <div class="br-name">{def.name}</div>
        <div class="br-desc">{def.desc}</div>
        <div class="br-row">
          <button class="btn btn-dark" onClick={() => set(() => (game.newBag = null))}>NICE</button>
          <button class="btn btn-amber" onClick={() => set(() => { game.newBag = null; ui.inspectBag = id; })}>INSPECT</button>
        </div>
      </div>
    </div>
  );
}

/** Inspect a Bag: a big floating item you can tilt, its effect, and a button to use or fiddle with it. */
function BagInspect({ game, id, ui, set }: { game: Game; id: BagId; ui: UiState; set: Set }) {
  const def = BAGS[id];
  const [result, setResult] = useState<string | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [jiggle, setJiggle] = useState(0);
  const held = game.bags.includes(id);
  const close = () => set(() => (ui.inspectBag = null));
  return (
    <div class="modal-bg" onClick={close}>
      <div class={`modal bag-inspect r-${def.rarity}`} onClick={(e) => e.stopPropagation()}>
        <button class="x big bi-x" onClick={close}>✕</button>
        <div
          class="bi-stage"
          onPointerMove={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 30, y: ((e.clientY - r.top) / r.height - 0.5) * -30 });
          }}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <div class="bi-glow" />
          <img
            key={jiggle}
            class={`bi-item ${jiggle ? 'jiggle' : ''} ${held ? '' : 'gone'}`}
            src={`/art/bags/${id}.webp`}
            alt=""
            draggable={false}
            style={{ transform: `perspective(600px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
          />
        </div>
        <div class="bi-body">
          <span class={`rarity r-${def.rarity}`}>{def.rarity.toUpperCase()}</span>
          <div class="bi-name">{def.name}</div>
          <div class="bi-desc">{def.desc}</div>
          <div class="bi-flavor">“{def.flavor}”</div>
          {result && <div class="bi-result"><Rich text={result} /></div>}
          {held ? (
            <button
              class={`btn ${def.action.consume ? 'btn-green' : 'btn-amber'} bi-act`}
              onClick={() => {
                const text = game.useBag(id);
                if (!text) return;
                audio.play(def.action.consume ? 'bag' : 'boop');
                setResult(text);
                setJiggle((n) => n + 1);
              }}
            >
              {def.action.label}{def.action.consume && <small> · uses it up</small>}
            </button>
          ) : (
            <button class="btn btn-dark bi-act" onClick={close}>Gone. Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Log({ game }: { game: Game }) {
  return (
    <>
      <div class="drawer-title">LOG</div>
      {game.log.slice(-30).reverse().map((l) => (
        <div class={`log-line log-${l.kind}`} key={l.id}><Rich text={l.text} /></div>
      ))}
    </>
  );
}

function DwellerCard({ game, d, ui, set }: { game: Game; d: Dweller; ui: UiState; set: Set }) {
  const a = ARCHS[d.arch];
  const room = game.roomById(d.roomId);
  return (
    <div class="dcard panel">
      <span class="dc-portrait" style={{ backgroundImage: sprite(d) }} />
      <div class="dc-main">
        <div class="dc-head">
          <b>{d.name}</b>
          <span class={`rarity r-${a.rarity}`}>{a.rarity.toUpperCase()}</span>
          <span>{archTitle(d.arch, d.look)} · {room ? ROOMS[room.type].name : 'unemployed'}</span>
          <button class="x" onClick={() => set(() => (ui.selected = null))}>✕</button>
        </div>
        <div class="dc-stats">
          {(['grind', 'brain', 'vibes', 'hands'] as const).map((k) => (
            <div key={k}><span>{k === 'hands' ? (game.stat(d, k) <= 2 ? 'PAPER HANDS' : 'HANDS') : k.toUpperCase()}</span><b>{game.stat(d, k)}</b></div>
          ))}
          <div><span>HP</span><b class={d.hp < 40 ? 'down' : ''}>{Math.round(d.hp)}</b></div>
        </div>
        <div class="dc-traits"><span class="up"><b>PERK</b> {a.perk}</span><span class="down"><b>CURSE</b> {a.curse}</span></div>
        <div class="dc-hint">Drag them into a room · Reactor & Kitchen use GRIND · Pool & Lab use BRAIN · Copium, Grass & Shill use VIBES · Rug Detector uses HANDS</div>
      </div>
      {game.underground && (
        <div class="dc-exp">
          <b>SEND TO THE SURFACE</b>
          {LOCATIONS.map((l) => (
            <button class="btn btn-amber" key={l.id} onClick={() => set(() => { game.sendExpedition(d.id, l.id); ui.selected = null; })}>
              {l.name}
              <small>{l.dur}s · {Math.round(l.risk * 100)}%+ death risk</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Reaction {
  id: number;
  x: number;
  y: number;
  text: string;
  icon: string;
}

/** A room "popped out" of the bunker: the full painting, its degens walking the
 *  floor, clickable gag objects, and worker slots. */
function RoomPopup({ game, room, ui, set, view }: { game: Game; room: Room; ui: UiState; set: Set; view: BunkerView }) {
  const def = ROOMS[room.type];
  const ref = useRef<HTMLDivElement>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [spots, setSpots] = useState<Record<number, { x: number; flip: boolean }>>({});
  const workers = game.workersIn(room);
  const cap = game.capacity(room);
  const powered = room.type === 'reactor' || room.type === 'storage' || game.res.power > 0;

  // Spring out of the room's spot in the bunker.
  useEffect(() => {
    const el = ref.current;
    const from = view.roomScreenRect(room.id);
    audio.play('open');
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    gsap.fromTo(
      el,
      { x: from.x + from.w / 2 - (to.left + to.width / 2), y: from.y + from.h / 2 - (to.top + to.height / 2), scale: from.w / to.width, opacity: 0.4 },
      { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.3)' },
    );
  }, [room.id]);

  // Degens wander the floor of the painting.
  useEffect(() => {
    const move = () =>
      setSpots((prev) => {
        const next: Record<number, { x: number; flip: boolean }> = {};
        for (const w of game.workersIn(room)) {
          const old = prev[w.id]?.x ?? 15 + Math.random() * 65;
          const x = Math.random() < 0.6 ? 8 + Math.random() * 78 : old;
          next[w.id] = { x, flip: x < old };
        }
        return next;
      });
    move();
    const id = setInterval(move, 2600);
    return () => clearInterval(id);
  }, [room.id, workers.length]);

  const close = () => {
    audio.play('close');
    const el = ref.current;
    const to = view.roomScreenRect(room.id);
    if (!el || !to) return set(() => (ui.roomView = null));
    const r = el.getBoundingClientRect();
    gsap.to(el, {
      x: to.x + to.w / 2 - (r.left + r.width / 2), y: to.y + to.h / 2 - (r.top + r.height / 2), scale: to.w / r.width, opacity: 0,
      duration: 0.3, ease: 'power2.in', onComplete: () => set(() => (ui.roomView = null)),
    });
  };

  const react = (x: number, y: number, text: string, icon: string) => {
    const id = Date.now() + Math.random();
    setReactions((rs) => [...rs.slice(-2), { id, x, y, text, icon }]);
    setTimeout(() => setReactions((rs) => rs.filter((r) => r.id !== id)), 3800);
  };

  const idle = game.present.filter((d) => d.roomId == null);
  const bestIdle = () => (def.stat ? [...idle].sort((a, b) => game.stat(b, def.stat!) - game.stat(a, def.stat!))[0] : undefined);

  return (
    <div class="modal-bg room-bg" onClick={close}>
      <div class="room-pop" ref={ref} onClick={(e) => e.stopPropagation()}>
        <div class="rp-head">
          <div>
            <div class="rp-title">{def.name}{room.width > 1 && <span class="rp-size">×{room.width}</span>}</div>
            <div class="rp-sub">{def.desc}</div>
          </div>
          <div class={`rp-output ${powered ? '' : 'off'}`}><Rich text={game.roomOutput(room)} size={18} /></div>
          <button class="x big" onClick={close} title="Close (Esc)">✕</button>
        </div>

        <div class={`rp-stage ${powered ? '' : 'unpowered'}`} style={{ backgroundImage: `url(/art/rooms/${room.type}.webp)` }}>
          {!powered && <div class="rp-dark">NO POWER</div>}
          {HOTSPOTS[room.type].map((h, i) => (
            <button
              key={i}
              class={`hotspot ${game.hotspotReady(room.id, i) ? '' : 'cooling'}`}
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
              onClick={() => {
                audio.play(game.hotspotReady(room.id, i) ? 'boop' : 'denied');
                const text = game.pokeHotspot(room.id, i);
                if (text) react(h.x, h.y, text, '');
              }}
            >
              <span class="hs-mark" />
              <span class="hs-label">{h.label}</span>
            </button>
          ))}
          {workers.map((w) => {
            const s = spots[w.id] ?? { x: 50, flip: false };
            return (
              <div
                key={w.id}
                class="rp-worker"
                style={{ left: `${s.x}%` }}
                onClick={() => react(s.x / 100, 0.42, `${w.name}: "${WORKER_QUIPS[Math.floor(Math.random() * WORKER_QUIPS.length)]}"`, '')}
              >
                <span class="rp-name">{w.name}</span>
                <img src={spriteUrl(w)} style={{ transform: `scaleX(${s.flip ? -1 : 1})` }} draggable={false} alt={w.name} />
              </div>
            );
          })}
          {reactions.map((r) => {
            // Open below hotspots in the top half, above the rest, and keep it off the edges.
            const below = r.y < 0.5;
            const top = below ? r.y * 100 + 8 : r.y * 100 - 8;
            return (
              <div
                class={`reaction ${below ? 'below' : 'above'}`}
                key={r.id}
                style={{ left: `${Math.min(76, Math.max(24, r.x * 100))}%`, top: `${top}%` }}
              >
                <Rich text={r.text} />
              </div>
            );
          })}
        </div>

        {room.type === 'rocket' && (
          <div class="rocket-bar">
            <span>ROCKET {Math.floor(game.rocketProg)}%</span>
            <div class="rocket-track"><span style={{ width: `${game.rocketProg}%` }} /></div>
            <button class="btn btn-red" disabled={game.rocketProg < 100 || !game.underground || !!game.raid} onClick={() => { set(() => (ui.roomView = null)); game.launch(); }}>
              {game.rocketProg >= 100 ? 'LAUNCH · ends the run' : 'NOT READY'}
            </button>
          </div>
        )}
        {cap > 0 && (
          <div class="rp-slots">
            <span class="rp-slots-title">CREW {workers.length}/{cap}{def.stat && <small> · uses {def.stat.toUpperCase()}</small>}</span>
            {workers.map((w) => (
              <div class="slot" key={w.id}>
                <span class="face" style={{ backgroundImage: sprite(w) }} />
                <span class="slot-text"><b>{w.name}</b><small>{def.stat?.toUpperCase()} {game.stat(w, def.stat!)}</small></span>
                <button class="slot-x" title="Unassign" onClick={() => game.assign(w.id, null)}>✕</button>
              </div>
            ))}
            {Array.from({ length: cap - workers.length }).map((_, i) => {
              const cand = bestIdle();
              return (
                <button class="slot empty" key={`e${i}`} disabled={!cand} onClick={() => cand && game.assign(cand.id, room.id)}>
                  {cand ? <>+ Assign <b>{cand.name}</b><small>{def.stat?.toUpperCase()} {game.stat(cand, def.stat!)}</small></> : <small>no idle degens</small>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** The bombs drop: an in-engine cinematic built from two paintings — the calm
 *  street and the detonation — with a flash, shockwave, debris and shake. */
function Cinematic({ game }: { game: Game }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    audio.play('nuke'); // siren ~1.1s, then the boom lands on the flash
    const shards = [...el.querySelectorAll<HTMLElement>('.shard')];
    const tl = gsap.timeline({ onComplete: () => game.skipDrop() });
    tl.fromTo(q('.cine-calm'), { scale: 1 }, { scale: 1.06, duration: 1.1, ease: 'power1.in' }, 0)
      .to(q('.cine-sky'), { opacity: 0.6, duration: 1.1 }, 0)
      .set(q('.cine-flash'), { opacity: 1 }, 1.1)
      .set(q('.cine-blast'), { opacity: 1 }, 1.1)
      .set(q('.cine-calm'), { opacity: 0 }, 1.1)
      .to(q('.cine-flash'), { opacity: 0, duration: 1.0, ease: 'power2.out' }, 1.15)
      .fromTo(q('.cine-blast'), { scale: 1.25 }, { scale: 1.04, duration: 3.2, ease: 'power3.out' }, 1.1)
      .fromTo(q('.cine-ring'), { scale: 0, opacity: 1 }, { scale: 5, opacity: 0, duration: 1.6, ease: 'power2.out' }, 1.15)
      .fromTo(q('.cine-ring2'), { scale: 0, opacity: 0.8 }, { scale: 4, opacity: 0, duration: 2, ease: 'power2.out' }, 1.4)
      .fromTo(q('.cine-title'), { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' }, 2.1)
      .to(q('.cine-white'), { opacity: 1, duration: 0.6, ease: 'power2.in' }, 4.6);
    // Debris blasts outward from the fireball toward the camera.
    shards.forEach((sh, i) => {
      const a = (i / shards.length) * Math.PI * 2 + Math.random() * 0.5;
      const d = 600 + Math.random() * 900;
      tl.fromTo(sh, { x: 0, y: 0, scale: 0.2, rotate: 0, opacity: 1 },
        { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.6 + 200, scale: 1 + Math.random() * 2.5, rotate: (Math.random() - 0.5) * 900, opacity: 0, duration: 1.4 + Math.random() * 1.2, ease: 'power2.out' },
        1.15 + Math.random() * 0.3);
    });
    // Screen shake: hard on impact, rumbling after.
    const shake = gsap.to(q('.cine-shake'), { x: () => (Math.random() - 0.5) * 40, y: () => (Math.random() - 0.5) * 30, duration: 0.05, repeat: 70, repeatRefresh: true, delay: 1.1, ease: 'none' });
    return () => { tl.kill(); shake.kill(); };
  }, []);
  return (
    <div class="cinematic" ref={root}>
      <div class="cine-shake">
        <div class="cine-img cine-calm" style={{ backgroundImage: 'url(/art/cine-calm.webp)' }} />
        <div class="cine-sky" />
        <div class="cine-img cine-blast" style={{ backgroundImage: 'url(/art/drop-end.webp)' }} />
        <div class="cine-ring" />
        <div class="cine-ring2" />
        <div class="cine-debris">{Array.from({ length: 36 }).map((_, i) => <span class={`shard s${i % 4}`} key={i} />)}</div>
      </div>
      <div class="cine-flash" />
      <div class="cine-white" />
      <div class="cine-title">THE BOMBS HAVE DROPPED</div>
      <button class="btn btn-dark skip-cine" onClick={() => game.skipDrop()}>SKIP</button>
    </div>
  );
}

/** Midnight minus the countdown, as a clock face: 74s left reads 11:58:46. */
function doomsdayTime(secondsLeft: number): string {
  const t = 12 * 3600 - Math.max(0, Math.ceil(secondsLeft));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Cable-news chyron along the bottom of the screen during the countdown. */
function NewsTicker({ game }: { game: Game }) {
  const doubled = [...PREP_NEWS, ...PREP_NEWS];
  return (
    <div class="chyron">
      <div class="chyron-tag"><span class="dot" />BREAKING</div>
      <div class="chyron-clock">DOOMSDAY<b>{doomsdayTime(game.prepLeft)}</b></div>
      <div class="chyron-track">
        <div class="chyron-scroll">
          {doubled.map((n, i) => (
            <span key={i}>{n}<i>☢</i></span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RaidBar({ game }: { game: Game }) {
  const r = game.raid!;
  return (
    <div class="raid panel">
      <b>{r.name}</b>
      <div class="raid-track"><span style={{ width: `${(r.hp / r.maxHp) * 100}%` }} /></div>
      <small>{Math.ceil(30 - r.t)}s left · they stole {Math.round(r.stolen)} 🍜</small>
    </div>
  );
}

function BuildMenu({ game, ui, set }: { game: Game; ui: UiState; set: Set }) {
  const at = ui.buildAt!;
  return (
    <div class="modal-bg" onClick={() => set(() => (ui.buildAt = null))}>
      <div class="modal build" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">BUILD · FLOOR {at.floor + 1}</div>
        <div class="build-grid">
          {ROOM_ORDER.filter((t) => game.canBuildType(t)).map((t) => {
            const def = ROOMS[t];
            const cost = game.buildCost(t);
            return (
              <button key={t} disabled={game.res.ramen < cost} onClick={() => set(() => { if (game.build(t, at.floor, at.col)) ui.buildAt = null; })}>
                <span class="build-thumb" style={{ backgroundImage: `url(/art/rooms/${t}.webp)` }} />
                <span class="build-body">
                  <b>{def.name}</b>
                  <small>{def.desc}</small>
                  <span>{cost} <Icon name="ramen" size={16} class="inline" /></span>
                </span>
              </button>
            );
          })}
        </div>
        <div class="build-tip">Build the same room next to itself to merge it (up to 3 wide) for bonus output.</div>
      </div>
    </div>
  );
}

function Card({ game }: { game: Game }) {
  const c = game.card!;
  const who = game.dwellers.find((d) => d.id === c.dwellerId) ?? null;
  return (
    <div class="modal-bg">
      <div class="modal card">
        {who && <span class="card-face" style={{ backgroundImage: sprite(who) }} />}
        <div class="card-day">DAY {game.day} · INCOMING</div>
        <div class="card-title">{c.def.title}</div>
        <p class="card-body"><Rich text={c.def.body(game, who)} /></p>
        {c.result == null ? (
          <div class="card-opts">
            {c.def.options.map((o, i) => (
              <button class={`btn ${CARD_COLORS[i % CARD_COLORS.length]}`} key={i} onClick={() => game.chooseCard(i)}>
                <Rich text={o.label} />
                {o.hint && <small><Rich text={o.hint} /></small>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p class="card-result"><Rich text={c.result} /></p>
            <button class="btn btn-green card-ok" onClick={() => game.dismissCard()}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}

function End({ game, ui }: { game: Game; ui: UiState }) {
  const e = game.ending!;
  const r = ui.rewards;
  const [deedOpen, setDeedOpen] = useState(false);
  const again = async () => {
    const q = new URLSearchParams(location.search);
    q.delete('seed');
    if (e.daily) location.search = '';
    else if (!(await enterAndGo(q.toString(), false))) setDeedOpen(true);
  };
  return (
    <div class="modal-bg">
      <div class="modal end">
        <div class="end-kicker">{e.daily ? 'DAILY DOOM · ' : ''}DEFCON {e.defcon} · NET WORTH AFTER APOCALYPSE</div>
        <div class="end-title">{e.title}</div>
        <p>{e.blurb}</p>
        <div class="end-score">{e.score.toLocaleString()}</div>
        {r && (
          <div class="end-rewards">
            <span class="rf">+{r.rf} RF</span>
            {r.newBest && <span class="best">NEW BEST</span>}
            {r.unlockedDefcon && <span class="unlock">DEFCON {r.unlockedDefcon} UNLOCKED</span>}
          </div>
        )}
        <table>
          <tbody>
            {e.breakdown.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v.toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
        {ui.verdict && <Verdict ui={ui} />}
        {e.tent && (
          <div class="end-tent">
            <b>Your tent lasted {TENT_DAYS} days.</b> A Bunker Deed unlocks the full 30-day run, the whale, the audit and the Moon Mission.
            <button class="btn btn-green" onClick={() => setDeedOpen(true)}>GET A DEED</button>
          </div>
        )}
        {!e.daily && <ForgePanel bags={game.bags} />}
        <div class="end-stats">
          Deaths {game.stats.deaths} · Quits {game.stats.quits} · Raids {game.stats.raidsWon}W/{game.stats.raidsLost}L · Cards {game.stats.cardsPlayed} · Seed {game.seed}
        </div>
        <div class="end-row">
          <button class="btn btn-dark" onClick={() => (location.search = '')}>TITLE</button>
          {!e.daily && <button class="btn btn-green" onClick={() => void again()}>RUN IT BACK</button>}
        </div>
      </div>
      {deedOpen && <DeedModal onClose={() => setDeedOpen(false)} />}
    </div>
  );
}

/** What the results server made of a ticketed run. */
function Verdict({ ui }: { ui: UiState }) {
  const v = ui.verdict!;
  if (v.state === 'pending') return <div class="verdict pending">Verifying the run on the results server…</div>;
  if (v.state === 'error') {
    return (
      <div class="verdict err">
        <span>Not verified yet: {v.error}</span>
        <button class="btn btn-amber" onClick={() => ui.verify?.()}>RETRY</button>
      </div>
    );
  }
  const r = v.reply;
  return (
    <div class="verdict ok">
      <span class="verdict-badge">VERIFIED</span>
      <span>Replayed on the server: {r.score.toLocaleString()}{r.dailyRank ? ` · #${r.dailyRank} in today's Daily Doom` : ''}</span>
      {r.shattered.length > 0 && (
        <div class="verdict-shatter">
          SHATTERED: {r.shattered.map((b) => BAGS[b].name).join(', ')}. Liquidation is hard on forged Bags.
        </div>
      )}
    </div>
  );
}

/** Day 20 boss: stamp the real paperwork, reject the fraud, before the timer runs out. */
function AuditModal({ game }: { game: Game }) {
  const a = game.audit!;
  const form = a.forms[Math.min(a.idx, a.forms.length - 1)];
  return (
    <div class="modal-bg">
      <div class="modal audit">
        <img class="audit-agent" src="/art/sprites/secagent.webp" alt="" draggable={false} />
        <div class="card-day">DAY {game.day} · BOSS</div>
        <div class="card-title">THE S.E.C. AUDIT</div>
        <div class="audit-sub">Surface Enforcement Corps. Approve the real paperwork. Reject the fraud. Fast.</div>
        <div class="audit-progress">
          {a.forms.map((_, i) => (
            <span key={i} class={i < a.log.length ? (a.log[i] ? 'ok' : 'bad') : i === a.idx ? 'now' : ''} />
          ))}
        </div>
        {!a.done ? (
          <>
            <div class="audit-form" key={a.idx}>
              <div class="af-title">FORM {a.idx + 1}/6 · {form.title.toUpperCase()}</div>
              <div class="af-claim">{form.claim}</div>
              <div class="af-timer"><span style={{ width: `${(a.timer / AUDIT_FORM_SECONDS) * 100}%` }} /></div>
            </div>
            <div class="audit-btns">
              <button class="btn btn-green" onClick={() => game.answerAudit(true)}>APPROVE <small>A</small></button>
              <button class="btn btn-red" onClick={() => game.answerAudit(false)}>REJECT <small>D</small></button>
            </div>
          </>
        ) : (
          <>
            <p class="card-result"><Rich text={a.verdict ?? ''} /></p>
            <button class="btn btn-green card-ok" onClick={() => game.dismissAudit()}>BACK TO THE BUNKER</button>
          </>
        )}
      </div>
    </div>
  );
}
