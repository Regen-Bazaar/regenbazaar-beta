// Event handlers for contract revision 4.
import { ponder } from "ponder:registry";
import { impactToken, withdrawal, sale, resaleListing, resale, statement } from "../ponder.schema";

ponder.on("TRWIV4:CollectionRegistered", async ({ event, context }) => {
  await context.db.insert(impactToken).values({
    id: event.args.tokenId,
    creator: event.args.creator,
    totalIV: event.args.totalIV,
    maxEditions: event.args.maxEditions,
    easUID: event.args.easUID,
    uri: event.args.uri,
    createdAt: event.block.timestamp,
  });
});

// Emitted right after CollectionRegistered in the same transaction.
ponder.on("TRWIV4:CollectionTerms", async ({ event, context }) => {
  await context.db.update(impactToken, { id: event.args.tokenId }).set({
    partner: event.args.partner,
    validator: event.args.validator,
    proofLevel: event.args.proofLevel,
    methodologyVersion: event.args.methodologyVersion,
    transferable: event.args.transferable,
    royaltyBps: Number(event.args.royaltyBps),
    resaleFeeBps: Number(event.args.resaleFeeBps),
    resalePartnerBps: Number(event.args.resalePartnerBps),
  });
});

ponder.on("TRWIV4:ImpactMinted", async ({ event, context }) => {
  await context.db.update(impactToken, { id: event.args.tokenId }).set((row) => ({ minted: row.minted + event.args.amount }));
});

ponder.on("TRWIV4:ContributionStatement", async ({ event, context }) => {
  await context.db.insert(statement).values({
    id: event.args.statementId,
    tokenId: event.args.tokenId,
    holder: event.args.holder,
    amount: event.args.amount,
    impactValue: event.args.impactValue,
    inNameOf: event.args.inNameOf,
    txHash: event.transaction.hash,
    ts: event.block.timestamp,
  });
  await context.db.update(impactToken, { id: event.args.tokenId }).set((row) => ({ retired: row.retired + event.args.amount }));
});

ponder.on("TRWIV4:ImpactWithdrawn", async ({ event, context }) => {
  await context.db
    .insert(withdrawal)
    .values({
      id: event.args.easUID,
      tokenId: event.args.tokenId,
      active: true,
      reasonURI: event.args.reasonURI,
      by: event.args.by,
      ts: event.block.timestamp,
    })
    .onConflictDoUpdate({ active: true, reasonURI: event.args.reasonURI, by: event.args.by, ts: event.block.timestamp });
  if (event.args.tokenId !== 0n) {
    await context.db.update(impactToken, { id: event.args.tokenId }).set({ withdrawn: true });
  }
});

ponder.on("TRWIV4:ImpactReinstated", async ({ event, context }) => {
  await context.db.update(withdrawal, { id: event.args.easUID }).set({ active: false, by: event.args.by, ts: event.block.timestamp });
  if (event.args.tokenId !== 0n) {
    await context.db.update(impactToken, { id: event.args.tokenId }).set({ withdrawn: false });
  }
});

ponder.on("RegenPrimarySaleV3:Sold", async ({ event, context }) => {
  const p = event.args.payout;
  await context.db.insert(sale).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    tokenId: event.args.tokenId,
    payer: event.args.payer,
    recipient: event.args.recipient,
    amount: event.args.amount,
    currency: event.args.currency,
    total: p.total,
    creatorPaid: p.creatorPaid,
    platformPaid: p.platformPaid,
    partnerPaid: p.partnerPaid,
    beneficiary: p.beneficiary,
    partner: p.partner,
    ts: event.block.timestamp,
  });
});

ponder.on("RegenMarketplaceV2:Listed", async ({ event, context }) => {
  await context.db.insert(resaleListing).values({
    id: event.args.listingId,
    seller: event.args.seller,
    tokenId: event.args.tokenId,
    remaining: event.args.amount,
    pricePerEdition: event.args.pricePerEdition,
    currency: event.args.currency,
    active: true,
    createdAt: event.block.timestamp,
  });
});

ponder.on("RegenMarketplaceV2:Purchased", async ({ event, context }) => {
  await context.db.insert(resale).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    listingId: event.args.listingId,
    tokenId: event.args.tokenId,
    buyer: event.args.buyer,
    amount: event.args.amount,
    currency: event.args.currency,
    total: event.args.total,
    sellerPaid: event.args.sellerPaid,
    creatorPaid: event.args.creatorPaid,
    platformPaid: event.args.platformPaid,
    partnerPaid: event.args.partnerPaid,
    ts: event.block.timestamp,
  });
  await context.db.update(resaleListing, { id: event.args.listingId }).set((row) => {
    const remaining = row.remaining - event.args.amount;
    return { remaining, active: remaining > 0n };
  });
});

ponder.on("RegenMarketplaceV2:Cancelled", async ({ event, context }) => {
  await context.db.update(resaleListing, { id: event.args.listingId }).set({ remaining: 0n, active: false });
});
