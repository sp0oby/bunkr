// Daily Doom payouts: once a UTC day is over, its pot goes to the top of that day's
// verified leaderboard, or rolls into today's pot if nobody finished a Daily run.
import { chainToday, deployDay, isSettled, potOf, rollDay, settleDay } from './chain';
import { db, dailyBoard } from './store';

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
