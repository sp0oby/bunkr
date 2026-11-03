import { useEffect, useState } from 'preact/hooks';
import { fetchWeather, type WeatherReport } from '../chain/server';
import { DEFCONS, MUTATORS, WEATHER, mutatorForDay, utcDayNow } from '../sim/content';
import type { Defcon } from '../sim/types';
import { VAULT, buyVault, dailyPlayed, todayKey, vaultLevel, type Meta } from '../meta';
import { audio } from '../audio/audio';
import { Icon } from './icons';
import { DeedChip, DeedModal, enterAndGo, fmtBunkr, hasDeed } from './Deed';
import { DailyModal } from './Daily';
import { tokenGate } from '../chain/config';
import { useWallet } from '../chain/wallet';

/** The front door: pick a DEFCON, play Daily Doom, or spend Ramen Futures in the Vault. */
export function Title({ meta }: { meta: Meta }) {
  const [defcon, setDefcon] = useState<Defcon>(meta.unlocked);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [deedOpen, setDeedOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const w = useWallet();
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
      <div class="title-mutator">
        <span>THIS WEEK</span>
        <b>{MUTATORS[weekMut].name}</b>
        <small>{MUTATORS[weekMut].desc}</small>
        {weather && (
          <div class={`title-weather wx-${weather.kind}`}>
            <span>WEATHER · $BUNKR {weather.change24h == null ? 'chart' : `${weather.change24h > 0 ? '+' : ''}${weather.change24h.toFixed(1)}% 24h`}</span>
            <b>{WEATHER[weather.kind].name}</b>
            <small>{WEATHER[weather.kind].desc}</small>
          </div>
        )}
      </div>
      <div class="title-foot">Runs {meta.runs} · Survived {meta.wins} · Earn 1 Ramen Future per 100 score</div>

      {deedOpen && <DeedModal onClose={() => setDeedOpen(false)} />}
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
            <button class="btn btn-dark card-ok" onClick={() => setVaultOpen(false)}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}
