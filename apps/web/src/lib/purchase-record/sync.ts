// Purchase record job (gamification v1, section 3 of the architecture). Reads edition events from the sale and
// token contracts of every network into edition_events, then recalculates holdings from that table. It only
// reads the chain and writes its own three tables. Safe to run twice, at the same time, or after a gap:
// an event is stored once (unique key), holdings are sums over the stored events (order does not matter),
// and the last block read moves forward only together with the events of that range.
import { and, eq, inArray, sql } from "drizzle-orm";
import { createPublicClient, http, defineChain } from "viem";
import { editionEvents, recordCursors, holdings } from "@rb/db/schema";
import type { DB } from "@rb/db";
import { RECORDED_CHAINS, type RecordedChain } from "./contracts";
import { decodeLogs, RECORD_EVENTS, type RawLog } from "./events";

const ZERO = "0x0000000000000000000000000000000000000000";
const MIN_RANGE = 1_000;
const RECORD_LOCK = 20261128; // first key of the job's advisory lock; the second is the chain id

/** What the job needs from a network. The live one is makeChainReader; tests pass a fake. */
export interface ChainReader {
  chainId(): Promise<number>;
  blockNumber(): Promise<number>;
  logs(addresses: string[], fromBlock: number, toBlock: number): Promise<RawLog[]>;
  blockTime(blockNumber: number): Promise<Date>;
}

export interface SyncOptions {
  deadline?: number; // Date.now() value after which the run stops between ranges; progress so far is kept
  retryDelayMs?: number;
}

export interface ChainSyncResult {
  chainId: number;
  head: number | null;
  readTo: number | null; // every contract is read up to this block
  inserted: number; // new rows in edition_events
  seen: number; // events read from the chain, already stored ones included
  requests: number;
  caughtUp: boolean;
  error?: string;
}

const DEFAULT_RPC: Record<number, string> = {
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  46630: "https://rpc.testnet.chain.robinhood.com",
  11142220: "https://forno.celo-sepolia.celo-testnet.org",
};

/** Optional provider connection per network (RPC_URL_<chainId>), else the network's public one. */
export function rpcUrlFor(chainId: number): string {
  const url = process.env[`RPC_URL_${chainId}`] || DEFAULT_RPC[chainId];
  if (!url) throw new Error(`no network connection configured for chain ${chainId}`);
  return url;
}

export function makeChainReader(chainId: number): ChainReader {
  const chain = defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: "native", symbol: "N", decimals: 18 }, rpcUrls: { default: { http: [rpcUrlFor(chainId)] } } });
  const client = createPublicClient({ chain, transport: http(rpcUrlFor(chainId), { timeout: 30_000, retryCount: 2 }) });
  return {
    chainId: () => client.getChainId(),
    blockNumber: async () => Number(await client.getBlockNumber()),
    logs: async (addresses, fromBlock, toBlock) => {
      const logs = await client.getLogs({ address: addresses as `0x${string}`[], events: RECORD_EVENTS, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock) });
      return logs.map((l) => ({ address: l.address, topics: l.topics, data: l.data, blockNumber: l.blockNumber, transactionHash: l.transactionHash, logIndex: l.logIndex }));
    },
    blockTime: async (n) => new Date(Number((await client.getBlock({ blockNumber: BigInt(n) })).timestamp) * 1000),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Recalculates holdings of one network from edition_events: held = editions received minus editions sent
 * (mint and burn included), retired = editions retired. A row is rewritten only when its numbers change.
 */
export async function recomputeHoldings(db: Pick<DB, "execute">, chainId: number): Promise<void> {
  await db.execute(sql`
    INSERT INTO holdings (chain_id, token_contract, token_id, wallet, editions_held, editions_retired, updated_at)
    SELECT chain_id, token_contract, token_id, wallet, SUM(held), SUM(retired), now()
    FROM (
      SELECT chain_id, token_contract, token_id, to_address AS wallet, amount AS held, 0::numeric AS retired
        FROM edition_events WHERE chain_id = ${chainId} AND kind = 'transferred' AND to_address <> ${ZERO}
      UNION ALL
      SELECT chain_id, token_contract, token_id, from_address AS wallet, -amount AS held, 0::numeric AS retired
        FROM edition_events WHERE chain_id = ${chainId} AND kind = 'transferred' AND from_address <> ${ZERO}
      UNION ALL
      SELECT chain_id, token_contract, token_id, wallet, 0::numeric AS held, amount AS retired
        FROM edition_events WHERE chain_id = ${chainId} AND kind = 'retired' AND wallet IS NOT NULL
    ) moves
    GROUP BY chain_id, token_contract, token_id, wallet
    ON CONFLICT (chain_id, token_contract, token_id, wallet) DO UPDATE
      SET editions_held = EXCLUDED.editions_held, editions_retired = EXCLUDED.editions_retired, updated_at = now()
      WHERE holdings.editions_held <> EXCLUDED.editions_held OR holdings.editions_retired <> EXCLUDED.editions_retired
  `);
}

/** Reads one network forward from where the job stopped. Never throws: a failure is returned in `error`. */
export async function syncChain(db: DB, chain: RecordedChain, reader: ChainReader, opts: SyncOptions = {}): Promise<ChainSyncResult> {
  const result: ChainSyncResult = { chainId: chain.chainId, head: null, readTo: null, inserted: 0, seen: 0, requests: 0, caughtUp: false };
  const addresses = chain.contracts.map((c) => c.address);
  const blockTimes = new Map<number, Date>();
  try {
    // A connection that points at another network would answer "no events" and the job would skip real ones.
    const connected = await reader.chainId();
    if (connected !== chain.chainId) throw new Error(`the connection for chain ${chain.chainId} answers as chain ${connected}`);
    const head = await reader.blockNumber();
    result.head = head;
    const safe = head - chain.confirmations;
    // A contract the job has never read starts just before its own first block.
    await db
      .insert(recordCursors)
      .values(chain.contracts.map((c) => ({ chainId: chain.chainId, contract: c.address, lastBlock: c.startBlock - 1 })))
      .onConflictDoNothing();

    let range = chain.maxRange;
    for (;;) {
      const cursors = await db
        .select({ contract: recordCursors.contract, lastBlock: recordCursors.lastBlock })
        .from(recordCursors)
        .where(and(eq(recordCursors.chainId, chain.chainId), inArray(recordCursors.contract, addresses)));
      const lowest = Math.min(...cursors.map((c) => c.lastBlock));
      result.readTo = lowest;
      if (lowest >= safe) {
        result.caughtUp = true;
        break;
      }
      if (opts.deadline && Date.now() > opts.deadline) break;

      // Contracts that stopped at the same block are read together, up to where the next ones stopped.
      const group = cursors.filter((c) => c.lastBlock === lowest).map((c) => c.contract);
      const nextStop = Math.min(...cursors.filter((c) => c.lastBlock > lowest).map((c) => c.lastBlock), Infinity);
      const from = lowest + 1;
      const to = Math.min(safe, from + range - 1, nextStop);

      let logs: RawLog[];
      try {
        result.requests += 1;
        logs = await reader.logs(group, from, to);
      } catch (e) {
        // Networks answer a limited range (and sometimes fail): try half the range before giving up.
        if (range <= MIN_RANGE) throw e;
        range = Math.max(MIN_RANGE, Math.floor(range / 2));
        await sleep(opts.retryDelayMs ?? 500);
        continue;
      }

      const decoded = decodeLogs(chain, logs).filter((e) => group.includes(e.contract) && e.blockNumber >= from && e.blockNumber <= to);
      for (const e of decoded) {
        if (!blockTimes.has(e.blockNumber)) blockTimes.set(e.blockNumber, await reader.blockTime(e.blockNumber));
      }
      const rows = decoded.map((e) => ({ ...e, blockTime: blockTimes.get(e.blockNumber)! }));
      result.seen += rows.length;

      const inserted = await db.transaction(async (tx) => {
        // One writer per network at a time, so holdings are always recalculated from every stored event.
        await tx.execute(sql`select pg_advisory_xact_lock(${RECORD_LOCK}, ${chain.chainId})`);
        let n = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const added = await tx.insert(editionEvents).values(rows.slice(i, i + 500)).onConflictDoNothing().returning({ id: editionEvents.id });
          n += added.length;
        }
        // Moves only from the block this run started at: a second runner that got there first changes nothing.
        await tx
          .update(recordCursors)
          .set({ lastBlock: to, updatedAt: new Date() })
          .where(and(eq(recordCursors.chainId, chain.chainId), inArray(recordCursors.contract, group), eq(recordCursors.lastBlock, lowest)));
        if (n > 0) await recomputeHoldings(tx, chain.chainId);
        return n;
      });
      result.inserted += inserted;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
  }
  return result;
}

/** One run over every network. A network that fails does not stop the others. */
export async function syncAll(db: DB, opts: SyncOptions & { readerFor?: (chainId: number) => ChainReader; chains?: RecordedChain[] } = {}): Promise<ChainSyncResult[]> {
  const readerFor = opts.readerFor ?? makeChainReader;
  const out: ChainSyncResult[] = [];
  for (const chain of opts.chains ?? RECORDED_CHAINS) {
    let reader: ChainReader;
    try {
      reader = readerFor(chain.chainId);
    } catch (e) {
      out.push({ chainId: chain.chainId, head: null, readTo: null, inserted: 0, seen: 0, requests: 0, caughtUp: false, error: String(e).slice(0, 300) });
      continue;
    }
    out.push(await syncChain(db, chain, reader, opts));
  }
  return out;
}

/**
 * Empties the three tables of the record. They hold nothing but what was read from the chain, so the next
 * sync rebuilds them in full. Used by the rebuild command only.
 */
export async function clearRecord(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(holdings);
    await tx.delete(editionEvents);
    await tx.delete(recordCursors);
  });
}
