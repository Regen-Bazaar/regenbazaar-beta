// Event handlers (v2). Verify ponder:registry / db API against your installed Ponder version.
import { ponder } from "ponder:registry";
import { impactToken, sale, stake } from "../ponder.schema";

// A collection is registered on its first lazy mint (CollectionRegistered precedes ImpactMinted in-tx).
ponder.on("TRWI:CollectionRegistered", async ({ event, context }) => {
  await context.db.insert(impactToken).values({
    id: event.args.tokenId,
    creator: event.args.creator,
    totalIV: event.args.totalIV,
    maxEditions: event.args.maxEditions,
    minted: 0n,
    retired: 0n,
    easUID: event.args.easUID,
    uri: event.args.uri,
    createdAt: event.block.timestamp,
  });
});

ponder.on("TRWI:ImpactMinted", async ({ event, context }) => {
  await context.db.update(impactToken, { id: event.args.tokenId }).set((row) => ({ minted: row.minted + event.args.amount }));
});

ponder.on("TRWI:ImpactRetired", async ({ event, context }) => {
  await context.db.update(impactToken, { id: event.args.tokenId }).set((row) => ({ retired: row.retired + event.args.amount }));
});

ponder.on("RegenPrimarySale:Sold", async ({ event, context }) => {
  await context.db.insert(sale).values({
    id: `${event.args.tokenId}-${event.transaction.hash}-${event.log.logIndex}`,
    tokenId: event.args.tokenId,
    buyer: event.args.buyer,
    amount: event.args.amount,
    total: event.args.total,
    currency: event.args.currency,
    ts: event.block.timestamp,
  });
});

ponder.on("TRWIStaking:Staked", async ({ event, context }) => {
  await context.db.insert(stake).values({
    id: event.args.stakeId,
    owner: event.args.owner,
    tokenId: event.args.tokenId,
    amount: event.args.amount,
    ivStaked: event.args.ivStaked,
    lockEnd: event.args.lockEnd,
    multiplierBps: event.args.multiplierBps,
    active: true,
  });
});

ponder.on("TRWIStaking:Unstaked", async ({ event, context }) => {
  await context.db.update(stake, { id: event.args.stakeId }).set({ active: false });
});
