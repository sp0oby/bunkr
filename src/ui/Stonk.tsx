import { formatUnits } from 'viem';
import { BAGS } from '../sim/content';
import type { BagId } from '../sim/types';
import { STOCK_BAGS } from '../chain/constants';
import { TIERS, deployment, explorerTx } from '../chain/config';
import { buyStockBag, connect, stockFaucet, useWallet, type WalletState } from '../chain/wallet';
import { fmtBunkr } from './Deed';

/** 0.25e18 -> "0.25". Stock tokens are fractional shares. */
export const fmtShares = (v: bigint) => (+Number(formatUnits(v, 18)).toFixed(4)).toLocaleString();

/** Title-screen card for the Stonk Exchange, under the Wasteland card. Hidden on deployments without one. */
export function StonkButton({ onOpen }: { onOpen: () => void }) {
  if (!deployment?.stockForge) return null;
  return (
    <button class="stonk-tease" onClick={onOpen} title="Legendary Stock Bags, bought with tokenized stocks">
      <span class="stonk-tease-art">
        {['overclockgpu', 'seeingstone', 'starshippass'].map((b) => <img key={b} src={`/art/bags/${b}.webp`} alt="" draggable={false} />)}
      </span>
      <span>
        <b>STONK EXCHANGE</b>
        <small>6 legendary Stock Bags</small>
      </span>
    </button>
  );
}

/** Weeks start Monday 00:00 UTC, the same as the game's weekly rotation. */
function weekEndsIn(): string {
  const now = Date.now() / 1000;
  const day = Math.floor(now / 86400);
  const end = (Math.floor((day + 3) / 7) + 1) * 7 - 3; // next Monday, in UTC days
  const h = Math.max(0, Math.floor((end * 86400 - now) / 3600));
  return h >= 48 ? `${Math.floor(h / 24)} days` : `${h}h`;
}

/** The Stonk Exchange: legendary Stock Bags, paid in a Robinhood stock token plus a $BUNKR burn. */
export function StonkModal({ onClose }: { onClose: () => void }) {
  const s = useWallet();
  const connected = s.status === 'connected';
  const tx = s.lastTx ? explorerTx(s.lastTx) : null;
  const pot = STOCK_BAGS.filter((b) => (s.stonkPot[b] ?? 0n) > 0n);
  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal deed stonk" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">STONK EXCHANGE</div>
        <div class="vault-sub">
          Legendary Bags, bought with tokenized stocks on Robinhood Chain. Each one burns $BUNKR too. They never shatter, and they're
          yours to trade.
          {deployment?.mock && ' Testnet: these are mock stocks with a free faucet, not the real ones.'}
        </div>

        {!connected && (
          <div class="deed-connect">
            <button class="btn btn-green" disabled={s.status === 'connecting'} onClick={() => void connect('injected')}>
              {s.status === 'connecting' ? 'CONNECTING…' : 'CONNECT WALLET'}
            </button>
          </div>
        )}

        <div class="stonk-grid">
          {STOCK_BAGS.map((b) => <StonkCard key={b} bag={b} s={s} connected={connected} />)}
        </div>

        <div class="deed-section">
          <div class="deed-h">THE STONK POT <small>{s.stonkPotBps / 100}% of every Stock Bag sale · pays out in {weekEndsIn()}</small></div>
          {pot.length ? (
            <div class="stonk-pot">
              {pot.map((b) => (
                <div key={b}><b>{fmtShares(s.stonkPot[b]!)}</b><span>{BAGS[b].stock}</span></div>
              ))}
            </div>
          ) : (
            <div class="drawer-hint">Empty so far this week. Every Stock Bag sold adds to it.</div>
          )}
          <div class="deed-note">Paid to this week's Daily Doom top 3 (each player's best run): 50%, 30%, 20%. Real stock, straight to your wallet.</div>
        </div>

        {(s.busy || s.error) && (
          <div class={`deed-status ${s.error ? 'err' : ''}`}>
            {s.busy ? `${s.busy}…` : s.error}
            {tx && !s.error && <a href={tx} target="_blank" rel="noreferrer">view tx</a>}
          </div>
        )}
        <div class="end-row">
          <button class="btn btn-dark" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

function StonkCard({ bag, s, connected }: { bag: BagId; s: WalletState; connected: boolean }) {
  const def = BAGS[bag];
  const l = s.stocks[bag];
  const owned = s.forged[bag] ?? 0;
  const left = l ? l.cap - l.sold : 0;
  const lowTier = !!l && s.tier < l.minTier;
  const noStock = !!l && l.held < l.price;
  const noBunkr = !!l && s.balance < l.burn;
  const label = !l || !l.enabled ? 'SOON' : left <= 0 ? 'SOLD OUT' : lowTier ? `NEEDS ${TIERS[l.minTier]}` : noStock ? `NEED ${fmtShares(l.price)} ${def.stock}` : noBunkr ? 'NOT ENOUGH $BUNKR' : 'BUY';
  return (
    <div class={`stonk-card ${owned ? 'owned' : ''}`}>
      <div class="stonk-tk">{def.stock}</div>
      <img src={`/art/bags/${bag}.webp`} alt="" draggable={false} />
      <b>{def.name}</b>
      <p>{def.desc}</p>
      {l && (
        <div class="stonk-price">
          <span><b>{fmtShares(l.price)}</b> {def.stock}</span>
          <span>+ {fmtBunkr(l.burn)} $BUNKR burned</span>
          <small>{left} of {l.cap} left{owned ? ` · you own ${owned}` : ''}{connected ? ` · you hold ${fmtShares(l.held)} ${def.stock}` : ''}</small>
        </div>
      )}
      {connected && (
        <div class="stonk-btns">
          <button class="btn btn-amber" disabled={!!s.busy || label !== 'BUY'} onClick={() => void buyStockBag(bag)}>{label}</button>
          {deployment?.mock && l && <button class="btn btn-dark" disabled={!!s.busy} onClick={() => void stockFaucet(bag)}>FREE TEST {def.stock}</button>}
        </div>
      )}
    </div>
  );
}
