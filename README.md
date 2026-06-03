# Regen Bazaar — beta dApp (monorepo)

Marketplace for **tokenized real-world impact (tRWI)**: NGOs across the full impact spectrum
(environment, animal welfare, education, poverty, social, health) report impact, a custom AI engine
scores it, a human verifies it, it's tokenized on-chain, then funded by buyers (people **and** AI
agents). Product backbone: **Work → Tokenize → Evaluate → Fund**. Reuse-first: battle-tested ReFi/OSS
primitives where possible; custom only where it's the moat — the AI Impact-Value engine and the
$REBAZ token.

> Beta target network: **Celo Sepolia** (chainId 11142220). Audience: non-crypto users (embedded /
> account-abstraction wallets, gasless). Status: off-chain stack working locally; on-chain wiring and
> deploy are pending a funded deployer key.

## Layout
```
apps/
  web/        Next.js 15 app: tokenize, verify, dashboard, marketplace, leaderboard, methodology,
              + APIs (/api/submissions, /api/verifications, public /api/impact for AI agents).
  indexer/    Ponder on-chain event indexer → Postgres. Scaffold/template; activates after deploy.
packages/
  impact-engine/  ★ The moat. Deterministic, versioned Impact-Value scoring (no dependencies).
  pipeline/       submit → extract (DeepSeek LLM) → score → persist. Rule-based fallback.
  db/             Drizzle schema + migrations; PGlite (dev) / postgres-js (prod) + migration runner.
  contracts/      Foundry: $REBAZ (ERC20), tRWI (ERC1155 UUPS, fractional editions), staking,
                  EAS attester resolver, unified deploy script.
deploy/       Dockerfile + isolated compose + nginx + runbook for the VPS (code-ready).
docs/         ARCHITECTURE.md · DECISIONS.md · KNOWN_ISSUES.md.
```

## Architecture
- **Chain = source of truth** for ownership/sales/stakes (indexed into Postgres). **Postgres** = off-chain
  data (profiles, submissions, verification queue, AI outputs) + the on-chain read-cache.
- **AI Impact-Value engine** (custom): LLM extraction of NGO free text → deterministic, versioned,
  auditable scoring `IV = Σ(AW·SM·TBV·ESM·PIM·ACDM)`. The LLM never scores; a human confirms before mint.
  Methodology is published in-app at `/methodology`.
- **tRWI** = ERC-1155 with fractional editions (Impact Value split across editions; retire to claim offset),
  EAS-attestation-gated mint, ERC-2981 royalties.
- **Onboarding** (later): ERC-4337 smart accounts + gasless paymaster (EntryPoint v0.6/0.7/0.8 live on Celo Sepolia).
- **Storage** (later): Cloudflare R2 + CDN primary, self-hosted IPFS (kubo) backup.

## Deployed (Celo Sepolia testnet, chainId 11142220)
Core is live and source-verified on Blockscout (`celo-sepolia.blockscout.com/address/<addr>`). Full record:
`packages/contracts/deployments/celo-sepolia.json`.

| Contract | Address |
|---|---|
| TRWI (proxy) | `0xa511F92336d9DcBe62caEA46F82DcaFa82BC3E65` |
| TRWIStaking | `0x665C8964Be8cA3C1F429Aee75Ebe709FF67ef2C1` |
| REBAZ | `0x8e5F9e9E67688F75D4303a5395F78ff1E3B71975` |
| EAS | `0x142dFB78c9DFDb447Fad7e327B139Bb622c81c1c` |
| AuthorizedAttesterResolver | `0xabF828ea9CdF3c6cE95E97BC5E882b29880CeDc1` |
| SchemaRegistry | `0xd58120Aa88783867f6F29498754E399fd3033eDa` |

ImpactClaim schemaUID `0x836d37174fff1eb2e5a2af8d20d87a908283eec088e38cf21cedaaa9a2658633`. Roles wired
(REBAZ MINTER→staking; TRWI TOKENIZER + resolver ATTESTER→admin). App wiring (attest→mint) is next.

## Toolchain
pnpm workspaces · Next.js 15 / React 19 / Tailwind 4 · Foundry (Solidity 0.8.29) · Drizzle · PGlite · Ponder.
Local development needs **no Docker** (in-process PGlite + Foundry + Node/tsx).

## Run
```bash
pnpm install
pnpm web:dev            # http://localhost:3000 — in-process PGlite, auto-seeded demo data
```

## Test
```bash
bash packages/contracts/scripts/install-deps.sh   # one-time: fetch pinned Foundry deps into lib/
pnpm contracts:test                        # Foundry: 26 tests
pnpm --filter @rb/impact-engine test       # 12
pnpm --filter @rb/db test                  # 1
pnpm --filter @rb/pipeline test            # 4
pnpm web:build                             # production build
```

## Configuration
Secrets live only in `.env` (never committed); see each package's `.env.example`.
- `DEEPSEEK_API_KEY` (web) — optional; without it, extraction uses the deterministic rule-based fallback.
- `DATABASE_URL` (web) — set to use Postgres; omit locally for the in-process dev DB.

See `docs/ARCHITECTURE.md` for a plain-language overview and `docs/KNOWN_ISSUES.md` for current limitations.
