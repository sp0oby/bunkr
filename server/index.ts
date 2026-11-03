// BUNKR results server.
//   POST /run/start    { txHash, secret, defcon, vault, loadout }  -> { runId, seed, config }
//   POST /run/day      { runId, secret, day }                      -> that day's seed (in order, paced)
//   POST /run/finish   { runId, secret, ticks, inputs }            -> verified result
//   GET  /leaderboard?day=N&player=0x…                            -> Daily Doom top 10, pot, your rank
//   GET  /health
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { formatUnits } from 'viem';
import { chainNow, oracle, potOf } from './chain';
import { ABANDON_MS, PORT, TICK_MS, deployment } from './env';
import { HttpError, daySeed, finishRun, startRun, sweepAbandoned } from './runs';
import { settleFinishedDays } from './settle';
import { dailyBoard, db } from './store';

const MAX_BODY = 4 * 1024 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Too big.');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Bad JSON.');
  }
}

/** A day's Daily Doom board. `player` adds that wallet's own rank, even outside the top 10. */
async function leaderboard(dayParam: string | null, player: string | null) {
  const now = Number(await chainNow());
  const today = Math.floor(now / 86400);
  const day = dayParam != null ? Number(dayParam) : today;
  if (!Number.isInteger(day)) throw new HttpError(400, 'Bad day.');
  const pot = await potOf(day);
  const board = dailyBoard(day);
  const row = (r: (typeof board)[number], i: number) => ({
    rank: i + 1, player: r.player, score: r.result!.score, title: r.result!.title, day: r.result!.day, runId: r.runId,
  });
  const mine = player ? board.findIndex((r) => r.player.toLowerCase() === player.toLowerCase()) : -1;
  const s = db.settlement(day);
  return {
    day,
    today,
    /** Seconds until this day's pot pays out (0 once it's over). */
    endsIn: day === today ? Math.max(0, (day + 1) * 86400 - now) : 0,
    pot: (s ? BigInt(s.amount) : pot).toString(),
    potBunkr: formatUnits(s ? BigInt(s.amount) : pot, 18),
    settlement: s ?? null,
    total: board.length,
    top: board.slice(0, 10).map(row),
    you: mine >= 0 ? row(board[mine], mine) : null,
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, chainId: deployment.chainId, oracle: oracle.address });
    if (req.method === 'GET' && url.pathname === '/leaderboard') return send(res, 200, await leaderboard(url.searchParams.get('day'), url.searchParams.get('player')));
    if (req.method === 'POST' && url.pathname === '/run/start') return send(res, 200, await startRun(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/run/day') return send(res, 200, await daySeed(await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/run/finish') return send(res, 200, await finishRun(await readJson(req)));
    send(res, 404, { error: 'Not found.' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Server error.' });
  }
});

/** Settle finished days and sweep abandoned runs, one pass at a time. */
let busy = false;
async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const swept = await sweepAbandoned(Date.now(), ABANDON_MS);
    if (swept) console.log(`swept ${swept} abandoned run(s)`);
    for (const line of await settleFinishedDays()) console.log(line);
  } catch (err) {
    console.error('tick failed:', (err as Error).message.split('\n')[0]);
  } finally {
    busy = false;
  }
}

server.listen(PORT, () => {
  console.log(`BUNKR results server on :${PORT} · chain ${deployment.chainId} · oracle ${oracle.address}`);
  void tick();
  setInterval(() => void tick(), TICK_MS);
});
