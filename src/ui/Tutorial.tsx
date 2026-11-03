// First-run tutorial: HATCH walks a new player through their first minutes, one step at a
// time, in the real game. UI only: it never touches the sim, it just watches it. While the
// early steps are on screen the prep clock is held, so nobody gets nuked mid-lesson.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Game } from '../sim/game';
import type { RoomType } from '../sim/types';
import { Rich } from './icons';
import { audio } from '../audio/audio';

interface Step {
  title: string;
  text: string;
  /** Elements to pulse while this step is up. */
  point?: string;
  /** Done when this is true (otherwise the player clicks NEXT). */
  done?: (g: Game) => boolean;
  /** Hold the prep clock while this step is on screen. */
  hold?: boolean;
}

const staffed = (g: Game, type: RoomType) => g.rooms.some((r) => r.type === type && g.workersIn(r).length > 0);

export const STEPS: Step[] = [
  {
    title: 'gm. I am HATCH.',
    text: 'I run this bunker. The bombs drop in 75 seconds, so I froze the clock while I show you around. Your job: keep these degens alive for 30 days.',
    hold: true,
  },
  {
    title: 'Build a Hopium Reactor',
    text: 'Everything runs on power. Click a glowing + BUILD bay under the street and pick the Hopium Reactor.',
    point: '.cell-btn',
    done: (g) => g.rooms.some((r) => r.type === 'reactor'),
    hold: true,
  },
  {
    title: 'Put someone in it',
    text: 'Rooms only work with degens inside. Drag a degen from the street into the Reactor. (Or click the Reactor and hit + Assign.)',
    point: '.dweller-tag',
    done: (g) => staffed(g, 'reactor'),
    hold: true,
  },
  {
    title: 'Ramen is food. Ramen is money.',
    text: 'Build a Ramen Kitchen and put a degen in it. Your best GRIND goes here.',
    point: '.cell-btn',
    done: (g) => staffed(g, 'kitchen'),
    hold: true,
  },
  {
    title: 'Water',
    text: 'Last one: build a Liquidity Pool and staff it. No water, no degens. Fast.',
    point: '.cell-btn',
    done: (g) => staffed(g, 'pool'),
    hold: true,
  },
  {
    title: 'Your portfolio',
    text: 'These tickers are your bunker: 🍜 ramen, 💧 water, ⚡ power, 💊 copium, ☢ rads. Green /day is good. Red /day means something is about to go wrong.',
    point: '.res-row',
    hold: true,
  },
  {
    title: 'The vibes',
    text: 'This needle swings on its own between IT\'S SO OVER and WE\'RE SO BACK. Keep it in the dashed middle for +20% output. Too far either way and degens quit or YOLO outside. COPE spends copium to calm it.',
    point: '.vibe',
    hold: true,
  },
  {
    title: 'Let them drop',
    text: 'You have a working bunker. Spend the rest of your ramen if you like, then let the clock run out, or hit SKIP to drop the bombs now.',
    point: '.skip',
    done: (g) => g.phase !== 'prep',
  },
  {
    title: 'Day 1 underground',
    text: 'Survive the day. Event cards will pop up: pick an option and live with it. Click any room to look inside. Space pauses.',
    done: (g) => g.underground && g.day >= 2,
  },
  {
    title: 'You\'re on your own now',
    text: 'Bosses on days 10, 20 and 28. Dig deeper, recruit, send degens on expeditions. Everything else is in HOW TO PLAY on the title screen. gl. You will need it.',
  },
];

const KEY = 'bunkr.tutorial';
/** Where the bubble sits by default: just right of HATCH, along the bottom. */
const HOME = { left: 132, top: null as number | null };

export function tutorialSeen(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return true;
  }
}

function markSeen(how: 'done' | 'skipped'): void {
  try {
    localStorage.setItem(KEY, how);
  } catch {
    /* ignore */
  }
}

export const tutorialHolds = (step: number | null) => step != null && !!STEPS[step]?.hold;

/** HATCH's tutorial callout, beside HATCH. */
export function Tutorial({ game, step, setStep }: { game: Game; step: number; setStep: (s: number | null) => void }) {
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Auto-advance when the player does the thing.
  useEffect(() => {
    if (s?.done?.(game)) {
      audio.play('bag');
      setStep(step + 1);
    }
  });

  // Pulse whatever this step is about, and get out of its way. The bubble's home is beside
  // HATCH; if that covers the target it slides right along the bottom, past the target, and
  // only goes up under the top bar if there's no room down there.
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ left: number; top: number | null }>(HOME);
  useEffect(() => {
    setSpot(HOME);
    if (!s?.point) return;
    const mark = () => {
      const els = [...document.querySelectorAll<HTMLElement>(s.point!)];
      els.forEach((el) => el.classList.add('tut-target'));
      const b = box.current;
      if (!b) return;
      const w = b.offsetWidth;
      const h = b.offsetHeight;
      const targets = els.map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.bottom > 0 && r.top < innerHeight);
      const atBottom = innerHeight - 78 - h;
      const hits = (x: number, y: number | null) => {
        const yy = y ?? atBottom;
        return targets.some((r) => r.left < x + w && r.right > x && r.top < yy + h && r.bottom > yy);
      };
      const slid = Math.max(HOME.left, ...targets.map((r) => r.right + 16));
      const atTop = (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 60) + 12;
      const options = [HOME, ...(slid + w <= innerWidth - 12 ? [{ left: slid, top: null }] : []), { left: HOME.left, top: atTop }];
      const best = options.find((o) => !hits(o.left, o.top)) ?? HOME;
      setSpot((cur) => (cur.left === best.left && cur.top === best.top ? cur : best));
    };
    mark();
    const id = setInterval(mark, 300); // CSS2D labels get re-created as the bunker changes
    return () => {
      clearInterval(id);
      document.querySelectorAll('.tut-target').forEach((el) => el.classList.remove('tut-target'));
    };
  }, [step]);

  if (!s) return null;
  const finish = (how: 'done' | 'skipped') => {
    markSeen(how);
    setStep(null);
  };
  return (
    <div
      ref={box}
      class={`tutorial ${spot.top != null ? 'at-top' : spot.left !== HOME.left ? 'slid' : ''}`}
      style={{ left: `${spot.left}px`, ...(spot.top != null ? { top: `${spot.top}px`, bottom: 'auto' } : {}) }}
    >
      <div class="tut-kicker">HATCH · TUTORIAL {step + 1}/{STEPS.length}</div>
      <b class="tut-title">{s.title}</b>
      <p><Rich text={s.text} size={18} /></p>
      <div class="tut-row">
        {!last && <button class="tut-skip" onClick={() => finish('skipped')}>skip tutorial</button>}
        {!s.done && (
          <button class="btn btn-green" onClick={() => (last ? finish('done') : setStep(step + 1))}>{last ? 'LET\'S GO' : 'NEXT'}</button>
        )}
        {s.done && <span class="tut-wait">{s.hold ? 'clock paused · ' : ''}do it to continue</span>}
      </div>
    </div>
  );
}
