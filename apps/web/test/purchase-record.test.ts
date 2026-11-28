// Purchase record job (gamification v1, section 3 and 7 of the architecture). The real job and read functions
// run against an in-memory Postgres (PGlite, real migrations) and a fake chain. Nothing touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics, type AbiEvent } from "viem";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "@rb/db/testing";
import * as schema from "@rb/db/schema";
import type { DB } from "@rb/db";
import { RECORDED_CHAINS, tokenGeneration, type RecordedChain } from "../src/lib/purchase-record/contracts";
import { decodeLogs, RECORD_EVENTS, type RawLog } from "../src/lib/purchase-record/events";
import { clearRecord, recomputeHoldings, syncAll, syncChain, type ChainReader } from "../src/lib/purchase-record/sync";
import { areaBoard, purchaseHistory, recordStatus, walletHoldings, walletPoints } from "../src/lib/purchase-record/read";
import { enabledNetworks } from "../src/lib/networks";
import { contractGenerationOf } from "../src/lib/revision4";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const ZERO = addr(0);
const TOKEN = "0x6f2c6f81ddd35199d2e015710c61cc6d8b5de9da"; // the real tRWI contracts of Arbitrum Sepolia, so listings resolve
const SALE1 = addr(0xa2);
const SALE2 = addr(0xa3);
const TOKEN4 = "0xa46c092d014d8fc79712f566f5b96bdfa3af53a5";
const SALE3 = addr(0xa5);
const STRANGER = addr(0xdead);
const ALICE = addr(0xb1);
const BOB = addr(0xb2);
const CREATOR = addr(0xc1);
const TUSDG = "0x738b0c655e050320764ea1a7191bea226b053410";

// Arbitrum Sepolia's id, so explorer links and the tUSDG coin resolve; the sale contracts and blocks are made up.
const CHAIN: RecordedChain = {
  chainId: 421614,
  maxRange: 5_000,
  confirmations: 2,
  contracts: [
    { address: TOKEN as `0x${string}`, role: "token", token: TOKEN as `0x${string}`, generation: 3, startBlock: 1_000 },
    { address: SALE1 as `0x${string}`, role: "sale", token: TOKEN as `0x${string}`, generation: 3, startBlock: 1_000 },
    { address: SALE2 as `0x${string}`, role: "sale", token: TOKEN as `0x${string}`, generation: 3, startBlock: 4_000 },
    { address: TOKEN4 as `0x${string}`, role: "token", token: TOKEN4 as `0x${string}`, generation: 4, startBlock: 9_000 },
    { address: SALE3 as `0x${string}`, role: "sale", token: TOKEN4 as `0x${string}`, generation: 4, startBlock: 9_000 },
  ],
  currencies: RECORDED_CHAINS[0].currencies,
};

const event = (name: string, inputCount: number) => RECORD_EVENTS.find((e) => e.name === name && e.inputs.length === inputCount) as AbiEvent;
let logCounter = 0;
function log(address: string, e: AbiEvent, args: Record<string, unknown>, block: number, tx = hash(++logCounter)): RawLog {
  const topics = encodeEventTopics({ abi: [e], eventName: e.name, args } as never) as string[];
  const plain = e.inputs.filter((i) => !i.indexed);
  const data = encodeAbiParameters(plain as never, plain.map((i) => args[i.name!]) as never);
  return { address, topics, data, blockNumber: block, transactionHash: tx, logIndex: ++logCounter };
}
const transfer = (token: string, from: string, to: string, id: bigint, value: bigint, block: number, tx?: string) =>
  log(token, event("TransferSingle", 5), { operator: from === ZERO ? SALE2 : from, from, to, id, value }, block, tx);
const soldV2 = (saleAddr: string, buyer: string, tokenId: bigint, amount: bigint, total: bigint, block: number, tx?: string) =>
  log(saleAddr, event("Sold", 5), { tokenId, buyer, amount, total, currency: TUSDG }, block, tx);
const retired = (holder: string, tokenId: bigint, amount: bigint, block: number, tx?: string) =>
  log(TOKEN, event("ImpactRetired", 4), { tokenId, holder, amount, ivRetired: 1n }, block, tx);
/** A purchase as the chain shows it: the mint (transfer from zero) and the sale record, in one transaction. */
function purchase(buyer: string, tokenId: bigint, amount: bigint, total: bigint, block: number, saleAddr = SALE2): RawLog[] {
  const tx = hash(++logCounter);
  return [transfer(TOKEN, ZERO, buyer, tokenId, amount, block, tx), soldV2(saleAddr, buyer, tokenId, amount, total, block, tx)];
}
/** A retirement: the burn and the retire record, in one transaction. */
function retirement(holder: string, tokenId: bigint, amount: bigint, block: number): RawLog[] {
  const tx = hash(++logCounter);
  return [transfer(TOKEN, holder, ZERO, tokenId, amount, block, tx), retired(holder, tokenId, amount, block, tx)];
}

class FakeChain implements ChainReader {
  requests = 0;
  maxRange = Infinity;
  failHead = false;
  failLogsFrom: number | null = null; // every request that reaches this block fails
  mangle: (logs: RawLog[]) => RawLog[] = (l) => l;
  constructor(public all: RawLog[], public head: number) {}
  networkId = 421614;
  async chainId() {
    return this.networkId;
  }
  async blockNumber() {
    if (this.failHead) throw new Error("network down");
    return this.head;
  }
  async logs(addresses: string[], from: number, to: number) {
    this.requests += 1;
    if (to - from + 1 > this.maxRange) throw new Error("query exceeds range");
    if (this.failLogsFrom != null && to >= this.failLogsFrom) throw new Error("network down");
    const set = new Set(addresses.map((a) => a.toLowerCase()));
    return this.mangle(this.all.filter((l) => set.has(l.address.toLowerCase()) && Number(l.blockNumber) >= from && Number(l.blockNumber) <= to));
  }
  async blockTime(n: number) {
    return new Date(Date.UTC(2026, 10, 1) + n * 1000);
  }
}

async function seed(db: DB) {
  const [org] = await db.insert(schema.organizations).values({ walletAddress: addr(0xc2), name: "Mangrove Org", slug: "mangrove-org" }).returning();
  const sub = async (v: Partial<typeof schema.impactSubmissions.$inferInsert>) =>
    (await db.insert(schema.impactSubmissions).values({ orgId: org.id, title: "t", description: "d", status: "tokenized", chainId: 421614, ...v }).returning())[0];
  const listing = async (submissionId: string, tokenId: string, v: Partial<typeof schema.listings.$inferInsert> = {}) =>
    (
      await db
        .insert(schema.listings)
        .values({ submissionId, chainId: 421614, tokenId, totalIvWei: "1", maxEditions: 100, pricePerEdition: "622500", currency: TUSDG, beneficiary: CREATOR, easUid: hash(9), metadataUri: "ipfs://x", ...v })
        .returning()
    )[0];
  const two = await sub({ title: "Mangroves, two areas", domain: "environment", methodologyVersion: "v0.2", proofLevel: "P2", ivValue: "56.65", domainScores: [{ domain: "environment", score: 50.65 }, { domain: "education", score: 6 }] });
  const old = await sub({ title: "Old method", domain: "animal_welfare", ivValue: "98.49" });
  return { org, two: await listing(two.id, "5"), old: await listing(old.id, "6"), twoSub: two, oldSub: old };
}

const eventsOf = async (db: DB) =>
  (await db.select().from(schema.editionEvents)).map((e) => `${e.kind}|${e.tokenContract}|${e.tokenId}|${e.amount}|${e.wallet}|${e.fromAddress}|${e.toAddress}|${e.totalPaid}|${e.blockNumber}|${e.txHash}|${e.logIndex}|${e.batchIndex}`).sort();
const holdingsOf = async (db: DB) =>
  (await db.select().from(schema.holdings)).map((h) => `${h.tokenContract}|${h.tokenId}|${h.wallet}|${h.editionsHeld}|${h.editionsRetired}`).sort();

/** Alice buys 10 of token 5 and 2 of token 6, gives 3 of token 5 to Bob, retires 4 (in one retirement). */
function story(): RawLog[] {
  logCounter = 0; // the same story always has the same transactions
  return [
    ...purchase(ALICE, 5n, 10n, 6_225_000n, 4_100),
    ...purchase(ALICE, 6n, 2n, 1_245_000n, 1_200, SALE1),
    transfer(TOKEN, ALICE, BOB, 5n, 3n, 4_300),
    ...retirement(ALICE, 5n, 4n, 4_500),
  ];
}

test("one run records purchases, transfers and retirements; holdings match the chain", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const chain = new FakeChain(story(), 6_000);
  const r = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(r.error, undefined);
  assert.equal(r.caughtUp, true);
  assert.equal(r.readTo, 5_998, "stays `confirmations` blocks behind the newest one");
  assert.equal(r.inserted, 7);
  const kinds = await db.execute(sql`select kind, count(*)::int as n from edition_events group by 1 order by 1`);
  assert.deepEqual((kinds as unknown as { rows: unknown[] }).rows, [{ kind: "bought", n: 2 }, { kind: "retired", n: 1 }, { kind: "transferred", n: 4 }]);
  assert.deepEqual(await holdingsOf(db), [`${TOKEN}|5|${ALICE}|3|4`, `${TOKEN}|5|${BOB}|3|0`, `${TOKEN}|6|${ALICE}|2|0`]);
});

test("a second run changes nothing: no new rows, no rewritten holdings", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const chain = new FakeChain(story(), 6_000);
  await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  const before = { events: await eventsOf(db), holdings: await db.select().from(schema.holdings) };
  const again = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(again.inserted, 0);
  assert.equal(again.requests, 0, "nothing new on the chain: no log request at all");
  assert.deepEqual(await eventsOf(db), before.events);
  assert.deepEqual(await db.select().from(schema.holdings), before.holdings, "updated_at included");
  // The same range read again (the job restarted from an old position): still nothing changes.
  await db.update(schema.recordCursors).set({ lastBlock: 999 });
  const reread = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(reread.seen, 7);
  assert.equal(reread.inserted, 0);
  assert.deepEqual(await db.select().from(schema.holdings), before.holdings);
});

test("duplicate and reordered events give the same record", async () => {
  const ordered = await createTestDb();
  await seed(ordered.db);
  await syncChain(ordered.db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 });

  const messy = await createTestDb();
  await seed(messy.db);
  const chain = new FakeChain(story(), 6_000);
  chain.mangle = (logs) => [...logs, ...logs].reverse(); // every event twice, newest first (retire before the purchase)
  const r = await syncChain(messy.db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(r.seen, 14);
  assert.equal(r.inserted, 7);
  assert.deepEqual(await eventsOf(messy.db), await eventsOf(ordered.db));
  assert.deepEqual(await holdingsOf(messy.db), await holdingsOf(ordered.db));
});

test("a network that answers only short ranges is read in smaller steps, without gaps", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const chain = new FakeChain(story(), 20_000);
  chain.maxRange = 1_200;
  const r = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(r.error, undefined);
  assert.equal(r.caughtUp, true);
  assert.equal(r.inserted, 7);
  assert.ok(r.requests > 15, "many short requests");
  const cursors = await db.select().from(schema.recordCursors);
  assert.equal(cursors.length, 5);
  assert.ok(cursors.every((c) => c.lastBlock === 19_998));
});

test("a failure in the middle keeps what was read and the next run continues from there", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const chain = new FakeChain(story(), 6_000);
  chain.maxRange = 1_000;
  chain.failLogsFrom = 4_250; // the purchase at 4100 is readable, the transfer at 4300 is not
  const broken = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.match(broken.error ?? "", /network down/);
  assert.equal(broken.caughtUp, false);
  assert.ok((await eventsOf(db)).length > 0 && (await eventsOf(db)).length < 7);
  const cursors = await db.select().from(schema.recordCursors).where(eq(schema.recordCursors.contract, TOKEN));
  assert.ok(cursors[0].lastBlock < 4_250, "the last block read never passes a range that failed");
  chain.failLogsFrom = null;
  const healed = await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.equal(healed.error, undefined);
  assert.equal((await eventsOf(db)).length, 7);
  assert.deepEqual(await holdingsOf(db), [`${TOKEN}|5|${ALICE}|3|4`, `${TOKEN}|5|${BOB}|3|0`, `${TOKEN}|6|${ALICE}|2|0`]);
});

test("a connection that points at another network is refused: nothing is read and the position stays", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const wrong = new FakeChain([], 6_000); // answers with no events, as another network would
  wrong.networkId = 11142220;
  const r = await syncChain(db, CHAIN, wrong, { retryDelayMs: 0 });
  assert.match(r.error ?? "", /answers as chain 11142220/);
  assert.equal((await db.select().from(schema.recordCursors)).length, 0);
  const ok = await syncChain(db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 });
  assert.equal(ok.inserted, 7);
});

test("the history limit counts impacts of the site only", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const logs = [...story(), ...purchase(ALICE, 777n, 1n, 1n, 4_700), ...purchase(ALICE, 778n, 1n, 1n, 4_800)];
  await syncChain(db, CHAIN, new FakeChain(logs, 6_000), { retryDelayMs: 0 });
  assert.deepEqual((await purchaseHistory(db, ALICE, { limit: 2 })).map((h) => h.tokenId), ["5", "5"]);
});

test("one network down does not stop the others", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const down = new FakeChain([], 100);
  down.failHead = true;
  const other: RecordedChain = { ...CHAIN, chainId: 46630, contracts: CHAIN.contracts.slice(0, 2) };
  const results = await syncAll(db, { chains: [other, CHAIN], readerFor: (id) => (id === 46630 ? Object.assign(down, { networkId: 46630 }) : new FakeChain(story(), 6_000)), retryDelayMs: 0 });
  assert.match(results[0].error ?? "", /network down/);
  assert.equal(results[1].inserted, 7);
});

test("two runs at the same time store every event once", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const results = await Promise.all([syncChain(db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 }), syncChain(db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 })]);
  assert.ok(results.every((r) => !r.error));
  assert.equal(results[0].inserted + results[1].inserted, 7);
  assert.equal((await eventsOf(db)).length, 7);
  assert.deepEqual(await holdingsOf(db), [`${TOKEN}|5|${ALICE}|3|4`, `${TOKEN}|5|${BOB}|3|0`, `${TOKEN}|6|${ALICE}|2|0`]);
});

test("events that cannot be a purchase are ignored: unknown contract, wrong role, garbage, zero amount", () => {
  const good = purchase(ALICE, 5n, 1n, 10n, 4_100);
  const fake = [
    soldV2(STRANGER, ALICE, 5n, 100n, 1n, 4_100), // a contract the record does not know
    soldV2(TOKEN, ALICE, 5n, 100n, 1n, 4_100), // a sale event from the token contract
    transfer(SALE2, ZERO, ALICE, 5n, 100n, 4_100), // a transfer event from the sale contract
    { ...good[0], data: "0x1234", logIndex: 900 }, // does not decode
    { ...good[0], topics: [], logIndex: 901 },
    transfer(TOKEN, ZERO, ALICE, 5n, 0n, 4_100), // moves nothing
  ];
  const decoded = decodeLogs(CHAIN, [...good, ...fake]);
  assert.equal(decoded.length, 2);
  assert.deepEqual(decoded.map((d) => d.kind).sort(), ["bought", "transferred"]);
});

test("a batch transfer becomes one row per tRWI", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const batch = log(TOKEN, event("TransferBatch", 5), { operator: ALICE, from: ALICE, to: BOB, ids: [5n, 6n], values: [2n, 1n] }, 4_400);
  await syncChain(db, CHAIN, new FakeChain([...story(), batch], 6_000), { retryDelayMs: 0 });
  const rows = await db.select().from(schema.editionEvents).where(eq(schema.editionEvents.txHash, batch.transactionHash));
  assert.deepEqual(rows.map((r) => `${r.tokenId}:${r.amount}:${r.batchIndex}`).sort(), ["5:2:0", "6:1:1"]);
  assert.deepEqual(await holdingsOf(db), [`${TOKEN}|5|${ALICE}|1|4`, `${TOKEN}|5|${BOB}|5|0`, `${TOKEN}|6|${ALICE}|1|0`, `${TOKEN}|6|${BOB}|1|0`]);
});

test("revision 4: a sale to another recipient and a retirement with a name; the same number on another contract is another tRWI", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const tx = hash(++logCounter);
  const sale = [
    transfer(TOKEN4, ZERO, BOB, 5n, 3n, 9_100, tx),
    log(SALE3, event("Sold", 6), { tokenId: 5n, payer: ALICE, recipient: BOB, amount: 3n, currency: TUSDG, payout: { total: 900_000n, creatorPaid: 800_000n, platformPaid: 100_000n, partnerPaid: 0n, beneficiary: CREATOR, partner: ZERO } }, 9_100, tx),
  ];
  const tx2 = hash(++logCounter);
  const retire = [
    transfer(TOKEN4, BOB, ZERO, 5n, 2n, 9_200, tx2),
    log(TOKEN4, event("ContributionStatement", 6), { statementId: 7n, tokenId: 5n, holder: BOB, amount: 2n, impactValue: 1n, inNameOf: "Bob's Reef Fund" }, 9_200, tx2),
  ];
  await syncChain(db, CHAIN, new FakeChain([...sale, ...retire], 10_000), { retryDelayMs: 0 });
  assert.deepEqual(await holdingsOf(db), [`${TOKEN4}|5|${BOB}|1|2`]);
  const [bought] = await db.select().from(schema.editionEvents).where(eq(schema.editionEvents.kind, "bought"));
  assert.deepEqual([bought.wallet, bought.payer, bought.totalPaid, bought.tokenContract], [BOB, ALICE, "900000", TOKEN4]);
  const [ret] = await db.select().from(schema.editionEvents).where(eq(schema.editionEvents.kind, "retired"));
  assert.deepEqual([ret.amount, ret.statementId, ret.inNameOf], ["2", "7", "Bob's Reef Fund"]);
  // Token 5 is listed on the generation 3 contract only: the editions on the revision 4 contract give no points.
  assert.deepEqual(await walletHoldings(db, BOB), []);
  const all = await walletHoldings(db, BOB, { includeUnlisted: true });
  assert.equal(all.length, 1);
  assert.equal(all[0].listed, false);
  assert.equal((await walletPoints(db, BOB)).points.environment, 0);
  // Once the tRWI is listed on revision 4, the same holding counts.
  const { twoSub } = { twoSub: (await db.select().from(schema.impactSubmissions).where(eq(schema.impactSubmissions.title, "Mangroves, two areas")))[0] };
  await db.update(schema.listings).set({ contractGeneration: 4 }).where(eq(schema.listings.submissionId, twoSub.id));
  assert.equal((await walletPoints(db, BOB)).points.environment, 1.2156); // 50.65 / 100 * 0.8 * 3
  const history = await purchaseHistory(db, BOB);
  assert.deepEqual(history.map((h) => [h.kind, h.editions, h.inNameOf]), [["retired", 2, "Bob's Reef Fund"], ["bought", 3, null]]);
});

test("read functions: points per area, holdings and purchase history of a wallet", async () => {
  const { db } = await createTestDb();
  const s = await seed(db);
  await syncChain(db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 });

  const p = await walletPoints(db, ALICE.toUpperCase().replace("0X", "0x"));
  // token 5: 7 editions (3 held + 4 retired) x 50.65 / 100 x 0.8 = 2.8364 environment; x 6 / 100 x 0.8 = 0.336 education
  // token 6 (old method, no proof level): 2 editions x 98.49 / 100 x 0.6 = 1.18188 animal welfare
  assert.deepEqual(p.points, { environment: 2.8364, animal_welfare: 1.18188, education: 0.336, poverty: 0, social: 0, health: 0 });
  assert.deepEqual([p.areasOpened, p.trwiCount, p.editionsHeld, p.editionsRetired], [3, 2, 5, 4]);
  const status = await recordStatus(db, [CHAIN]);
  assert.ok(status.updatedAt instanceof Date);
  assert.deepEqual([status.chains[0].readTo, status.chains[0].events], [5_998, 7]);
  assert.equal(p.updatedAt, null, "not every recorded network has been read yet");
  assert.equal((await walletPoints(db, BOB)).points.environment, 1.2156);

  const hs = await walletHoldings(db, ALICE);
  assert.deepEqual(hs.map((h) => [h.tokenId, h.title, h.editionsHeld, h.editionsRetired, h.pointsPerEdition.environment, h.submissionId]), [
    ["5", "Mangroves, two areas", 3, 4, 0.4052, s.twoSub.id],
    ["6", "Old method", 2, 0, 0, s.oldSub.id],
  ]);
  assert.equal(hs[0].tokenUrl, `https://sepolia.arbiscan.io/nft/${TOKEN}/5`);

  const history = await purchaseHistory(db, ALICE);
  assert.deepEqual(history.map((h) => [h.kind, h.tokenId, h.editions, h.pricePaid?.formatted ?? null, h.pricePaid?.symbol ?? null]), [
    ["retired", "5", 4, null, null],
    ["bought", "5", 10, "6.225", "tUSDG"],
    ["bought", "6", 2, "1.245", "tUSDG"],
  ]);
  assert.equal(history[1].title, "Mangroves, two areas");
  assert.equal(history[1].date.toISOString(), new Date(Date.UTC(2026, 10, 1) + 4_100_000).toISOString());
  assert.match(history[1].txUrl ?? "", /^https:\/\/sepolia\.arbiscan\.io\/tx\/0x[0-9a-f]{64}$/);
  assert.deepEqual(await purchaseHistory(db, BOB), [], "a received transfer is not a purchase");
  assert.equal((await purchaseHistory(db, ALICE, { limit: 1 })).length, 1);

  await assert.rejects(walletPoints(db, "0x123"), /not a wallet address/);
  await assert.rejects(purchaseHistory(db, "' or 1=1 --"), /not a wallet address/);
  assert.deepEqual((await walletPoints(db, addr(0xeeee))).points.environment, 0, "an unknown wallet has an empty record, not an error");

  const board = await areaBoard(db, "environment");
  assert.deepEqual(board, [{ wallet: ALICE, points: 2.8364 }, { wallet: BOB, points: 1.2156 }]);
  assert.deepEqual(await areaBoard(db, "health"), []);
});

test("no buyer points for a creator's own tRWI or for a withdrawn one; tokens outside the site are hidden", async () => {
  const { db } = await createTestDb();
  const s = await seed(db);
  const logs = [...story(), ...purchase(CREATOR, 5n, 20n, 1n, 4_600), ...purchase(ALICE, 777n, 9n, 1n, 4_700)];
  await syncChain(db, CHAIN, new FakeChain(logs, 6_000), { retryDelayMs: 0 });
  const own = await walletHoldings(db, CREATOR);
  assert.equal(own[0].ownImpact, true);
  assert.equal(own[0].editionsHeld, 20);
  assert.equal((await walletPoints(db, CREATOR)).points.environment, 0);
  assert.equal((await walletHoldings(db, ALICE)).length, 2, "token 777 is on the chain but is no impact of the site");
  assert.equal((await walletHoldings(db, ALICE, { includeUnlisted: true })).length, 3);
  assert.equal((await purchaseHistory(db, ALICE)).some((h) => h.tokenId === "777"), false);

  await db.update(schema.listings).set({ withdrawnAt: new Date(), withdrawnReason: "false claim" }).where(eq(schema.listings.id, s.two.id));
  const after = await walletPoints(db, ALICE);
  assert.deepEqual([after.points.environment, after.points.education, after.points.animal_welfare], [0, 0, 1.18188]);
  assert.equal((await walletHoldings(db, ALICE))[0].withdrawn, true);
});

test("rebuild: empty the record, read the chain again, the result is the same", async () => {
  const { db } = await createTestDb();
  const s = await seed(db);
  const chain = new FakeChain(story(), 6_000);
  await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  const before = { events: await eventsOf(db), holdings: await holdingsOf(db), points: (await walletPoints(db, ALICE)).points };
  await clearRecord(db);
  assert.equal((await eventsOf(db)).length, 0);
  assert.equal((await recordStatus(db, [CHAIN])).updatedAt, null);
  assert.equal((await db.select().from(schema.listings)).length, 2, "nothing outside the record is touched");
  assert.equal((await db.select().from(schema.impactSubmissions).where(eq(schema.impactSubmissions.id, s.twoSub.id))).length, 1);
  await syncChain(db, CHAIN, chain, { retryDelayMs: 0 });
  assert.deepEqual({ events: await eventsOf(db), holdings: await holdingsOf(db), points: (await walletPoints(db, ALICE)).points }, before);
  // Recalculating holdings alone is also repeatable.
  const rows = await db.select().from(schema.holdings);
  await recomputeHoldings(db, CHAIN.chainId);
  assert.deepEqual(await db.select().from(schema.holdings), rows);
});

test("the job writes only its own three tables", async () => {
  const { db } = await createTestDb();
  await seed(db);
  const counts = async () => (await db.execute(sql`select (select count(*) from listings)::int as l, (select count(*) from impact_submissions)::int as s, (select count(*) from organizations)::int as o, (select count(*) from users)::int as u, (select count(first_sale_at) from listings)::int as fs`) as unknown as { rows: unknown[] }).rows[0];
  const before = await counts();
  await syncChain(db, CHAIN, new FakeChain(story(), 6_000), { retryDelayMs: 0 });
  assert.deepEqual(await counts(), before);
});

test("the contract list covers every contract the site sells on today, with the right generation", () => {
  for (const net of enabledNetworks()) {
    const chain = RECORDED_CHAINS.find((c) => c.chainId === net.chain.id);
    assert.ok(chain, `${net.key} is recorded`);
    const sale = chain.contracts.find((c) => c.role === "sale" && c.address === net.primarySale.toLowerCase());
    assert.ok(sale, `${net.key}: the sale contract in use is recorded`);
    assert.equal(sale.token, net.trwi.toLowerCase());
    assert.equal(tokenGeneration(net.chain.id, net.trwi), contractGenerationOf(net), `${net.key}: generation of the tRWI contract in use`);
    for (const c of chain.contracts) assert.match(c.address, /^0x[0-9a-f]{40}$/, "addresses are stored lowercase");
    assert.ok(chain.contracts.every((c) => chain.contracts.some((t) => t.role === "token" && t.address === c.token)), "every sale contract names a recorded tRWI contract");
  }
  assert.equal(tokenGeneration(421614, "0xA46C092D014D8Fc79712f566F5b96BDfa3Af53A5"), 4);
  assert.equal(tokenGeneration(421614, addr(1)), null);
});
