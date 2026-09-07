# Regen Bazaar — beta dApp (monorepo)

Marketplace for **tokenized real-world impact (tRWI)**: NGOs across the full impact spectrum
(environment, animal welfare, education, poverty, social, health) report impact, a custom AI engine
scores it, a human verifies it, it's tokenized on-chain, then funded by buyers (people **and** AI
agents). Product backbone: **Work → Tokenize → Evaluate → Fund**. Reuse-first: battle-tested ReFi/OSS
primitives where possible; custom only where it's the moat — the AI Impact-Value engine and the
$REBAZ token.

> Beta target network: **Celo Sepolia** (chainId 11142220). Audience: non-crypto users (embedded /
> account-abstraction wallets, gasless — later phase).
> **Not currently hosted.** The demo ran on a VPS that has since been decommissioned, and
> `app.regenbazaar.com` was removed rather than left pointing at a machine we no longer control.
> The flow it proved is intact in this repository and runs locally: tokenize → verify →
> EAS-attest + IPFS → buyer redeems a platform-signed voucher → lazy mint → indexed, all on
> Celo Sepolia.

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

## Deployed (Celo Sepolia testnet, chainId 11142220) — v2 (platform-issued lazy mint)
Live and source-verified on Blockscout (`celo-sepolia.blockscout.com/address/<addr>`). Full record:
`packages/contracts/deployments/celo-sepolia.json`. Design: `docs/SMART_CONTRACT_DESIGN.md`.

| Contract | Address |
|---|---|
| TRWI (proxy) | `0x796B521EBF9221A0f4212C10767898AfCd81087d` |
| RegenPrimarySale (voucher lazy-mint) | `0x49A5a77e3DBd76411737820fd968142b6154be26` |
| RegenMarketplace (secondary escrow) | `0x09c0cbB98Dbb0E37B684abF33e7Beac7f62B4A21` |
| TRWIStaking | `0x35BcD5DCb8A82197eC268f6E97e3e32d816E8A9b` |
| REBAZ | `0xC367a4601D8e7D4f83DA5AFd549262886C33177F` |
| EAS / Resolver / SchemaRegistry | `0x317D…8Cf9` / `0x625f…6999` / `0x25aD…7534` |

ImpactClaim schemaUID `0x35151bab2b9912417175bbf5b49112d9828f4493811bf611f888c1cdd013e92a`.
Flow (proven live): approve → EAS-attest + IPFS + register listing (no mint) → buyer redeems a platform-signed
voucher → lazy mint + fee/NGO split → indexer. Secondary via the escrow marketplace.

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
