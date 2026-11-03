import { formatUnits } from 'viem';
import { BAGS } from '../sim/content';
import type { BagId } from '../sim/types';
import { LOADOUT_SLOTS, TIERS, TIER_PERKS, deployment, devWalletAllowed, explorerTx, tokenGate } from '../chain/config';
import {
  buyTickets, clearPass, connect, disconnect, enterRun, faucet, forgeBag, loadout, savePass, switchChain, toggleLoadout,
  useWallet, wallet, type WalletState,
} from '../chain/wallet';
import { audio } from '../audio/audio';

/** The Deed tier left after spending `cost`, so the UI can warn before it happens. */
export function tierAfter(s: WalletState, cost: bigint): number {
  let t = s.tier;
  while (t > 0 && s.balance - cost < (s.thresholds[t - 1] ?? 0n)) t--;
  return t;
}

/** 120000 * 1e18 -> "120K". */
export function fmtBunkr(v: bigint): string {
  const n = Number(formatUnits(v, 18));
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const hasDeed = (s: WalletState) => s.status === 'connected' && s.tier >= 1;
const runsLeft = (s: WalletState) => s.tickets + (s.freeAvailable ? 1 : 0);

/**
 * Start a run. With the token layer on, a Deed holder spends a Ration Ticket first;
 * everyone else gets Tent Mode. Returns false if the ticket didn't go through.
 */
export async function enterAndGo(query: string, daily: boolean): Promise<boolean> {
  const s = wallet();
  if (!tokenGate) {
    location.search = query;
    return true;
  }
  if (!hasDeed(s)) {
    if (daily) return false;
    clearPass();
    location.search = query;
    return true;
  }
  if (daily ? s.balance < s.dailyFee : runsLeft(s) === 0) return false;
  const entry = await enterRun(daily);
  if (entry == null) return false;
  const after = wallet();
  savePass({ ...entry, address: after.address!, chainId: deployment!.chainId, tier: after.tier, loadout: daily ? [] : loadout(after), daily });
  audio.play('bag');
  location.search = query;
  return true;
}

/** Title-bar chip: connect, or show your Deed at a glance. */
export function DeedChip({ onOpen }: { onOpen: () => void }) {
  const s = useWallet();
  if (s.status === 'off') return null;
  if (s.status !== 'connected') {
    return (
      <button class="btn btn-deed" onClick={onOpen}>
        CONNECT WALLET
        <small>{s.status === 'connecting' ? 'connecting…' : 'tent mode'}</small>
      </button>
    );
  }
  return (
    <button class={`btn btn-deed t${s.tier}`} onClick={onOpen}>
      {TIERS[s.tier]} DEED
      <small>{fmtBunkr(s.balance)} $BUNKR · {runsLeft(s)} run{runsLeft(s) === 1 ? '' : 's'}</small>
    </button>
  );
}

/** Everything $BUNKR: Deed tier ladder, Ration Tickets, faucet, forged Bag loadout. */
export function DeedModal({ onClose }: { onClose: () => void }) {
  const s = useWallet();
  const connected = s.status === 'connected';
  const slots = LOADOUT_SLOTS[s.tier] ?? 0;
  const picked = loadout(s);
  const forged = (Object.keys(s.forged) as BagId[]).sort((a, b) => (s.recipes[a]?.minTier ?? 0) - (s.recipes[b]?.minTier ?? 0));
  const tx = s.lastTx ? explorerTx(s.lastTx) : null;

  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal deed" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">
          BUNKER DEED
          {connected && <span class={`deed-tier t${s.tier}`}>{TIERS[s.tier]}</span>}
        </div>
        <div class="vault-sub">
          Your $BUNKR balance is your Deed: hold it and you own a bunker. Sell below a tier and it gets foreclosed.
          {deployment?.mock && ' This is a testnet with free test $BUNKR, not the real coin.'}
        </div>

        {!connected && (
          <div class="deed-connect">
            <button class="btn btn-green" disabled={s.status === 'connecting'} onClick={() => void connect('injected')}>
              {s.status === 'connecting' ? 'CONNECTING…' : 'CONNECT WALLET'}
            </button>
            {devWalletAllowed && (
              <button class="btn btn-dark" onClick={() => void connect('dev')} title="Anvil test account, local chain only">
                USE TEST WALLET
              </button>
            )}
          </div>
        )}

        {connected && s.wrongChain && (
          <div class="deed-warn">
            Your wallet is on the wrong network.
            <button class="btn btn-amber" onClick={() => void switchChain()}>SWITCH NETWORK</button>
          </div>
        )}

        {connected && (
          <div class="deed-who">
            <span>{short(s.address!)}</span>
            <b>{fmtBunkr(s.balance)} $BUNKR</b>
            {deployment?.mock && (
              <button class="btn btn-amber" disabled={!!s.busy} onClick={() => void faucet()}>FAUCET</button>
            )}
          </div>
        )}

        <div class="deed-ladder">
          {TIERS.map((t, i) => (
            <div key={t} class={`deed-rung t${i} ${connected && s.tier === i ? 'on' : ''} ${connected && s.tier > i ? 'past' : ''}`}>
              <b>{t}</b>
              <span class="deed-need">{i === 0 ? 'no wallet' : s.thresholds[i - 1] != null ? `${fmtBunkr(s.thresholds[i - 1])}+` : '…'}</span>
              <span class="deed-perk">{TIER_PERKS[i]}</span>
            </div>
          ))}
        </div>

        {connected && s.tier >= 1 && (
          <div class="deed-section">
            <div class="deed-h">RATION TICKETS <small>one per run</small></div>
            <div class="deed-tickets">
              <div class={`deed-free ${s.freeAvailable ? 'ready' : ''}`}>
                <b>{s.freeAvailable ? 'READY' : 'USED'}</b>
                <span>today's free run</span>
              </div>
              <div class="deed-free">
                <b>{s.tickets}</b>
                <span>bought tickets</span>
              </div>
              <div class="deed-buy">
                <button class="btn btn-green" disabled={!!s.busy} onClick={() => void buyTickets(1)}>BUY 1 · {fmtBunkr(s.ticketPrice)}</button>
                <button class="btn btn-green" disabled={!!s.busy} onClick={() => void buyTickets(5)}>BUY 5 · {fmtBunkr(s.ticketPrice * 5n)}</button>
              </div>
            </div>
            <div class="deed-note">Half of every ticket is burned. The other half goes to today's Daily Doom pot: <b>{fmtBunkr(s.pot)} $BUNKR</b>.</div>
          </div>
        )}

        {connected && s.tier >= 1 && (
          <div class="deed-section">
            <div class="deed-h">FORGED BAGS <small>bring {picked.length}/{slots} into your next run</small></div>
            {forged.length === 0 && <div class="drawer-hint">No forged Bags yet. Finish a run holding a Bag, then forge it by burning $BUNKR.</div>}
            <div class="deed-bags">
              {forged.map((b) => {
                const need = s.recipes[b]?.minTier ?? 1;
                const locked = need > s.tier;
                const on = picked.includes(b);
                return (
                  <button
                    key={b}
                    class={`deed-bag r-${BAGS[b].rarity} ${on ? 'on' : ''}`}
                    disabled={locked}
                    title={locked ? `Needs a ${TIERS[need]} Deed to equip` : BAGS[b].desc}
                    onClick={() => toggleLoadout(b)}
                  >
                    <img src={`/art/bags/${b}.webp`} alt="" draggable={false} />
                    <span>{BAGS[b].name}</span>
                    {(s.forged[b] ?? 0) > 1 && <i>×{s.forged[b]}</i>}
                  </button>
                );
              })}
            </div>
            <div class="deed-note">Get liquidated while carrying a forged Bag and it can shatter. Daily Doom always uses standard issue.</div>
          </div>
        )}

        {(s.busy || s.error) && (
          <div class={`deed-status ${s.error ? 'err' : ''}`}>
            {s.busy ? `${s.busy}…` : s.error}
            {tx && !s.error && <a href={tx} target="_blank" rel="noreferrer">view tx</a>}
          </div>
        )}

        <div class="end-row">
          {connected && <button class="btn btn-dark" onClick={disconnect}>DISCONNECT</button>}
          <button class="btn btn-dark" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

/** End screen: make a Bag from this run permanent by burning $BUNKR. */
export function ForgePanel({ bags }: { bags: BagId[] }) {
  const s = useWallet();
  if (!tokenGate || s.status !== 'connected' || !bags.length) return null;
  return (
    <div class="forge-panel">
      <div class="deed-h">FORGE A BAG <small>burn $BUNKR, keep it forever</small></div>
      <div class="forge-list">
        {bags.map((b) => {
          const r = s.recipes[b];
          if (!r) return null;
          const locked = r.minTier > s.tier;
          const poor = s.balance < r.cost;
          // Burning tokens can drop you below your Deed tier. Say so before they click.
          const after = s.balance - r.cost;
          let dropTo = s.tier;
          while (dropTo > 0 && after < (s.thresholds[dropTo - 1] ?? 0n)) dropTo--;
          return (
            <div key={b} class={`forge-row r-${BAGS[b].rarity}`}>
              <img src={`/art/bags/${b}.webp`} alt="" draggable={false} />
              <div>
                <b>{BAGS[b].name}</b>
                <span>
                  {BAGS[b].rarity}{(s.forged[b] ?? 0) > 0 ? ` · you own ${s.forged[b]}` : ''}
                  {!locked && !poor && dropTo < s.tier && <em> · drops your Deed to {TIERS[dropTo]}</em>}
                </span>
              </div>
              <button
                class="btn btn-amber"
                disabled={!!s.busy || locked || poor}
                title={locked ? `Needs a ${TIERS[r.minTier]} Deed` : poor ? 'Not enough $BUNKR' : ''}
                onClick={() => void forgeBag(b)}
              >
                {locked ? `NEEDS ${TIERS[r.minTier]}` : `FORGE · ${fmtBunkr(r.cost)}`}
              </button>
            </div>
          );
        })}
      </div>
      {(s.busy || s.error) && <div class={`deed-status ${s.error ? 'err' : ''}`}>{s.busy ? `${s.busy}…` : s.error}</div>}
    </div>
  );
}
