// Purchase record job, command line (runs in the `recorder` container; needs DATABASE_URL).
//   node --import tsx scripts/purchase-record.ts loop            keep the record current (every RECORD_INTERVAL_SECONDS, default 60)
//   node --import tsx scripts/purchase-record.ts sync            read every network up to now, once (also the first backfill)
//   node --import tsx scripts/purchase-record.ts status          rows per network and kind, last block read
//   node --import tsx scripts/purchase-record.ts wallet 0x...    points, holdings and history of one wallet
//   node --import tsx scripts/purchase-record.ts rebuild --yes   empty the record and read it again from the chain
import { sql } from "drizzle-orm";
import { createPostgresDb } from "@rb/db";
import { syncAll, clearRecord, type ChainSyncResult } from "../src/lib/purchase-record/sync.ts";
import { purchaseHistory, recordStatus, walletHoldings, walletPoints } from "../src/lib/purchase-record/read.ts";

const [cmd, ...args] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const { db, client } = createPostgresDb(url);
const print = (x: unknown) => console.log(JSON.stringify(x, null, 2));
const line = (x: unknown) => console.log(JSON.stringify(x));

async function status() {
  const kinds = await db.execute(sql`select chain_id, kind, count(*)::int as events, coalesce(sum(amount), 0)::text as editions from edition_events group by 1, 2 order by 1, 2`);
  const held = await db.execute(sql`select chain_id, count(*)::int as rows, count(distinct wallet)::int as wallets, coalesce(sum(editions_held), 0)::text as held, coalesce(sum(editions_retired), 0)::text as retired, max(updated_at) as last_change from holdings group by 1 order by 1`);
  print({ status: await recordStatus(db), events: [...(kinds as unknown as unknown[])], holdings: [...(held as unknown as unknown[])] });
}

let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

async function loop() {
  const every = Math.max(30, Number(process.env.RECORD_INTERVAL_SECONDS ?? 60)) * 1000;
  line({ at: new Date().toISOString(), msg: "purchase record job started", everySeconds: every / 1000 });
  let quietRuns = 0;
  while (!stopping) {
    // One run never takes longer than five intervals; what it has read by then is kept.
    const results = await syncAll(db, { deadline: Date.now() + every * 5 }).catch((e) => [{ error: String(e).slice(0, 300) } as Partial<ChainSyncResult>]);
    const notable = results.some((r) => r.error || (r.inserted ?? 0) > 0 || !r.caughtUp);
    quietRuns = notable ? 0 : quietRuns + 1;
    // A line when something happened, and one heartbeat an hour otherwise.
    if (notable || quietRuns % Math.max(1, Math.round(3_600_000 / every)) === 1) line({ at: new Date().toISOString(), results });
    for (let waited = 0; waited < every && !stopping; waited += 1000) await new Promise((r) => setTimeout(r, 1000));
  }
}

try {
  if (cmd === "loop") {
    await loop();
  } else if (cmd === "sync") {
    const results = await syncAll(db);
    print(results);
    if (results.some((r) => r.error)) process.exitCode = 1;
  } else if (cmd === "status") {
    await status();
  } else if (cmd === "wallet" && args[0]) {
    print({
      points: await walletPoints(db, args[0]),
      holdings: await walletHoldings(db, args[0], { includeUnlisted: true }),
      history: await purchaseHistory(db, args[0], { includeUnlisted: true }),
    });
  } else if (cmd === "rebuild" && args.includes("--yes")) {
    await clearRecord(db);
    const results = await syncAll(db);
    print(results);
    if (results.some((r) => r.error)) process.exitCode = 1;
  } else {
    console.error("usage: purchase-record.ts loop | sync | status | wallet <address> | rebuild --yes");
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
