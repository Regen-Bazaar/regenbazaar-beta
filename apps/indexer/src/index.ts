// Event handlers. Verify `ponder:registry` / db API against your installed Ponder version (see README).
import { ponder } from "ponder:registry";
import { impactToken, stake } from "../ponder.schema";

// tRWI minted: a verified impact became a token with fractional editions.
ponder.on("TRWI:ImpactTokenized", async ({ event, context }) => {
  await context.db.insert(impactToken).values({
    id: event.args.id,
    creator: event.args.creator,
    totalIV: event.args.totalIV,
    editions: event.args.editions,
    easUID: event.args.easUID,
    uri: event.args.uri,
    ivRetired: 0n,
    createdAt: event.block.timestamp,
  });
});

// Editions retired to claim the offset: accumulate retired IV.
ponder.on("TRWI:ImpactRetired", async ({ event, context }) => {
  await context.db
    .update(impactToken, { id: event.args.id })
    .set((row) => ({ ivRetired: row.ivRetired + event.args.ivRetired }));
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
    rewardClaimed: 0n,
    active: true,
  });
});

ponder.on("TRWIStaking:Claimed", async ({ event, context }) => {
  await context.db
    .update(stake, { id: event.args.stakeId })
    .set((row) => ({ rewardClaimed: row.rewardClaimed + event.args.reward }));
});

ponder.on("TRWIStaking:Unstaked", async ({ event, context }) => {
  await context.db.update(stake, { id: event.args.stakeId }).set({ active: false });
});
