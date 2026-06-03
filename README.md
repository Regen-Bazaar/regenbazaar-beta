# Regen Bazaar — beta dApp (monorepo)

Marketplace for **tokenized real-world impact (tRWI)**: NGOs across the full impact spectrum
(environment, animal welfare, education, poverty, social) capture impact, it's scored by a custom
AI engine, tokenized on-chain, then funded by buyers. Product backbone: **Work → Tokenize →
Evaluate → Fund**. Reuse-first: battle-tested ReFi/OSS primitives where possible; custom only where
it's our moat (the AI Impact-Value engine and the $REBAZ token).

> Beta target network: **Celo Sepolia** (chainId 11142220). Audience: non-crypto users (embedded /
> account-abstraction wallets, gasless). Status: early build.

## Layout

```
apps/
  web/        Next.js 15 app (App Router). Seeded from the old `dapp` repo, UI being rebuilt.
  indexer/    On-chain event indexer (Ponder/Envio) → Postgres. (to add)
packages/
  contracts/  Foundry project: $REBAZ token, ERC1155 tRWI + staking, deploy scripts
              (self-deployed EAS + Hypercerts on Celo Sepolia). (in progress)
  db/         Drizzle schema + migrations (Postgres). (to add)
```

## Architecture (target)
- **Chain = source of truth** for ownership/sales/stakes. **Postgres** = indexed read-cache + off-chain
  data (profiles, drafts, AI outputs, verification queue), written by the indexer.
- **tRWI** = ERC-1155 (Hypercerts-compatible metadata), transferable, rich machine-readable attributes
  (SDG / IRIS+ / EBF tags, quantity, geo, dates, EAS attestation UID) + image → human + AI-agent buyers.
- **AI Impact-Value engine** (custom): LLM extraction of NGO free-text → deterministic, versioned,
  auditable scoring (`IV = Σ(AW·SM·TBV·ESM·PIM·ACDM)`). LLM never scores; human confirms before mint.
- **Onboarding**: ERC-4337 smart accounts + gasless paymaster (EntryPoint v0.6/0.7/0.8 live on Celo Sepolia).
- **Verification**: EAS attestations (admin/AI-assisted in beta; decentralized validators later).
- **Marketplace / staking / funding**: reuse thirdweb Marketplace V3, $REBAZ staking; Allo QF later.
- **Storage**: Cloudflare R2 + CDN primary, self-hosted IPFS (kubo) backup, multi-gateway fallback.

## Toolchain
pnpm workspaces · Next.js 15 / React 19 / Tailwind · Foundry (Solidity) · Drizzle · Ponder.

## Dev
```bash
pnpm install
pnpm contracts:build && pnpm contracts:test
pnpm web:dev
```

Secrets live only in `.env` (never committed); see each package's `.env.example`.
Full plan: `~/.claude/plans/sprightly-twirling-crayon.md`.
