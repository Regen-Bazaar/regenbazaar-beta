<p align="center"><img src="docs/submission-images/logo-512.png" width="80" alt="Regen Bazaar"></p>
<h1 align="center">Regen Bazaar</h1>
<p align="center"><b>Buy verified real-world impact on-chain, paid in USDG, with provenance anyone can check.</b></p>
<p align="center">
  <a href="https://app.regenbazaar.com"><b>Try it</b></a> ·
  <a href="docs/ARCHITECTURE.md">How it works</a> ·
  <a href="packages/contracts/deployments">Contracts</a> ·
  <a href="https://app.regenbazaar.com/roadmap">Roadmap</a>
</p>
<p align="center"><img src="docs/submission-images/2-marketplace.png" width="820" alt="Regen Bazaar marketplace with tRWI cards"></p>

> Public beta on testnets. The same v3 contracts run on **Celo Sepolia** (where Regen Bazaar started),
> **Arbitrum Sepolia** and **Robinhood Chain testnet**, and the site's network switcher offers all three. Each impact
> report is listed on one network only, the one chosen when it was submitted.
> Impact Value is Regen Bazaar's own relative index (methodology v0.2, Community layer), not a certification. No real money.

Marketplace for **tokenized real-world impact (tRWI)**, impact that has already happened. Creators (NGOs,
informal groups or individuals) across the full impact spectrum (environment, animal welfare, education,
poverty, social, health) report work they have done, a custom AI engine scores it, a validator checks the
proof, it's tokenized on-chain, and buyers (people, companies **and** AI agents) buy editions. Each purchase
pays the creator directly, in the same transaction. Product backbone: **Work → Evaluate → Tokenize → Buy**.
This is how more impact gets funded: indirectly, after the result, because a creator who can sell finished
impact has a reason and the means to do more. It is not a donation platform and it does not pre-fund projects.
Reuse-first: battle-tested ReFi/OSS primitives where possible; custom only where it's the moat: the AI
Impact-Value engine.

- **Live:** https://app.regenbazaar.com serves three test networks; the visitor picks one (cookie). Contracts in
  `packages/contracts/deployments/{arbitrum-sepolia,robinhood-testnet,celo-sepolia}.json`, source-verified on
  Blockscout. Celo Sepolia, the original network, is paid in native CELO.
- **One report, one network:** a report is attested and listed only on the network selected when it was
  submitted, so the same impact is never sold on two chains.
- **Payment:** Paxos USDG on Robinhood Chain testnet. On Arbitrum Sepolia, Paxos USDG is allowlisted but the
  demo sells in `tUSDG`, a labelled testnet stand-in with the same interface, because the Paxos testnet faucet
  is not dispensing there.
- **Flow:** submit → verify → EAS-attest + IPFS → buyer redeems a platform-signed voucher (ERC-20 approve +
  redeem) → lazy mint → indexed (Ponder). Audience: non-crypto users (embedded wallets, gasless: later phase).

## Layout
```
apps/
  web/        Next.js 15 app: tokenize, verify, dashboard, marketplace, leaderboard, methodology,
              + APIs (/api/submissions, /api/verifications, public /api/impact for AI agents).
  indexer/    Ponder on-chain event indexer → Postgres (one per network; Arbitrum Sepolia and Robinhood live).
packages/
  impact-engine/  ★ The moat. Deterministic, versioned Impact-Value scoring (no dependencies).
  pipeline/       submit → extract (DeepSeek LLM) → score → persist. Rule-based fallback.
  db/             Drizzle schema + migrations; PGlite (dev) / postgres-js (prod) + migration runner.
  contracts/      Foundry: $REBAZ (ERC20), tRWI (ERC1155 UUPS, fractional editions), staking,
                  RegenPrimarySale (voucher sale, partner share in v2), RegenMarketplace (resale),
                  EAS attester resolver, deploy scripts.
deploy/       Dockerfile + isolated compose (web, postgres, ipfs, indexers) + nginx + runbook; live on a shared VPS.
docs/         POSITIONING.md · ARCHITECTURE.md · DECISIONS.md · KNOWN_ISSUES.md · methodology/.
```

## Architecture
- **Chain = source of truth** for ownership/sales/stakes (indexed into Postgres). **Postgres** = off-chain
  data (profiles, submissions, verification queue, AI outputs) + the on-chain read-cache.
- **AI Impact-Value engine** (custom): LLM extraction of the creator's free text → deterministic, versioned,
  auditable scoring (methodology v0.2): `domain score = Σ units × AW × SM × ESM × S`, `IV = Σ domain score × k`.
  Quantities are converted to physical units first; every weight has a justification card with its source
  (`docs/methodology/`). The LLM never scores; a validator sets the proof level (P0–P4) and confirms before
  mint. Reports scored before v0.2 keep their v0.1 score. Methodology is published in-app at `/methodology`.
- **tRWI** = ERC-1155 with fractional editions (Impact Value split across editions; retire to record your contribution),
  EAS-attestation-gated mint, ERC-2981 royalties.
- **Onboarding** (later): ERC-4337 smart accounts + gasless paymaster (EntryPoint v0.6/0.7/0.8 live on Celo Sepolia).
- **Storage** (later): Cloudflare R2 + CDN primary, self-hosted IPFS (kubo) backup.

## Deployed (v3, testnets)
Source-verified on Blockscout on all three networks.
Full records, including proof transactions: `packages/contracts/deployments/*.json`. Design:
`docs/SMART_CONTRACT_DESIGN.md`.

**Money split on a primary sale** (RegenPrimarySale v2, all three testnets since 2026-10-06): 2.5% platform fee,
an optional partner share when the impact came through a partner (fixed per partner; at most 10%, and at most 15%
together with the platform fee), and the rest to the creator, all in one transaction. Resale goes through
RegenMarketplace: 2.5% marketplace fee plus a creator royalty (2.5% for collections first minted from
2026-10-07, 5% for older ones); a 2.5% partner share on resale is planned and needs a new marketplace version.

**Sale contract (RegenPrimarySale v2, partner share), a separate address on each network:**

| Network | RegenPrimarySale v2 |
|---|---|
| Arbitrum Sepolia | `0xf405669244d45E1C9d65C4af059921Dde76493F4` |
| Robinhood Chain testnet | `0x7E8bE9B2278EF55c3C05316035d0F9BA35757FCf` |
| Celo Sepolia | `0x02f8F96aDFCBF07b4D028318eBD76bf8e4D24f76` |

The v1 sale contracts no longer have mint rights on TRWI (revoked 2026-10-06).

**Other v3 contracts on Arbitrum Sepolia (421614) and Robinhood Chain testnet (46630):** same deployer and nonce
sequence, so these addresses are identical on both chains (deployed 2026-09-24).

| Contract | Address |
|---|---|
| TRWI (ERC-1155, UUPS proxy) | `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` |
| RegenMarketplace (secondary escrow) | `0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214` |
| TRWIStaking | `0xB051e3B360A54e6E4808A2A06bEC765D246612B6` |
| REBAZ | `0x5Ea6AE9758472733144Eb24CCE7f310B21367b92` |
| EAS / SchemaRegistry / Resolver | `0x95cD…d95d` / `0xa5dB…40b4` / `0xA4B1…abB1` |
| Paxos USDG (payment) | Arbitrum Sepolia `0xFFC9…1892` · Robinhood `0x7E95…802F` |
| RegenPrimarySale v1 (retired, no mint rights) | `0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030` |

Example purchase in Paxos USDG on Robinhood Chain testnet, through the v1 sale contract (97.5% to the creator in
the same transaction):
[`0xea4a18d2…`](https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77)

**Celo Sepolia (11142220), the original network:** same v3 contracts at different addresses (`deployments/celo-sepolia.json`), with
purchases made through the app in June 2026, e.g.
[`0xce901fd1…`](https://celo-sepolia.blockscout.com/tx/0xce901fd12fceb8f166ddd585f96b5baa1c91e64864608b1c0d5f869bd79b1273),
and back in the site's network switcher since September 2026, e.g.
[`0xaf444006…`](https://celo-sepolia.blockscout.com/tx/0xaf444006452c3b3c3ff8d5981819b7516d54b8024cf7b2b1e87584266d10d28a).

Flow (proven live): approve → EAS-attest + IPFS + register listing (no mint) → buyer redeems a platform-signed
voucher → lazy mint + fee / partner / creator split → indexer. Secondary via the escrow marketplace.

## History
Built on Celo first: 2025 litepaper and demo MVP, contract prototypes on Stellar, Starknet and Move, Gitcoin GG23,
Celo Proof of Ship Season 4 (contracts on Alfajores, Next.js frontend). Rebuilt from scratch in June 2026 on Celo
Sepolia (v1 → v2 → hardened v3), then extended to Arbitrum Sepolia and Robinhood Chain testnet in September 2026.
Timeline with links: [github.com/Regen-Bazaar](https://github.com/Regen-Bazaar).

## Toolchain
pnpm workspaces · Next.js 15 / React 19 / Tailwind 4 · Foundry (Solidity 0.8.29) · Drizzle · PGlite · Ponder.
Local development needs **no Docker** (in-process PGlite + Foundry + Node/tsx).

## Run
```bash
pnpm install
pnpm web:dev            # http://localhost:3000, in-process PGlite, auto-seeded demo data
```

## Test
```bash
bash packages/contracts/scripts/install-deps.sh   # one-time: fetch pinned Foundry deps into lib/
pnpm contracts:test                        # Foundry: 61 tests
pnpm --filter @rb/impact-engine test       # 12
pnpm --filter @rb/db test                  # 1
pnpm --filter @rb/pipeline test            # 4
pnpm web:build                             # production build
```

## Configuration
Secrets live only in `.env` (never committed); see each package's `.env.example`.
- `DEEPSEEK_API_KEY` (web): optional; without it, extraction uses the deterministic rule-based fallback.
- `DATABASE_URL` (web): set to use Postgres; omit locally for the in-process dev DB.

See `docs/ARCHITECTURE.md` for a plain-language overview and `docs/KNOWN_ISSUES.md` for current limitations.
