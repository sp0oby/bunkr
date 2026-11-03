// BUNKR results server.
//   POST /run/start    { txHash, secret, defcon, vault, loadout }  -> { runId, seed, config }
//   POST /run/day      { runId, secret, day }                      -> that day's seed (in order, paced)
//   POST /run/finish   { runId, secret, ticks, inputs }            -> verified result
//   GET  /leaderboard?day=N                                       -> Daily Doom top 10 + pot
//   GET  /health
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { formatUnits } from 'viem';
import { chainToday, oracle, potOf } from './chain';
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

async function leaderboard(dayParam: string | null) {
  const day = dayParam != null ? Number(dayParam) : await chainToday();
  if (!Number.isInteger(day)) throw new HttpError(400, 'Bad day.');
  const pot = await potOf(day);
  return {
    day,
    pot: pot.toString(),
    potBunkr: formatUnits(pot, 18),
    settlement: db.settlement(day) ?? null,
    top: dailyBoard(day).slice(0, 10).map((r, i) => ({ rank: i + 1, player: r.player, score: r.result!.score, title: r.result!.title, runId: r.runId })),
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, chainId: deployment.chainId, oracle: oracle.address });
    if (req.method === 'GET' && url.pathname === '/leaderboard') return send(res, 200, await leaderboard(url.searchParams.get('day')));
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
