import { useEffect, useState } from 'preact/hooks';
import { explorerTx } from '../chain/config';
import { fetchBoard, type Board, type BoardRow } from '../chain/server';
import { useWallet, type WalletState } from '../chain/wallet';
import { fmtBunkr, hasDeed } from './Deed';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const SHARES = [5_000n, 3_000n, 2_000n];

function countdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${secs % 60}s`;
}

/** Today's board, refreshed while it's on screen. `undefined` while loading, null if offline. */
function useBoard(day?: number, every = 15_000): Board | null | undefined {
  const w = useWallet();
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const load = () => void fetchBoard({ day, player: w.address }).then((b) => live && setBoard(b));
    load();
    const id = every ? setInterval(load, every) : 0;
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [day, w.address]);
  return board;
}

/** Ranked rows, with the player's own row highlighted (and pinned below if outside the list). */
export function BoardTable({ board, limit = 10, me }: { board: Board; limit?: number; me: string | null }) {
  const rows = board.top.slice(0, limit);
  const showMe = board.you && !rows.some((r) => same(r.player, me));
  const row = (r: BoardRow) => (
    <div key={r.rank} class={`board-row rank-${r.rank} ${same(r.player, me) ? 'me' : ''}`}>
      <span class="board-rank">{r.rank}</span>
      <span class="board-who">{same(r.player, me) ? 'YOU' : short(r.player)}</span>
      <span class="board-end">{r.title.toLowerCase()} · day {Math.min(r.day, 30)}</span>
      <b class="board-score">{r.score.toLocaleString()}</b>
    </div>
  );
  if (!rows.length) return <div class="board-empty">Nobody has survived today yet. Or tried. Be first.</div>;
  return (
    <div class="board">
      {rows.map(row)}
      {showMe && (
        <>
          <div class="board-gap">…</div>
          {row(board.you!)}
        </>
      )}
    </div>
  );
}

function playLabel(w: WalletState, playedHere: boolean): string {
  if (!hasDeed(w)) return 'GET A DEED TO PLAY';
  if (playedHere || !w.dailyAvailable) return 'PLAYED TODAY';
  if (w.busy === 'Spending a Ration Ticket') return 'SPENDING TICKET…';
  if (!w.freeAvailable && w.tickets === 0) return 'BUY A TICKET TO PLAY';
  return w.freeAvailable ? 'PLAY · FREE RUN' : 'PLAY · 1 TICKET';
}

/** Daily Doom: the pot, the board, yesterday's payout, and the one attempt you get. */
export function DailyModal({ playedHere, onPlay, onDeed, onClose }: {
  playedHere: boolean;
  onPlay: () => void;
  onDeed: () => void;
  onClose: () => void;
}) {
  const w = useWallet();
  const board = useBoard();
  const yesterday = useBoard(board ? board.today - 1 : undefined, 0);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!board) return;
    const until = Date.now() + board.endsIn * 1000;
    const tick = () => setLeft(Math.max(0, Math.round((until - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [board]);

  const pot = board ? BigInt(board.pot) : 0n;
  const deed = hasDeed(w);
  const played = playedHere || !w.dailyAvailable;
  const hasRun = w.freeAvailable || w.tickets > 0;
  const canPlay = deed && !played && !w.busy && hasRun;
  const paid = yesterday?.settlement;
  const paidTx = paid ? explorerTx(paid.tx) : null;

  return (
    <div class="modal-bg" onClick={onClose}>
      <div class="modal daily" onClick={(e) => e.stopPropagation()}>
        <div class="daily-head">
          <div>
            <div class="modal-title">DAILY DOOM</div>
            <div class="vault-sub">Same start for everyone. DEFCON 3, standard issue, one attempt. Top 3 split the pot.</div>
          </div>
          <div class="daily-pot">
            <span>TODAY'S POT</span>
            <b>{board ? fmtBunkr(pot) : '…'}</b>
            <small>$BUNKR · pays out in {board ? countdown(left) : '…'}</small>
          </div>
        </div>

        {board && (
          <div class="daily-prizes">
            {SHARES.map((bps, i) => (
              <div key={i} class={`daily-prize rank-${i + 1}`}>
                <span>{['1ST', '2ND', '3RD'][i]}</span>
                <b>{fmtBunkr((pot * bps) / 10_000n)}</b>
              </div>
            ))}
            <div class="daily-note">Fewer than 3 players: 1 takes it all, 2 split 60/40. Every score is replayed on the server before it counts.</div>
          </div>
        )}

        {board === undefined && <div class="board-empty">Loading the board…</div>}
        {board === null && <div class="board-empty err">The leaderboard is offline. The results server isn't answering.</div>}
        {board && (
          <>
            <div class="deed-h">TODAY <small>{board.total} player{board.total === 1 ? '' : 's'}</small></div>
            <BoardTable board={board} me={w.address} />
          </>
        )}

        {paid && (
          <div class="daily-yesterday">
            {paid.kind === 'rolled'
              ? <>Yesterday nobody finished, so its {fmtBunkr(BigInt(paid.amount))} $BUNKR rolled into today.</>
              : <>Yesterday paid {fmtBunkr(BigInt(paid.amount))} $BUNKR to {paid.winners.map((a) => (same(a, w.address) ? 'YOU' : short(a))).join(', ')}.</>}
            {paidTx && <a href={paidTx} target="_blank" rel="noreferrer">view tx</a>}
          </div>
        )}

        {w.error && w.busy == null && <div class="deed-status err">{w.error}</div>}

        <div class="end-row">
          <button class="btn btn-dark" onClick={onClose}>CLOSE</button>
          <button class="btn btn-amber" disabled={deed && (played || !!w.busy)} onClick={canPlay ? onPlay : onDeed}>
            {playLabel(w, playedHere)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** End of a Daily run: where you landed, once the server has verified it. */
export function DailyEndBoard() {
  const w = useWallet();
  const board = useBoard(undefined, 20_000);
  if (!board) return null;
  return (
    <div class="daily-end">
      <div class="deed-h">TODAY'S BOARD <small>pot {fmtBunkr(BigInt(board.pot))} $BUNKR · {board.total} players</small></div>
      <BoardTable board={board} limit={5} me={w.address} />
    </div>
  );
}
