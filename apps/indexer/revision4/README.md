# Indexer for contract revision 4

Its own Ponder root, so the live indexer (`apps/indexer`, contract generation 3) keeps its build id and its
database schema until the switch. Not started anywhere yet.

Tables: `impact_token` (with partner, validator, proof level, methodology, transferable, resale shares, withdrawn),
`withdrawal`, `sale` (every payout), `resale_listing`, `resale` (every payout), `statement` (contribution
statements). No staking tables (REBAZ and staking are not part of the revision).

Switch, per network, after the owner's yes and the revision 4 deploy:
- env: `PONDER_CHAIN_ID`, `PONDER_RPC_URL`, `R4_TRWI_ADDRESS`, `R4_PRIMARY_SALE_ADDRESS`,
  `R4_MARKETPLACE_ADDRESS`, `R4_START_BLOCK` (deploy block of the timelock, the first contract of the run);
- a NEW database schema name, e.g. `indexer_arbsep_r4`;
- command: `pnpm --filter indexer start:revision4 --schema indexer_arbsep_r4`.

Regenerate `src/abis.ts` after a contract change: `forge build && node scripts/export-abis.mjs` in
`packages/contracts`, then rerun the extraction (events of TRWIV4, RegenPrimarySaleV3 `Sold`,
RegenMarketplaceV2 `Listed`/`Purchased`/`Cancelled`).
