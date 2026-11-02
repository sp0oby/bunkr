import { useState } from 'preact/hooks';
import { DEFCONS } from '../sim/content';
import type { Defcon } from '../sim/types';
import { VAULT, buyVault, dailyPlayed, todayKey, vaultLevel, type Meta } from '../meta';
import { audio } from '../audio/audio';
import { Icon } from './icons';

const go = (q: string) => {
  location.search = q;
};

/** The front door: pick a DEFCON, play Daily Doom, or spend Ramen Futures in the Vault. */
export function Title({ meta }: { meta: Meta }) {
  const [defcon, setDefcon] = useState<Defcon>(meta.unlocked);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [, bump] = useState(0);
  const playedToday = dailyPlayed(meta);
  const levels = [5, 4, 3, 2, 1] as Defcon[];

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
          <div class="tb-head">
            <span class="tp-label">DIFFICULTY</span>
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
          <div class="tb-info">
            <b>{DEFCONS[defcon].name}</b> <span class="tp-mult">×{DEFCONS[defcon].score}{meta.best[`defcon${defcon}`] ? ` · best ${meta.best[`defcon${defcon}`].toLocaleString()}` : ''}</span>
            <span class="tb-mods">{DEFCONS[defcon].mods.join(' · ')}</span>
          </div>
        </div>
        <button class="btn btn-green tp-play" onClick={() => go(`?play=1&defcon=${defcon}`)}>ENTER THE BUNKER</button>
        <div class="tb-side">
          <button class="btn btn-amber" disabled={playedToday} onClick={() => go('?daily=1')} title="Same seed for everyone today. One attempt. DEFCON 3. No Vault perks.">
            DAILY DOOM
            <small>{playedToday ? `done · ${meta.daily!.score.toLocaleString()}` : todayKey()}</small>
          </button>
          <button class="btn btn-pink" onClick={() => setVaultOpen(true)}>
            VAULT
            <small>{meta.rf} RF</small>
          </button>
          <button class="btn btn-dark tp-sound" onClick={() => { audio.toggleMute(); bump((n) => n + 1); }} title="Sound (M)"><Icon name={audio.muted ? 'mute' : 'sound'} size={26} /></button>
        </div>
      </div>
      <div class="title-foot">Runs {meta.runs} · Survived {meta.wins} · Earn 1 Ramen Future per 100 score</div>

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
