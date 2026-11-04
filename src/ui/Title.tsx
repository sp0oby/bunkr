import { useEffect, useState } from 'preact/hooks';
import { fetchWeather, type WeatherReport } from '../chain/server';
import { DEFCONS, MUTATORS, WEATHER, mutatorForDay, utcDayNow } from '../sim/content';
import type { Defcon } from '../sim/types';
import { VAULT, buyVault, dailyPlayed, exportCode, importCode, todayKey, vaultLevel, type Meta } from '../meta';
import { audio } from '../audio/audio';
import { Icon } from './icons';
import { TokenLinks } from './TokenLinks';
import { DeedChip, DeedModal, enterAndGo, fmtBunkr, hasDeed } from './Deed';
import { DailyModal } from './Daily';
import { tokenGate } from '../chain/config';
import { useWallet } from '../chain/wallet';
import { linkWallet, pullProgress, useProgressSync } from '../chain/progress';

/** Keep progress on the connected wallet, so it follows the player to any device. */
function WalletSync({ meta }: { meta: Meta }) {
  const w = useWallet();
  const sync = useProgressSync();
  if (sync.status === 'off' || w.status === 'off') return null;
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  let body;
  if (w.status !== 'connected') {
    body = <span class="sync-note">Connect a wallet in the Deed panel to keep this progress on every device.</span>;
  } else if (!sync.linkedTo) {
    body = (
      <>
        <button class="btn btn-green" disabled={sync.status === 'linking'} onClick={() => void linkWallet(meta)}>
          {sync.status === 'linking' ? 'CHECK YOUR WALLET' : 'SAVE TO MY WALLET'}
        </button>
        <span class="sync-note">One free signature, no transaction. Then your progress follows {short(w.address!)} to any device.</span>
      </>
    );
  } else {
    const label = sync.status === 'syncing' ? 'saving…' : sync.status === 'error' ? 'couldn\'t save, will retry' : 'saved';
    body = (
      <span class="sync-note">
        <b class={`sync-dot ${sync.status}`} /> Linked to {short(sync.linkedTo)} · {label}. Every run saves here automatically.
      </span>
    );
  }
  return (
    <div class="save-codes">
      <div class="deed-h">WALLET SAVE <small>your progress on any device</small></div>
      <div class="save-row sync-row">{body}</div>
      {sync.error && <div class="save-msg err">{sync.error}</div>}
    </div>
  );
}

/** Back up progress as a code, or bring it over from another browser. */
function SaveCodes({ meta, onImported }: { meta: Meta; onImported: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportCode(meta));
      setMsg({ ok: true, text: 'Save code copied. Paste it somewhere safe.' });
    } catch {
      setCode(exportCode(meta));
      setMsg({ ok: true, text: 'Copy the code from the box.' });
    }
  };
  const load = () => {
    const err = importCode(meta, code);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Progress loaded.' });
    if (!err) {
      setCode('');
      onImported();
    }
  };
  return (
    <div class="save-codes">
      <div class="deed-h">SAVE CODE <small>for playing without a wallet</small></div>
      <div class="save-row">
        <button class="btn btn-green" onClick={() => void copy()}>COPY SAVE CODE</button>
        <input class="save-input" placeholder="Paste a save code to load it here" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
        <button class="btn btn-amber" disabled={!code.trim()} onClick={load}>LOAD</button>
      </div>
      {msg && <div class={`save-msg ${msg.ok ? '' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}

function toggleCrt(): void {
  const off = document.body.classList.toggle('no-crt');
  try {
    localStorage.setItem('bunkr.crt', off ? 'off' : 'on');
  } catch {
    /* ignore */
  }
}

/** The front door: pick a DEFCON, play Daily Doom, or spend Ramen Futures in the Vault. */
export function Title({ meta }: { meta: Meta }) {
  const [defcon, setDefcon] = useState<Defcon>(meta.unlocked);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [deedOpen, setDeedOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [wastelandOpen, setWastelandOpen] = useState(false);
  const w = useWallet();
  useProgressSync(); // re-render when a pull brings in progress from another device
  useEffect(() => {
    if (w.status === 'connected') void pullProgress(meta);
  }, [w.address, w.status]);
  const deed = hasDeed(w);
  const tent = tokenGate && !deed;
  const outOfRuns = deed && w.tickets === 0 && !w.freeAvailable;
  const enter = async (query: string, daily: boolean) => {
    if (!(await enterAndGo(query, daily))) setDeedOpen(true);
  };
  const [, bump] = useState(0);
  const playedToday = dailyPlayed(meta);
  const levels = [5, 4, 3, 2, 1] as Defcon[];
  const weekMut = mutatorForDay(utcDayNow());
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  useEffect(() => {
    void fetchWeather().then(setWeather);
  }, []);

  return (
    <div class="title">
      <div class="title-art" />
      <div class="title-fade" />
      <div class="title-logo">
        <div class="tl-word">BUNKR</div>
        <div class="tl-tag">the world is ending. the chart is green. get in.</div>
        <a class={`btn btn-dark htp-btn ${meta.runs === 0 ? 'fresh' : ''}`} href="/guide.html">HOW TO PLAY</a>
        <TokenLinks />
      </div>

      <div class="title-bar">
        <div class="tb-difficulty">
          <span class="tp-label">DIFFICULTY</span>
          <div class="tb-head">
            <div class="defcons">
              {levels.map((l) => {
                const locked = l < meta.unlocked;
                return (
                  <button
                    key={l}
                    class={`defcon d${l} ${defcon === l ? 'on' : ''}`}
                    disabled={locked}
                    title={locked ? `Survive DEFCON ${l + 1} to unlock` : DEFCONS[l].name}
                    onClick={() => setDefcon(l)}
                  >
                    {locked ? <span class="lock" /> : l}
                  </button>
                );
              })}
            </div>
          </div>
          <div class="tb-info" title={DEFCONS[defcon].mods.join(' · ')}>
            <b>{DEFCONS[defcon].name}</b>
            <span class="tp-mult">score ×{DEFCONS[defcon].score}{meta.best[`defcon${defcon}`] ? ` · best ${meta.best[`defcon${defcon}`].toLocaleString()}` : ''}</span>
          </div>
        </div>
        <button class="btn btn-green tp-play" disabled={!!w.busy} onClick={() => void enter(`?play=1&defcon=${defcon}`, false)}>
          {w.busy === 'Spending a Ration Ticket' ? 'SPENDING TICKET…' : 'ENTER THE BUNKER'}
          {tokenGate && <small>{tent ? 'tent mode · 3 days' : outOfRuns ? 'out of tickets' : w.freeAvailable ? 'free run today' : `1 ticket · ${w.tickets} left`}</small>}
        </button>
        <div class="tb-side">
          <button
            class="btn btn-amber"
            disabled={!tokenGate && playedToday}
            onClick={() => (tokenGate ? setDailyOpen(true) : void enter('?daily=1', true))}
            title="Same start for everyone today. One attempt. DEFCON 3. No Vault perks."
          >
            DAILY DOOM
            <small>
              {tokenGate
                ? `${deed && !w.dailyAvailable ? 'played · ' : ''}${w.pot ? `pot ${fmtBunkr(w.pot)}` : 'pot + board'}`
                : playedToday ? `done · ${meta.daily!.score.toLocaleString()}` : todayKey()}
            </small>
          </button>
          <DeedChip onOpen={() => setDeedOpen(true)} />
          <button class="btn btn-pink" onClick={() => setVaultOpen(true)}>
            VAULT
            <small>{meta.rf} RF</small>
          </button>
          <button class="btn btn-dark tp-sound" onClick={() => { audio.toggleMute(); bump((n) => n + 1); }} title="Sound (M)"><Icon name={audio.muted ? 'mute' : 'sound'} size={26} /></button>
        </div>
      </div>
      <button class="wasteland-tease" onClick={() => setWastelandOpen(true)}>
        <span class="lock" />
        <span>
          <b>THE WASTELAND</b>
          <small>Season 1 · coming soon</small>
        </span>
        <DoomClock size={42} />
      </button>
      <div class="title-mutator">
        <span>THIS WEEK</span>
        <b>{MUTATORS[weekMut].name}</b>
        <small>{MUTATORS[weekMut].desc}</small>
        {weather && (
          <div class={`title-weather wx-${weather.kind}`}>
            <span>WEATHER · $BUNKR {weather.change24h == null ? 'price action' : `${weather.change24h > 0 ? '+' : ''}${weather.change24h.toFixed(1)}% 24h`}</span>
            <b>{WEATHER[weather.kind].name}</b>
            <small>{WEATHER[weather.kind].desc}</small>
          </div>
        )}
      </div>
      <div class="title-foot">
        Runs {meta.runs} · Survived {meta.wins} · Earn 1 Ramen Future per 1,000 score ·{' '}
        <button class="link-btn" onClick={() => { toggleCrt(); bump((n) => n + 1); }}>CRT effect: {document.body.classList.contains('no-crt') ? 'off' : 'on'}</button>
      </div>

      {deedOpen && <DeedModal onClose={() => setDeedOpen(false)} />}
      {wastelandOpen && (
        <div class="modal-bg" onClick={() => setWastelandOpen(false)}>
          <div class="modal wasteland" onClick={(e) => e.stopPropagation()}>
            <DoomClock size={120} />
            <div class="wl-clock-cap">2 MINUTES TO MIDNIGHT</div>
            <div class="modal-title">THE WASTELAND</div>
            <div class="vault-sub">Season 1. Every bunker on one map. One Doomsday Clock for everyone.</div>
            <ul class="wl-list">
              <li><b>The Doomsday Clock.</b> Escalate and it ticks toward midnight. Make peace and it ticks back. Guess which way the crowd goes.</li>
              <li><b>Mutually Assured Destruction.</b> Your Silo grows up. So does everyone else's.</li>
              <li><b>Treaties.</b> Sign one. Honor it. Or don't, and wear the TRAITOR badge for the rest of the season.</li>
              <li><b>Bounties.</b> Put $BUNKR on a bunker's head.</li>
            </ul>
            <div class="deed-note">Bunker-tier Deeds get in first. HATCH is already nervous.</div>
            <button class="btn btn-dark card-ok" onClick={() => setWastelandOpen(false)}>CLOSE</button>
          </div>
        </div>
      )}
      {dailyOpen && (
        <DailyModal
          onPlay={() => void enterAndGo('?daily=1', true)}
          onDeed={() => {
            setDailyOpen(false);
            setDeedOpen(true);
          }}
          onClose={() => setDailyOpen(false)}
        />
      )}
      {vaultOpen && (
        <div class="modal-bg" onClick={() => setVaultOpen(false)}>
          <div class="modal vault" onClick={(e) => e.stopPropagation()}>
            <div class="modal-title">THE VAULT <span class="rf">{meta.rf} RF</span></div>
            <div class="vault-sub">Permanent upgrades, bought with Ramen Futures earned every run.</div>
            {VAULT.map((v) => {
              const lvl = vaultLevel(meta, v.id);
              const cost = v.costs[lvl];
              const maxed = cost == null;
              return (
                <div class={`vault-row ${lvl ? 'owned' : ''}`} key={v.id}>
                  <div>
                    <b>{v.name}{v.costs.length > 1 && <small> lv {lvl}/{v.costs.length}</small>}</b>
                    <span>{v.desc}</span>
                  </div>
                  <button
                    class={`btn ${maxed ? 'btn-dark' : 'btn-green'}`}
                    disabled={maxed || meta.rf < cost}
                    onClick={() => { if (buyVault(meta, v.id)) { audio.play('bag'); bump((n) => n + 1); } }}
                  >
                    {maxed ? 'OWNED' : `${cost} RF`}
                  </button>
                </div>
              );
            })}
            <WalletSync meta={meta} />
            <SaveCodes meta={meta} onImported={() => bump((n) => n + 1)} />
            <button class="btn btn-dark card-ok" onClick={() => setVaultOpen(false)}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The Wasteland's Doomsday Clock: two minutes to midnight, and the second hand keeps
 *  creeping toward twelve before somebody makes peace and it jumps back. */
function DoomClock({ size }: { size: number }) {
  return (
    <svg class="doom-clock" width={size} height={size} viewBox="0 0 40 40" aria-label="Doomsday Clock: two minutes to midnight">
      <circle cx="20" cy="20" r="17.5" fill="#1a0606" stroke="#0b0b10" stroke-width="3" />
      <path d="M20 20 L20 4 A16 16 0 0 0 12 6.14 Z" fill="#ff4b3e" opacity="0.35" />
      {Array.from({ length: 12 }, (_, i) => (
        <line x1="20" y1={i % 3 ? 5.2 : 4.4} x2="20" y2="7.4" stroke={i === 0 ? '#ff4b3e' : '#fff8ec'} stroke-width={i % 3 ? 1 : 1.8} stroke-linecap="round" transform={`rotate(${i * 30} 20 20)`} />
      ))}
      <line x1="20" y1="20" x2="20" y2="10.5" stroke="#fff8ec" stroke-width="2.6" stroke-linecap="round" transform="rotate(-1 20 20)" />
      <line x1="20" y1="20" x2="20" y2="6.5" stroke="#fff8ec" stroke-width="1.8" stroke-linecap="round" transform="rotate(-12 20 20)" />
      <line class="doom-sec" x1="20" y1="23" x2="20" y2="6" stroke="#ff4b3e" stroke-width="0.9" stroke-linecap="round" />
      <circle cx="20" cy="20" r="1.6" fill="#ff4b3e" stroke="#0b0b10" stroke-width="0.6" />
    </svg>
  );
}
