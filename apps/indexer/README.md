# Regen Bazaar indexer (Ponder) — scaffold

Indexes on-chain events (tRWI mints/retires, staking) from **Celo Sepolia** into Postgres, so the web
app's marketplace / leaderboard / dashboards read chain truth instead of off-chain rows.

> **Status: scaffold (template), not yet active.** It activates after the contracts are deployed and
> their addresses + start blocks are known. It is intentionally NOT a pnpm workspace member yet (no
> `package.json`) so it does not affect the validated web build / Docker frozen install.

## Activate (after contract deploy)
1. `mv package.json.template package.json`
2. `pnpm add ponder viem` (in this directory) — pins the Ponder version; verify the API below matches it.
3. Build contract ABIs: `pnpm contracts:build` (root), then replace the event fragments in `src/abis.ts`
   with the full `.abi` arrays from `packages/contracts/out/TRWI.sol/TRWI.json` and `…/TRWIStaking.sol/TRWIStaking.json`.
4. Fill `.env` from `.env.example`: RPC URL, deployed addresses, start blocks, the same `DATABASE_URL`
   the web app uses (shared Postgres).
5. `pnpm dev` (local) or `pnpm start` (prod). Add `regenbazaar_indexer` as a service in `deploy/docker-compose.yml`.

## What it tracks
- `TRWI.ImpactTokenized` → `impact_token` rows (creator, total IV, editions, EAS UID, URI).
- `TRWI.ImpactRetired` → accumulates retired IV per token.
- `TRWIStaking.Staked` / `Claimed` / `Unstaked` → `stake` rows (owner, amount, IV staked, rewards, active).

The web app then queries these tables (read-only) for leaderboard/marketplace/holdings.

## Files
- `ponder.config.ts` — network (Celo Sepolia, 11142220) + contracts (address/abi/startBlock from env).
- `ponder.schema.ts` — Postgres tables Ponder manages.
- `src/index.ts` — event handlers.
- `src/abis.ts` — event ABIs (replace placeholders with forge-built artifacts).
