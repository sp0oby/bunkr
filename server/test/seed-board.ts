// Local dev: put a few Anvil test players on today's Daily Doom board so the
// leaderboard has something on it. Needs Anvil + the results server running.
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { ticketsAbi, tokenAbi } from '../../src/chain/abi';
import { Game } from '../../src/sim/game';
import { ROOMS } from '../../src/sim/content';
import type { RoomType } from '../../src/sim/types';

const API = 'http://localhost:8787';
const dep = JSON.parse(readFileSync(new URL('../../src/chain/deployments/31337.json', import.meta.url), 'utf8'));
const pub = createPublicClient({ chain: foundry, transport: http(), pollingInterval: 200 });
// Anvil test accounts #5-#8.
const KEYS: Hex[] = [
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
];

async function api(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as any };
}

async function play(key: Hex, skill: number) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: foundry, transport: http() });
  const write = async (address: Address, abi: any, functionName: string, args: unknown[] = []) => {
    const { request } = await pub.simulateContract({ account, address, abi, functionName, args } as any);
    await pub.waitForTransactionReceipt({ hash: await wallet.writeContract(request as any) });
  };
  await write(dep.bunkr, tokenAbi, 'faucet').catch(() => {});
  await write(dep.bunkr, tokenAbi, 'approve', [dep.tickets, 10n ** 30n]);
  await write(dep.tickets, ticketsAbi, 'buyTickets', [2]).catch(() => {});
  const secret = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const { request } = await pub.simulateContract({ account, address: dep.tickets, abi: ticketsAbi, functionName: 'enterRun', args: [true, keccak256(secret)] });
  const txHash = await wallet.writeContract(request);
  await pub.waitForTransactionReceipt({ hash: txHash });
  const start = await api('/run/start', { txHash, secret });
  const { runId, seed, config } = start.json;

  // A rough bot: builds the basics and staffs them. Higher skill builds more.
  const g = new Game(seed, config);
  const plan: [RoomType, number, number][] = [['reactor', 0, 0], ['kitchen', 0, 1], ['pool', 0, 2], ['kitchen', 0, 3], ['reactor', 0, 4]];
  for (const [t, f, c] of plan.slice(0, 2 + skill)) if (ROOMS[t]) g.build(t, f, c);
  g.rooms.forEach((r, i) => g.dwellers[i] && g.assign(g.dwellers[i].id, r.id));
  g.skipPrep();
  for (let i = 0; i < 200_000 && !g.ending; i++) {
    if (g.card) g.card.result == null ? g.chooseCard(skill % 2) : g.dismissCard();
    if (g.audit) g.audit.done ? g.dismissAudit() : g.answerAudit(g.audit.forms[g.audit.idx]?.legit ?? true);
    if (g.revive) g.revive.done ? g.dismissRevive() : g.pressF();
    if (g.phase === 'drop') g.skipDrop();
    const need = g.awaitingDay();
    if (need != null) {
      const r = await api('/run/day', { runId, secret, day: need });
      if (r.status === 200) {
        g.daySeeds.set(r.json.day, r.json.seed);
        if (r.json.event) g.dayEvents.set(r.json.day, r.json.event);
      }
      else await new Promise((ok) => setTimeout(ok, 350));
      continue;
    }
    g.step();
  }
  const fin = await api('/run/finish', { runId, secret, ticks: g.tick, inputs: g.inputs });
  console.log(`${account.address.slice(0, 8)}: ${fin.json.title} ${fin.json.score} (rank ${fin.json.dailyRank})`);
}

for (const [i, k] of KEYS.entries()) await play(k, i);
