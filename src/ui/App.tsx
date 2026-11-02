import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import { ARCHS, BAGS, LOCATIONS, PREP_NEWS, ROOMS, ROOM_ORDER, RUN_DAYS } from '../sim/content';
import { COPE_COST, type Game } from '../sim/game';
import { HOTSPOTS, WORKER_QUIPS } from '../sim/hotspots';
import type { Dweller, ResKey, Room } from '../sim/types';
import type { BunkerView } from '../render/view';

export type Drawer = 'degens' | 'bags' | 'log' | null;

export interface UiState {
  selected: number | null;
  buildAt: { floor: number; col: number } | null;
  speed: number;
  drawer: Drawer;
  /** Room popped out into the big view. */
  roomView: number | null;
}

type Set = (fn: () => void) => void;

const RES: { k: ResKey; icon: string; name: string }[] = [
  { k: 'ramen', icon: '🍜', name: 'Ramen — food AND money' },
  { k: 'water', icon: '💧', name: 'Water' },
  { k: 'power', icon: '⚡', name: 'Hopium — power' },
  { k: 'copium', icon: '💊', name: 'Copium — spend it to calm the vibes' },
];
const CARD_COLORS = ['btn-green', 'btn-pink', 'btn-red'];
const sprite = (d: Dweller) => `url(/art/sprites/${d.arch}.webp)`;

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
      {game.card && <Card game={game} />}
      {game.phase === 'drop' && <div class="drop-text">THE BOMBS HAVE DROPPED</div>}
      {game.ending && <End game={game} />}
    </div>
  );
}

function TopBar({ game, ui, set }: { game: Game; ui: UiState; set: Set }) {
  const caps = game.caps();
  return (
    <div class="topbar">
      <div class="brand">BUNKR</div>
      <div class="res-row">
        {RES.map(({ k, icon, name }) => {
          const r = game.rates[k];
          const v = game.res[k];
          return (
            <div class={`ticker ${v <= 0.5 ? 'empty' : v < caps[k] * 0.15 ? 'low' : ''}`} key={k} title={name}>
              <span class={`t-icon t-${k}`}>{icon}</span>
              <span class="t-main">
                <span class="t-val">{Math.floor(v)}<small>/{caps[k]}</small></span>
                <span class={`t-rate ${r >= 0 ? 'up' : 'down'}`}>{r >= 0 ? '+' : '−'}{Math.abs(r * 24).toFixed(0)}/day</span>
              </span>
              <span class="t-fill" style={{ width: `${Math.min(100, (v / caps[k]) * 100)}%` }} />
            </div>
          );
        })}
        <div class={`ticker ${game.rads > 50 ? 'empty' : ''}`} title="Radiation. Above 50 it hurts everyone. Liquidity Pools scrub it.">
          <span class="t-icon t-rads">☢</span>
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
            <span class="t-icon t-bomb">☢</span>
            <span class="t-main">
              <span class="t-val tminus">{Math.ceil(game.prepLeft)}<small>s</small></span>
              <span class="t-rate down" title="Everything costs more as the panic builds">prices {game.panicMult.toFixed(2)}×</span>
            </span>
            <button class="skip" onClick={() => game.skipPrep()} title="Drop the bombs now">SKIP</button>
          </>
        )}
        {game.phase === 'drop' && (
          <>
            <span class="t-icon t-bomb">☢</span>
            <span class="t-main"><span class="t-val tminus">NOW</span></span>
          </>
        )}
        {(game.phase === 'underground' || game.phase === 'ended') && (
          <>
            <span class="t-icon t-day">📅</span>
            <span class="t-main">
              <span class="t-val">DAY {Math.min(game.day, RUN_DAYS)}<small>/{RUN_DAYS}</small></span>
              <span class="daybar"><span style={{ width: `${game.dayProgress * 100}%` }} /></span>
            </span>
          </>
        )}
      </div>
      <div class="speed">
        {[0, 1, 2, 4].map((s) => (
          <button key={s} class={ui.speed === s ? 'on' : ''} onClick={() => set(() => (ui.speed = s))} title={s === 0 ? 'Pause (Space)' : `${s}x speed`}>
            {s === 0 ? '❚❚' : `${s}×`}
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
      <button class="btn btn-pink cope" disabled={game.res.copium < COPE_COST} onClick={() => game.cope()} title={`Spend ${COPE_COST} copium to calm the swing`}>
        💊 COPE
      </button>
    </div>
  );
}

function Toasts({ game }: { game: Game }) {
  const items = game.log.filter((l) => game.time - l.t < 5 && !l.text.startsWith('—')).slice(-3);
  return (
    <div class="toasts">
      {items.map((l) => (
        <div class={`toast toast-${l.kind}`} key={l.id}>{l.text}</div>
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
          <p>{shown}<span class="caret">▌</span></p>
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
          {ui.drawer === 'bags' && <Bags game={game} />}
          {ui.drawer === 'log' && <Log game={game} />}
        </div>
      )}
      <div class="dock-row">
        {game.phase === 'prep' && (
          <button class="dock-btn recruit" disabled={game.res.ramen < game.recruitCost()} onClick={() => game.recruit()} title="Shill the group chat: +1 degen">
            <span class="dock-ico">📱</span>
            <span>SHILL</span>
            <b class="badge cost">{game.recruitCost()}🍜</b>
          </button>
        )}
        <button class={`dock-btn ${ui.drawer === 'degens' ? 'on' : ''}`} onClick={() => toggle('degens')}>
          <span class="dock-ico">👥</span>
          <span>DEGENS</span>
          <b class="badge">{game.alive.length}</b>
          {idle > 0 && <b class="badge warn">{idle} idle</b>}
        </button>
        <button class={`dock-btn ${ui.drawer === 'bags' ? 'on' : ''}`} onClick={() => toggle('bags')}>
          <span class="dock-ico">🎒</span>
          <span>BAGS</span>
          <b class="badge">{game.bags.length}</b>
        </button>
        <button class={`dock-btn ${ui.drawer === 'log' ? 'on' : ''}`} onClick={() => toggle('log')}>
          <span class="dock-ico">📜</span>
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
        const where = d.status === 'dead' ? `liquidated day ${d.deathDay}` : d.status === 'expedition' ? '🧭 on the surface' : room ? ROOMS[room.type].short : 'IDLE';
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
            <span class="face" style={{ backgroundImage: sprite(d) }} />
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

function Bags({ game }: { game: Game }) {
  return (
    <>
      <div class="drawer-title">BAGS {game.bags.length}/5{game.bags.length > 5 ? ' — BAGHOLDER' : ''}</div>
      {game.bags.length === 0 && <div class="drawer-hint">No bags yet. Find them on expeditions, in the Meme Lab, or off dead raiders.</div>}
      {game.bags.map((b) => (
        <div class="bag" key={b}>
          <b>{BAGS[b].name}</b>
          <small>{BAGS[b].desc}</small>
        </div>
      ))}
    </>
  );
}

function Log({ game }: { game: Game }) {
  return (
    <>
      <div class="drawer-title">LOG</div>
      {game.log.slice(-30).reverse().map((l) => (
        <div class={`log-line log-${l.kind}`} key={l.id}>{l.text}</div>
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
          <span>{a.name} · {room ? ROOMS[room.type].name : 'unemployed'}</span>
          <button class="x" onClick={() => set(() => (ui.selected = null))}>✕</button>
        </div>
        <div class="dc-stats">
          {(['grind', 'brain', 'vibes', 'hands'] as const).map((k) => (
            <div key={k}><span>{k === 'hands' ? (game.stat(d, k) <= 2 ? '📄 HANDS' : '💎 HANDS') : k.toUpperCase()}</span><b>{game.stat(d, k)}</b></div>
          ))}
          <div><span>HP</span><b class={d.hp < 40 ? 'down' : ''}>{Math.round(d.hp)}</b></div>
        </div>
        <div class="dc-traits"><span class="up">✚ {a.perk}</span><span class="down">✖ {a.curse}</span></div>
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
          <div class={`rp-output ${powered ? '' : 'off'}`}>{game.roomOutput(room)}</div>
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
                const text = game.pokeHotspot(room.id, i);
                if (text) react(h.x, h.y, text, h.icon);
              }}
            >
              <span class="hs-icon">{h.icon}</span>
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
                onClick={() => react(s.x / 100, 0.42, `${w.name}: "${WORKER_QUIPS[Math.floor(Math.random() * WORKER_QUIPS.length)]}"`, '💬')}
              >
                <span class="rp-name">{w.name}</span>
                <img src={`/art/sprites/${w.arch}.webp`} style={{ transform: `scaleX(${s.flip ? -1 : 1})` }} draggable={false} alt={w.name} />
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
                <span class="burst">{r.icon}</span>
                {r.text}
              </div>
            );
          })}
        </div>

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

/** Cable-news chyron along the bottom of the screen during the countdown. */
function NewsTicker({ game }: { game: Game }) {
  const doubled = [...PREP_NEWS, ...PREP_NEWS];
  return (
    <div class="chyron">
      <div class="chyron-tag"><span class="dot" />BREAKING</div>
      <div class="chyron-clock">DOOMSDAY<b>11:59:{String(Math.max(0, Math.ceil(game.prepLeft))).padStart(2, '0')}</b></div>
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
      <b>⚔ {r.name}</b>
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
          {ROOM_ORDER.map((t) => {
            const def = ROOMS[t];
            const cost = game.buildCost(t);
            return (
              <button key={t} disabled={game.res.ramen < cost} onClick={() => set(() => { if (game.build(t, at.floor, at.col)) ui.buildAt = null; })}>
                <span class="build-thumb" style={{ backgroundImage: `url(/art/rooms/${t}.webp)` }} />
                <span class="build-body">
                  <b>{def.name}</b>
                  <small>{def.desc}</small>
                  <span>{cost} 🍜</span>
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
        <p class="card-body">{c.def.body(game, who)}</p>
        {c.result == null ? (
          <div class="card-opts">
            {c.def.options.map((o, i) => (
              <button class={`btn ${CARD_COLORS[i % CARD_COLORS.length]}`} key={i} onClick={() => game.chooseCard(i)}>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p class="card-result">{c.result}</p>
            <button class="btn btn-green card-ok" onClick={() => game.dismissCard()}>OK</button>
          </>
        )}
      </div>
    </div>
  );
}

function End({ game }: { game: Game }) {
  const e = game.ending!;
  return (
    <div class="modal-bg">
      <div class="modal end">
        <div class="end-kicker">NET WORTH AFTER APOCALYPSE</div>
        <div class="end-title">{e.title}</div>
        <p>{e.blurb}</p>
        <div class="end-score">{e.score.toLocaleString()}</div>
        <table>
          <tbody>
            {e.breakdown.map(([k, v]) => (
              <tr key={k}><td>{k}</td><td>{v.toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
        <div class="end-stats">
          Deaths {game.stats.deaths} · Quits {game.stats.quits} · Raids {game.stats.raidsWon}W/{game.stats.raidsLost}L · Cards {game.stats.cardsPlayed} · Seed {game.seed}
        </div>
        <button class="btn btn-green card-ok" onClick={() => location.reload()}>RUN IT BACK</button>
      </div>
    </div>
  );
}
