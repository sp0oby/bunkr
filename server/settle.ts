// Daily Doom payouts: once a UTC day is over, its pot goes to the top of that day's
// verified leaderboard, or rolls into today's pot if nobody finished a Daily run.
import { chainToday, deployDay, isSettled, potOf, rollDay, rollWeek, settleDay, settleWeek, stockWeek, stonkPotOf, weekIsSettled } from './chain';
import { deployment } from './env';
import { db, dailyBoard, weekOfDay, weeklyBoard } from './store';

/** Shares in basis points for 1, 2 or 3+ winners. */
const SHARES: Record<number, number[]> = { 1: [10_000], 2: [6_000, 4_000], 3: [5_000, 3_000, 2_000] };

export async function settleFinishedDays(): Promise<string[]> {
  const today = await chainToday();
  const done: string[] = [];
  // Start from the deploy day the first time; the contract didn't exist before that.
  const first = db.settledThrough != null ? db.settledThrough + 1 : await deployDay();
  for (let day = first; day < today; day++) {
    if (await isSettled(day)) {
      db.skipDay(day);
      continue;
    }
    const pot = await potOf(day);
    const board = dailyBoard(day);
    if (pot === 0n && !board.length) {
      db.skipDay(day);
      continue;
    }
    if (!board.length) {
      const tx = await rollDay(day);
      db.markSettled(day, { tx, winners: [], amount: pot.toString(), kind: 'rolled' });
      done.push(`day ${day}: rolled ${pot} into today`);
      continue;
    }
    const top = board.slice(0, 3);
    const winners = top.map((r) => r.player);
    const tx = await settleDay(day, winners, SHARES[top.length]);
    db.markSettled(day, { tx, winners, amount: pot.toString(), kind: 'settled' });
    done.push(`day ${day}: paid ${pot} to ${winners.length} winner(s)`);
  }
  return done;
}

/**
 * The weekly Stonk Pot (Stock Bag sales): once a week (Monday 00:00 UTC) is over, it goes to the
 * top of that week's Daily Doom (each player's best run), or rolls into this week if nobody played.
 */
export async function settleFinishedWeeks(): Promise<string[]> {
  const sf = deployment.stockForge;
  if (!sf) return [];
  const now = await stockWeek(sf);
  const done: string[] = [];
  const first = db.weeksSettledThrough != null ? db.weeksSettledThrough + 1 : weekOfDay(await deployDay());
  for (let wk = first; wk < now; wk++) {
    if (await weekIsSettled(sf, wk)) {
      db.markWeek(wk, { tx: null, winners: [], kind: 'settled' });
      continue;
    }
    const pot = await stonkPotOf(sf, wk);
    const board = weeklyBoard(wk);
    if (!pot.length) {
      db.markWeek(wk, { tx: null, winners: [], kind: 'empty' });
      continue;
    }
    if (!board.length) {
      const tx = await rollWeek(sf, wk);
      db.markWeek(wk, { tx, winners: [], kind: 'rolled' });
      done.push(`week ${wk}: Stonk Pot rolled into this week`);
      continue;
    }
    const winners = board.slice(0, 3).map((r) => r.player);
    const tx = await settleWeek(sf, wk, winners, SHARES[winners.length]);
    db.markWeek(wk, { tx, winners, kind: 'settled' });
    done.push(`week ${wk}: Stonk Pot paid to ${winners.length} winner(s)`);
  }
  return done;
}
