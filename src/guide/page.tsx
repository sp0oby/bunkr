// The public "How to Play" page (guide.html). Not the in-game guide: this one is a scroll-driven
// tour with small toys to poke at (build a bunker, ride the vibes, roll a degen, smash a raider,
// press F). Numbers come from the game's own tables so they stay true.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Icon } from '../ui/icons';
import { TokenLinks } from '../ui/TokenLinks';
import {
  ARCHS, BAGS, MUTATORS, PREP_SECONDS, RARITY_WEIGHT, ROOMS, RUN_DAYS, STARTER_ARCHS, TENT_DAYS,
  archTitle, mutatorForDay, spriteFile, utcDayNow,
} from '../sim/content';
import { REVIVE_PRESSES, REVIVE_SECONDS } from '../sim/game';
import { STOCK_BAGS, TIERS, TIER_PERKS } from '../chain/constants';
import type { ArchId, BagId, MutatorId, RoomType } from '../sim/types';
import '../style.css';
import './page.css';

gsap.registerPlugin(ScrollTrigger);

const art = (p: string) => `/art/${p}`;
const hatch = (mood: string) => art(`hatch/${mood}.webp`);

function Hatch({ mood, line }: { mood: string; line: string }) {
  return (
    <div class="g-hatch g-rv">
      <img src={hatch(mood)} alt="" />
      <div class="g-bubble">{line}</div>
    </div>
  );
}

// ---------- Hero ----------

function Countdown() {
  const [t, setT] = useState(PREP_SECONDS);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x <= 0 ? PREP_SECONDS : x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return <div class={`g-count ${t <= 10 ? 'hot' : ''}`}>BOMBS DROP IN <b>0:{String(t).padStart(2, '0')}</b></div>;
}

function Hero() {
  return (
    <header class="g-hero">
      <div class="g-hero-art" />
      <div class="g-hero-in">
        <Countdown />
        <h1 class="g-logo">BUNKR</h1>
        <p class="g-tag">The world is ending. The chart is green. Get in.</p>
        <div class="g-ctas">
          <a class="btn btn-green" href="/">PLAY NOW</a>
          <a class="btn btn-amber" href="/?play=1&tutorial=1">TUTORIAL</a>
        </div>
        <TokenLinks class="g-tk" />
      </div>
      <div class="g-scroll">scroll to learn how not to die</div>
    </header>
  );
}

// ---------- The drop (pinned, scrubbed) ----------

function Drop() {
  return (
    <section class="g-drop">
      <div class="g-drop-img g-drop-dead" style={{ backgroundImage: `url(${art('surface.webp')})` }} />
      <div class="g-drop-img g-drop-clean" style={{ backgroundImage: `url(${art('surface-clean.webp')})` }} />
      <div class="g-drop-red" />
      <div class="g-flash" />
      <div class="g-drop-text">
        <div class="g-drop-a">You get <b>{PREP_SECONDS} seconds</b> on the surface.</div>
        <div class="g-drop-b">BREAKING: NUKES INBOUND</div>
        <div class="g-drop-c">Anyone still up here is <b>exit liquidity</b>.</div>
        <div class="g-drop-d">Down there, you have <b>{RUN_DAYS} days</b>.</div>
      </div>
    </section>
  );
}

// ---------- Build a bunker ----------

const BUILDABLE: { id: RoomType; makes: string; icon: 'power' | 'ramen' | 'water' | 'copium' | 'degens' | 'shill' }[] = [
  { id: 'reactor', makes: 'power', icon: 'power' },
  { id: 'kitchen', makes: 'ramen', icon: 'ramen' },
  { id: 'pool', makes: 'water', icon: 'water' },
  { id: 'copium', makes: 'copium', icon: 'copium' },
  { id: 'shill', makes: 'degens', icon: 'shill' },
  { id: 'rugdetector', makes: 'defense', icon: 'degens' },
];
const SLOTS = 6;

function Builder() {
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [res, setRes] = useState({ power: 0, ramen: 0, water: 0, copium: 0 });
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!rooms.length) return;
    const id = setInterval(() => setRes((r) => {
      const n = { ...r };
      for (const t of rooms) {
        const b = BUILDABLE.find((x) => x.id === t)!;
        if (b.makes in n) (n as any)[b.makes] += 3;
      }
      return n;
    }), 700);
    return () => clearInterval(id);
  }, [rooms]);
  const add = (t: RoomType) => {
    if (rooms.length >= SLOTS) return;
    setRooms([...rooms, t]);
    requestAnimationFrame(() => {
      const el = grid.current?.children[rooms.length];
      if (el) gsap.fromTo(el, { scale: 0.4, rotate: -6, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, ease: 'back.out(2.2)', duration: 0.55 });
    });
  };
  const full = rooms.length >= SLOTS;
  return (
    <div class="g-builder g-rv">
      <div class="g-tickers">
        {(['power', 'ramen', 'water', 'copium'] as const).map((k) => (
          <div key={k} class="g-tick"><Icon name={k} size={26} /><b>{res[k]}</b></div>
        ))}
      </div>
      <div class="g-grid" ref={grid}>
        {Array.from({ length: SLOTS }, (_, i) => {
          const t = rooms[i];
          return t
            ? <div key={i} class="g-slot built" style={{ backgroundImage: `url(${art(`rooms/${t}.webp`)})`, '--rc': `#${ROOMS[t].color.toString(16).padStart(6, '0')}` }}><span>{ROOMS[t].name}</span></div>
            : <div key={i} class="g-slot" style={{ backgroundImage: `url(${art('rooms/empty.webp')})` }}><span>dig here</span></div>;
        })}
      </div>
      <div class="g-palette">
        {BUILDABLE.map((b) => (
          <button key={b.id} class="g-pal" disabled={full} onClick={() => add(b.id)} style={{ '--rc': `#${ROOMS[b.id].color.toString(16).padStart(6, '0')}` }}>
            <Icon name={b.icon} size={22} />
            <span>{ROOMS[b.id].short}</span>
            <small>makes {b.makes}</small>
          </button>
        ))}
      </div>
      {full && <button class="g-reset" onClick={() => { setRooms([]); setRes({ power: 0, ramen: 0, water: 0, copium: 0 }); }}>bulldoze it, start over</button>}
    </div>
  );
}

// ---------- The vibe meter (a tiny game) ----------

function Vibes() {
  const [v, setV] = useState(0); // -100 (so over) .. 100 (so back)
  const [inZone, setInZone] = useState(0);
  const vel = useRef(0.6);
  const live = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (live.current = e.isIntersecting));
    if (box.current) io.observe(box.current);
    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (live.current) {
        // The pendulum: it drifts, and the drift grows the further out it gets.
        vel.current += (Math.random() - 0.5) * 3 * dt * 10;
        setV((x) => {
          const n = Math.max(-100, Math.min(100, x + vel.current * dt * 22 + x * dt * 0.25));
          if (Math.abs(n) >= 100) vel.current = -vel.current * 0.3;
          if (Math.abs(n) < 20) setInZone((z) => z + dt);
          return n;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);
  const cope = () => {
    vel.current *= 0.2;
    setV((x) => x * 0.35);
    if (box.current) gsap.fromTo(box.current.querySelector('.g-needle'), { scaleY: 1.4 }, { scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
  };
  const mood = v < -70 ? 'cry' : v < -20 ? 'panic' : v > 70 ? 'angry' : v > 20 ? 'laugh' : 'smug';
  const label = v < -70 ? 'IT\'S SO OVER. Degens are rage-quitting.' : v > 70 ? 'WE\'RE SO BACK. Kevin is going outside to buy the dip.' : Math.abs(v) < 20 ? 'Perfect. +20% output.' : v < 0 ? 'Getting gloomy...' : 'Getting frothy...';
  return (
    <div class="g-vibes g-rv" ref={box}>
      <div class="g-vibe-face"><img src={hatch(mood)} alt="" /></div>
      <div class="g-vibe-main">
        <div class="g-meter">
          <div class="g-zone" />
          <div class="g-needle" style={{ left: `${50 + v / 2}%` }} />
        </div>
        <div class="g-meter-ends"><span>IT'S SO OVER</span><span>WE'RE SO BACK</span></div>
        <div class={`g-vibe-msg ${Math.abs(v) > 70 ? 'bad' : Math.abs(v) < 20 ? 'good' : ''}`}>{label}</div>
        <div class="g-vibe-row">
          <button class="btn btn-pink g-cope" onClick={cope}>COPE</button>
          <span class="g-zone-time">in the zone: <b>{inZone.toFixed(1)}s</b></span>
        </div>
      </div>
    </div>
  );
}

// ---------- Roll a degen ----------

function rollArch(): { arch: ArchId; look: number } {
  const pool = STARTER_ARCHS.flatMap((a) => Array(RARITY_WEIGHT[ARCHS[a].rarity]).fill(a) as ArchId[]);
  const arch = pool[Math.floor(Math.random() * pool.length)];
  return { arch, look: Math.floor(Math.random() * ARCHS[arch].looks) };
}

function Gacha() {
  const [d, setD] = useState<{ arch: ArchId; look: number } | null>(null);
  const [count, setCount] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const roll = () => {
    const next = rollArch();
    const el = card.current;
    if (!el) return setD(next);
    gsap.timeline()
      .to(el, { rotateY: 90, duration: 0.18, ease: 'power2.in' })
      .add(() => { setD(next); setCount((c) => c + 1); })
      .to(el, { rotateY: 0, duration: 0.45, ease: 'back.out(2)' });
  };
  const a = d && ARCHS[d.arch];
  return (
    <div class="g-gacha g-rv">
      <div class="g-card-wrap">
        <div ref={card} class={`g-dcard ${a ? a.rarity : 'back'}`}>
          {a && d ? (
            <>
              <div class="g-rar">{a.rarity.toUpperCase()}</div>
              <img src={art(`sprites/${spriteFile(d.arch, d.look)}.webp`)} alt="" />
              <b>{archTitle(d.arch, d.look)}</b>
              <p class="g-perk">{a.perk}</p>
              <p class="g-curse">{a.curse}</p>
            </>
          ) : (
            <div class="g-card-back"><span>?</span><small>a degen wants in</small></div>
          )}
        </div>
      </div>
      <div class="g-gacha-side">
        <button class="btn btn-amber g-shill" onClick={roll}>{count ? 'SHILL AGAIN' : 'SHILL THE GROUP CHAT'}</button>
        <p>{Object.keys(ARCHS).length} kinds. Every one has a perk <i>and</i> a curse. Legendaries are rare.</p>
        {count > 0 && <small>{count} degen{count > 1 ? 's' : ''} recruited. HATCH is not impressed.</small>}
      </div>
    </div>
  );
}

// ---------- Bosses (horizontal, pinned) ----------

const BOSSES = [
  { day: 10, name: 'The Liquidators', art: 'sprites/raider.webp', line: 'They raid. They steal ramen. Click them until they stop.' },
  { day: 20, name: 'The S.E.C.', art: 'sprites/secagent.webp', line: 'An audit. Approve the real paperwork, reject the fraud. Fast.' },
  { day: 28, name: 'The Mutant Whale', art: 'sprites/whale.webp', line: 'One giant sell wall with teeth. Survive this, you\'ve basically won.' },
];

function Bosses() {
  return (
    <section class="g-bosses">
      <div class="g-day">DAY <b class="g-day-n">1</b> / {RUN_DAYS}</div>
      <div class="g-boss-track">
        <div class="g-boss-intro">
          <h2>Three bosses.<br />Thirty days.</h2>
          <p>Keep scrolling. They're coming.</p>
        </div>
        {BOSSES.map((b) => (
          <div key={b.name} class="g-boss">
            <img src={art(b.art)} alt="" />
            <div>
              <em>DAY {b.day}</em>
              <h3>{b.name}</h3>
              <p>{b.line}</p>
            </div>
          </div>
        ))}
        <div class="g-boss-intro end">
          <h2>Day {RUN_DAYS}.</h2>
          <p>Anyone still breathing counts. You win.</p>
        </div>
      </div>
    </section>
  );
}

// ---------- Smash a raider ----------

const RAIDER_HP = 30;

function Smash() {
  const [hp, setHp] = useState(RAIDER_HP);
  const [hits, setHits] = useState(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; crit: boolean }[]>([]);
  const body = useRef<HTMLImageElement>(null);
  // Refs, not state, so fast clicks between renders all count.
  const hpNow = useRef(RAIDER_HP), hitsNow = useRef(0);
  const hit = (e: MouseEvent) => {
    if (hpNow.current <= 0) return;
    const n = ++hitsNow.current;
    const crit = n % 10 === 0;
    setHits(n);
    const left = hpNow.current = Math.max(0, hpNow.current - (crit ? 5 : 1));
    setHp(left);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = Date.now() + Math.random();
    setPops((p) => [...p.slice(-8), { id, x: e.clientX - r.left, y: e.clientY - r.top, crit }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 700);
    if (body.current) gsap.fromTo(body.current, { x: crit ? 14 : 6, scale: 0.94 }, { x: 0, scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
    if (left <= 0 && body.current) {
      gsap.to(body.current, { y: 140, rotate: 70, opacity: 0, duration: 0.7, ease: 'power2.in' });
      setTimeout(() => { hpNow.current = RAIDER_HP; hitsNow.current = 0; setHp(RAIDER_HP); setHits(0); if (body.current) gsap.fromTo(body.current, { y: -200, rotate: 0, opacity: 1 }, { y: 0, duration: 0.6, ease: 'bounce.out' }); }, 2200);
    }
  };
  return (
    <div class="g-smash g-rv">
      <div class="g-smash-stage" onClick={hit}>
        <img ref={body} src={art('sprites/raider.webp')} alt="A raider" draggable={false} />
        {pops.map((p) => <span key={p.id} class={`g-pop ${p.crit ? 'crit' : ''}`} style={{ left: p.x, top: p.y }}>{p.crit ? 'CRIT!' : 'SMASH'}</span>)}
        {hp <= 0 && <div class="g-win">RAID REPELLED</div>}
      </div>
      <div class="g-smash-side">
        <h3>Smash the raider</h3>
        <p>Your crew fights on its own. You can help. Every 10th hit crits.</p>
        <div class="g-hp"><i style={{ width: `${(hp / RAIDER_HP) * 100}%` }} /></div>
        <small>{hits} hits</small>
      </div>
    </div>
  );
}

// ---------- Press F ----------

const F_NEEDED = REVIVE_PRESSES;

function PressF() {
  const [n, setN] = useState(0);
  const [left, setLeft] = useState(REVIVE_SECONDS);
  const [state, setState] = useState<'idle' | 'on' | 'saved' | 'gone'>('idle');
  const key = useRef<HTMLButtonElement>(null);
  const press = () => {
    if (state === 'saved' || state === 'gone') return;
    if (state === 'idle') setState('on');
    setN((x) => {
      const y = x + 1;
      if (y >= F_NEEDED) setState('saved');
      return y;
    });
    if (key.current) gsap.fromTo(key.current, { scale: 0.88 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
  };
  useEffect(() => {
    if (state !== 'on') return;
    const id = setInterval(() => setLeft((t) => {
      if (t <= 0.1) { setState('gone'); return 0; }
      return t - 0.1;
    }), 100);
    return () => clearInterval(id);
  }, [state]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'f' && document.querySelector('.g-f:hover, .g-f.armed')) { e.preventDefault(); press(); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });
  const reset = () => { setN(0); setLeft(REVIVE_SECONDS); setState('idle'); };
  const pct = Math.min(1, n / F_NEEDED);
  return (
    <div class={`g-f g-rv ${state !== 'idle' ? 'armed' : ''}`}>
      <div class="g-f-ring" style={{ '--p': pct }}>
        <button ref={key} class="g-fkey" onClick={press}>F</button>
      </div>
      <div class="g-f-side">
        <h3>{state === 'saved' ? 'Kevin is back. Somehow.' : state === 'gone' ? 'Kevin is gone. Press F.' : 'Kevin just got liquidated.'}</h3>
        <p>{state === 'idle' ? `Mash F (or tap) ${F_NEEDED} times in ${REVIVE_SECONDS} seconds to bring him back. One chance per degen.` : state === 'on' ? `${n} / ${F_NEEDED} · ${left.toFixed(1)}s left` : `${n} presses.`}</p>
        {(state === 'saved' || state === 'gone') && <button class="g-reset" onClick={reset}>try again</button>}
      </div>
    </div>
  );
}

// ---------- Bags ----------

function Bags() {
  const ids = Object.keys(BAGS) as BagId[];
  const [pick, setPick] = useState<BagId>('ramenprinter');
  const b = BAGS[pick];
  const info = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // Each new pick pops in with a burst of sparks in its rarity color.
  useEffect(() => {
    const el = info.current;
    if (!el || first.current) { first.current = false; return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(el.querySelector('.g-bag-hero'), { scale: 0.3, rotate: -25, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.6, ease: 'back.out(2.4)' });
    gsap.fromTo(el.querySelectorAll('.g-bag-txt > *'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.05, delay: 0.1 });
    const burst = el.querySelector('.g-burst')!;
    burst.replaceChildren();
    const n = b.rarity === 'legendary' ? 18 : b.rarity === 'rare' ? 12 : 8;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      burst.appendChild(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 90 + Math.random() * 80;
      gsap.fromTo(s, { x: 0, y: 0, scale: 1, opacity: 1 }, { x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0, duration: 0.7 + Math.random() * 0.4, ease: 'power3.out', onComplete: () => s.remove() });
    }
  }, [pick]);
  return (
    <div class="g-bags g-rv">
      <div class="g-bag-grid">
        {ids.map((id) => (
          <button key={id} class={`g-bag ${BAGS[id].rarity} ${id === pick ? 'on' : ''}`} onClick={() => setPick(id)} onMouseEnter={() => setPick(id)}>
            <img src={art(`bags/${id}.webp`)} alt={BAGS[id].name} />
          </button>
        ))}
      </div>
      <div class={`g-bag-info ${b.rarity}`} ref={info}>
        <div class="g-rays" />
        <div class="g-glow" />
        <div class="g-motes">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>
        <div class="g-bag-stage">
          <div class="g-burst" />
          <img class="g-bag-hero" src={art(`bags/${pick}.webp`)} alt="" />
        </div>
        <div class="g-bag-txt">
          <div class="g-rar">{b.rarity.toUpperCase()}</div>
          <b>{b.name}</b>
          <p>{b.desc}</p>
          <small>"{b.flavor}"</small>
        </div>
      </div>
    </div>
  );
}

// ---------- $BUNKR ----------

const TIER_MIN = [0, 10_000, 100_000, 1_000_000, 8_000_000];
const fmt = (n: number) => n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`;

function DeedSlider() {
  const [v, setV] = useState(62);
  const bal = v === 0 ? 0 : Math.round(10 ** (v / 100 * 7.2));
  const tier = TIER_MIN.filter((m) => bal >= m).length - 1;
  return (
    <div class="g-deed g-rv">
      <div class="g-deed-top">
        <span>hold</span><b>{fmt(bal)} $BUNKR</b>
      </div>
      <input type="range" min={0} max={100} value={v} onInput={(e) => setV(+(e.currentTarget as HTMLInputElement).value)} />
      <div class="g-ladder">
        {TIERS.map((t, i) => (
          <div key={t} class={`g-rung t${i} ${i <= tier ? 'lit' : ''} ${i === tier ? 'cur' : ''}`}>
            <b>{t}</b><small>{i ? fmt(TIER_MIN[i]) : 'free'}</small>
          </div>
        ))}
      </div>
      <p class="g-deed-perk"><b>{TIERS[tier]}:</b> {TIER_PERKS[tier]}</p>
    </div>
  );
}

function WeatherSlider() {
  const [c, setC] = useState(3);
  const w = c >= 8 ? 'bull' : c <= -8 ? 'winter' : 'calm';
  const name = { bull: 'Bull Run Weather', winter: 'Nuclear Winter', calm: 'Crab Market' }[w];
  const fx = { bull: 'More loot, hotter vibes, more rads.', winter: 'Less loot, weaker raiders, score x1.2.', calm: 'Quiet out there. Suspiciously quiet.' }[w];
  return (
    <div class={`g-wx g-rv wx-${w}`}>
      <div class="g-wx-sky"><div class="g-wx-fx" /></div>
      <div class="g-wx-in">
        <div class="g-wx-chg">$BUNKR 24h: <b class={c > 0 ? 'up' : c < 0 ? 'dn' : ''}>{c > 0 ? '+' : ''}{c}%</b></div>
        <input type="range" min={-20} max={20} value={c} onInput={(e) => setC(+(e.currentTarget as HTMLInputElement).value)} />
        <h3>{name}</h3>
        <p>{fx}</p>
      </div>
    </div>
  );
}

/** The Stonk Exchange's six legendary Stock Bags: tap one to see its power. */
function StockBags() {
  const [pick, setPick] = useState<BagId>(STOCK_BAGS[0]);
  const b = BAGS[pick];
  return (
    <div class="g-stocks g-rv">
      <div class="g-stock-row">
        {STOCK_BAGS.map((id) => (
          <button key={id} class={`g-stock ${id === pick ? 'on' : ''}`} onClick={() => setPick(id)} onMouseEnter={() => setPick(id)}>
            <span class="g-stock-tk">{BAGS[id].stock}</span>
            <img src={art(`bags/${id}.webp`)} alt={BAGS[id].name} />
          </button>
        ))}
      </div>
      <div class="g-stock-info" key={pick}>
        <b>{b.name}</b>
        <p>{b.desc}</p>
        <small>Bought with tokenized {b.stock} plus a $BUNKR burn. Limited supply. Never shatters.</small>
      </div>
    </div>
  );
}

function Flows() {
  return (
    <div class="g-flows">
      <div class="g-flow g-rv">
        <b>Ration Ticket</b><small>2,500 $BUNKR · an extra run</small>
        <div class="g-split"><i class="burn" style={{ '--w': '50%' }}>50% burned</i><i class="pot" style={{ '--w': '50%' }}>50% to the pot</i></div>
      </div>
      <div class="g-flow g-rv">
        <b>Daily Doom</b><small>10,000 $BUNKR · one shot a day</small>
        <div class="g-split"><i class="pot" style={{ '--w': '80%' }}>80% to the pot</i><i class="burn" style={{ '--w': '20%' }}>20%</i></div>
      </div>
      <div class="g-flow g-rv">
        <b>Top 3 split the pot</b><small>every UTC day</small>
        <div class="g-podium"><i class="p2">30%</i><i class="p1">50%</i><i class="p3">20%</i></div>
      </div>
    </div>
  );
}

// ---------- This week ----------

function Week() {
  const order: MutatorId[] = ['bear', 'bull', 'airdrop', 'rugseason', 'halving'];
  const now = mutatorForDay(utcDayNow());
  return (
    <div class="g-week">
      {order.map((m) => (
        <div key={m} class={`g-wk g-rv ${m === now ? 'now' : ''}`}>
          {m === now && <span class="g-now">THIS WEEK</span>}
          <b>{MUTATORS[m].name}</b>
          <p>{MUTATORS[m].desc}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- FAQ ----------

const FAQ: [string, string][] = [
  ['Do I need $BUNKR to play?', `No. Tent Mode is free, no wallet. The tent lasts ${TENT_DAYS} days. Hold $BUNKR for the full ${RUN_DAYS}.`],
  ['Can I lose my forged Bags?', 'Only the ones you bring into a run, and only if you get liquidated: each has a 35% chance to shatter. Daily Doom never risks them.'],
  ['Can people cheat the leaderboard?', 'Every ticketed run is replayed on our server before it counts. Your browser\'s score is not trusted.'],
  ['Is my progress saved?', 'In your browser, and to your wallet if you link it in the Vault. Deeds, tickets and forged items live on chain.'],
  ['What chain?', 'Robinhood Chain. $BUNKR launches on Urufu Labs. Game contracts stay on testnet until audited.'],
];

// ---------- Page ----------

/** Each section tints the page's ambient light as you scroll into it. */
const TINT: Record<string, string> = {
  build: '#ffbe3d', vibes: '#ff6fbf', degens: '#3ff0ff', fight: '#ff4b3e', bags: '#a463ff', week: '#8cff4f', token: '#ffbe3d', faq: '#8cff4f',
};

function Section({ id, kick, title, children }: { id: string; kick: string; title: string; children: preact.ComponentChildren }) {
  const num = kick.split(' ')[0];
  return (
    <section id={id} class="g-sec" data-tint={TINT[id]}>
      <span class="g-ghost" aria-hidden="true">{num}</span>
      <div class="g-kick g-rv">{kick}</div>
      {/* Split into words and letters so the headline can tumble in letter by letter. */}
      <h2 class="g-h" aria-label={title}>
        {title.split(' ').map((w, i) => (
          <span key={i} class="g-word" aria-hidden="true">{[...w].map((c, j) => <span key={j} class="g-ch">{c}</span>)}</span>
        ))}
      </h2>
      {children}
    </section>
  );
}

/** A tape of degen slogans that slides with the scroll, in the scroll's direction. */
function Ticker({ words, flip }: { words: string[]; flip?: boolean }) {
  const row = [...words, ...words, ...words];
  return (
    <div class={`g-ticker ${flip ? 'flip' : ''}`} aria-hidden="true">
      <div class="g-ticker-row">{row.map((w, i) => <span key={i}>{w}<i /></span>)}</div>
    </div>
  );
}

/** Drifting ash and glow behind everything, plus a few relics floating in the margins. */
const FLOATERS: BagId[] = ['ramenprinter', 'moonmap', 'hwnecklace', 'bullhorn', 'diamondgloves', 'airdropcrate'];
function Ambient() {
  return (
    <div class="g-ambient" aria-hidden="true">
      <div class="g-tint" />
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} class="g-ash" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, '--s': `${0.4 + ((i * 7) % 10) / 10}`, '--d': `${6 + (i % 7)}s` }} />
      ))}
      {FLOATERS.map((b, i) => (
        <img key={b} class="g-floater" src={art(`bags/${b}.webp`)} alt="" style={{ [i % 2 ? 'right' : 'left']: `${2 + (i % 3) * 1.5}%`, top: `${12 + i * 15}%` }} />
      ))}
    </div>
  );
}

function useScenes() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', still: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      const { motion } = ctx.conditions as { motion: boolean };

      // Hero: the logo drops in, the art drifts on scroll.
      if (motion) {
        gsap.timeline()
          .from('.g-logo', { y: -260, rotate: -18, scale: 0.5, duration: 1.1, ease: 'bounce.out' })
          .from('.g-tag, .g-ctas, .g-count, .g-hero .g-tk', { y: 24, opacity: 0, stagger: 0.12, duration: 0.5 }, '-=0.3');
        gsap.to('.g-hero-art', { yPercent: 18, scale: 1.08, ease: 'none', scrollTrigger: { trigger: '.g-hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.g-hero-in', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.g-hero', start: 'top top', end: 'bottom top', scrub: true } });
      }

      // The drop: clean street -> siren -> flash -> rubble.
      gsap.timeline({ scrollTrigger: { trigger: '.g-drop', start: 'top top', end: '+=260%', scrub: 0.6, pin: true } })
        .from('.g-drop-a', { opacity: 0, y: 40, duration: 1 })
        .to('.g-drop-a', { opacity: 0, y: -30, duration: 0.6 }, '+=0.6')
        .to('.g-drop-red', { opacity: 0.55, duration: 1 })
        .fromTo('.g-drop-b', { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, '<')
        .to('.g-drop-b', { x: 6, yoyo: true, repeat: 7, duration: 0.05 })
        .to('.g-flash', { opacity: 1, duration: 0.25 })
        .set('.g-drop-clean, .g-drop-b', { opacity: 0 })
        .set('.g-drop-red', { opacity: 0.15 })
        .to('.g-flash', { opacity: 0, duration: 1 })
        .from('.g-drop-dead', { scale: 1.12, duration: 1.2 }, '<')
        .from('.g-drop-c', { opacity: 0, y: 40, duration: 0.8 }, '-=0.4')
        .to('.g-drop-c', { opacity: 0, y: -30, duration: 0.6 }, '+=0.6')
        .from('.g-drop-d', { opacity: 0, scale: 0.8, duration: 0.8 });

      // Bosses: scroll sideways through the run, the day counter ticking.
      const track = document.querySelector<HTMLElement>('.g-boss-track');
      const dayN = document.querySelector<HTMLElement>('.g-day-n');
      if (track) {
        gsap.to(track, {
          x: () => -(track.scrollWidth - innerWidth),
          ease: 'none',
          scrollTrigger: {
            trigger: '.g-bosses', start: 'top top', end: () => `+=${track.scrollWidth}`, scrub: 0.5, pin: true, invalidateOnRefresh: true,
            onUpdate: (st) => { if (dayN) dayN.textContent = String(Math.max(1, Math.round(st.progress * RUN_DAYS))); },
          },
        });
      }

      // The progress fuse along the top of the screen.
      gsap.to('.g-fuse', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });

      // Each section relights the ambient glow in its own color.
      gsap.utils.toArray<HTMLElement>('.g-sec[data-tint]').forEach((sec) =>
        ScrollTrigger.create({
          trigger: sec, start: 'top 60%', end: 'bottom 40%',
          onToggle: (st) => st.isActive && gsap.to('.g-tint', { '--tc': sec.dataset.tint, duration: 1.2, ease: 'power2.out' }),
        }));

      if (motion) {
        // Headlines tumble in letter by letter.
        gsap.utils.toArray<HTMLElement>('.g-h').forEach((h) =>
          gsap.from(h.querySelectorAll('.g-ch'), {
            yPercent: 120, rotate: () => gsap.utils.random(-25, 25), opacity: 0, duration: 0.7, ease: 'back.out(2)', stagger: 0.022,
            scrollTrigger: { trigger: h, start: 'top 88%' },
          }));
        // The giant section numbers drift slower than the page.
        gsap.utils.toArray<HTMLElement>('.g-ghost').forEach((g) =>
          gsap.fromTo(g, { yPercent: 60 }, { yPercent: -60, ease: 'none', scrollTrigger: { trigger: g.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
        // Slogan tapes slide with the scroll.
        gsap.utils.toArray<HTMLElement>('.g-ticker').forEach((t) =>
          gsap.fromTo(t.firstElementChild, { xPercent: t.classList.contains('flip') ? -33 : 0 }, {
            xPercent: t.classList.contains('flip') ? 0 : -33, ease: 'none',
            scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: 0.4 },
          }));
        // Ash and relics float up at different speeds (parallax).
        gsap.utils.toArray<HTMLElement>('.g-ash').forEach((a) =>
          gsap.to(a, { y: () => -innerHeight * (0.3 + Math.random() * 0.9), ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1 } }));
        gsap.utils.toArray<HTMLElement>('.g-floater').forEach((f, i) =>
          gsap.to(f, { y: -innerHeight * (0.8 + (i % 3) * 0.5), rotate: i % 2 ? 40 : -40, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.5 } }));
        // Headlines lean with scroll speed, then spring back.
        const lean = gsap.quickTo('.g-h', 'skewY', { duration: 0.5, ease: 'power3.out' });
        ScrollTrigger.create({ onUpdate: (st) => lean(gsap.utils.clamp(-4, 4, st.getVelocity() / -600)) });

        // Panels swing up out of the floor as they arrive.
        gsap.utils.toArray<HTMLElement>('.g-rv').forEach((el) =>
          gsap.from(el, { y: 70, rotateX: 18, scale: 0.94, opacity: 0, transformPerspective: 900, transformOrigin: '50% 100%', duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
        gsap.utils.toArray<HTMLElement>('.g-split i').forEach((el) =>
          gsap.from(el, { width: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
        gsap.utils.toArray<HTMLElement>('.g-podium i').forEach((el, i) =>
          gsap.from(el, { scaleY: 0, transformOrigin: 'bottom', duration: 0.7, delay: i * 0.12, ease: 'back.out(1.8)', scrollTrigger: { trigger: el, start: 'top 92%' } }));
      }
    });
    return () => mm.revert();
  }, []);
}

function Page() {
  useScenes();
  return (
    <>
      <div class="g-fuse" aria-hidden="true" />
      <Ambient />
      <Hero />
      <Drop />
      <Ticker words={['GM', 'IT\'S SO OVER', 'WE\'RE SO BACK', 'HODL THE RAMEN', 'WAGMI (SOME OF US)', 'NUKES INBOUND']} />
      <main>
        <Section id="build" kick="01 · YOUR BUNKER" title="Build rooms. Rooms make stuff.">
          <Hatch mood="smug" line="Tap a room. Watch number go up. That's the whole economy." />
          <Builder />
        </Section>
        <Section id="vibes" kick="02 · THE VIBES" title="Keep the needle in the middle.">
          <Hatch mood="panic" line="It swings on its own. Too far either way and degens do something stupid." />
          <Vibes />
        </Section>
        <Section id="degens" kick="03 · YOUR DEGENS" title="Recruit degens. Regret it.">
          <Gacha />
        </Section>
      </main>
      <Ticker flip words={['DAY 10: LIQUIDATORS', 'DAY 20: THE S.E.C.', 'DAY 28: THE WHALE', 'SMASH THEM', 'PRESS F']} />
      <Bosses />
      <main>
        <Section id="fight" kick="04 · FIGHT BACK" title="When they raid, you smash.">
          <Smash />
          <PressF />
        </Section>
        <Section id="bags" kick="05 · BAGS" title="Relics with weird powers.">
          <Hatch mood="laugh" line="Find them out there. Carry more than 5 and you're a Bagholder." />
          <Bags />
        </Section>
        <Section id="week" kick="06 · THIS WEEK" title="Every Monday, the wasteland changes.">
          <Week />
        </Section>
        </main>
        <Ticker words={['$BUNKR', 'NUMBER GO UP', 'BURN IT', 'FORGE IT', 'NOT FINANCIAL ADVICE', 'PRICE ACTION IS THE WEATHER']} />
        <main>
        <Section id="token" kick="07 · $BUNKR" title="Your bag is your bunker.">
          <TokenLinks class="g-tk g-tk-left g-rv" />
          <DeedSlider />
          <StockBags />
          <Flows />
          <WeatherSlider />
          <p class="g-fine-print g-rv">Finish a run holding a Bag you found and you can forge it into a real token (ERC-1155). Burn $BUNKR for cosmetics like the Good Boy Nuke. Testnet numbers, may change at launch.</p>
        </Section>
        <Section id="faq" kick="08 · FAQ" title="Questions.">
          <div class="g-faq">
            {FAQ.map(([q, a], i) => <details key={q} class="g-rv" open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </Section>
      </main>
      <footer class="g-foot">
        <div class="g-foot-art" />
        <div class="g-foot-in">
          <div class="g-logo small">BUNKR</div>
          <p>The bombs drop in {PREP_SECONDS} seconds.</p>
          <a class="btn btn-green" href="/">GET IN</a>
          <TokenLinks class="g-tk" />
          <small>$BUNKR on Robinhood Chain · contracts testnet-only until audited · not financial advice, obviously</small>
        </div>
      </footer>
    </>
  );
}

render(<Page />, document.getElementById('guide')!);
