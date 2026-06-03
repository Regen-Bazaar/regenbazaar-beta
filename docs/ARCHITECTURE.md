# Regen Bazaar beta — Architecture

_Written for the project owner. You understand the business; this explains how the pieces fit, in plain language._

## 1. What this project does
Regen Bazaar turns **verified real-world impact** (an NGO planting trees, rescuing animals, teaching
children, feeding families) into a **tradable digital asset**. An organization describes what it did;
the platform scores that impact into a single comparable number (**Impact Value**), a human verifies it,
and it becomes a **tRWI** — a tokenized real-world impact that buyers (people or AI agents) can fund.

The product follows one cycle: **Work → Tokenize → Evaluate → Fund.**

## 2. The big picture (how a submission flows)
```
NGO writes a report (free text)
        │
        ▼
[ Extract ]  an LLM (DeepSeek) reads the text → a structured list of actions
        │     (falls back to keyword parsing if no API key)
        ▼
[ Score ]    a deterministic formula turns actions → Impact Value (IV)
        │     IV = Σ (AW × SM × TBV × ESM × PIM × ACDM)
        ▼
[ Store ]    saved to the database in status "pending_verification"
        │
        ▼
[ Verify ]   a human approves/rejects in the /verify queue
        │
        ▼
[ Tokenize ] (on-chain, gated on the deployer key) verified impact is attested
        │     via EAS and minted as a tRWI (ERC-1155 fractional editions)
        ▼
[ Fund ]     buyers fund it in the marketplace; NGOs rank on the leaderboard
```
**Key principle:** the LLM only *reads*; it never decides the score. The score is a pure, repeatable
formula, so the same report always yields the same number — and anyone can audit it.

## 3. Repository map
This is a **monorepo** (one repo, many packages) managed by pnpm.

```
regenbazaar-app/
├─ apps/
│  └─ web/                 The website + API (Next.js 15). Everything a user sees.
│     └─ src/app/          Pages: home, tokenize, dashboard, submission/[id],
│                          verify, marketplace, leaderboard, methodology.
│     └─ src/app/api/      Server endpoints: submissions, verifications, impact (for AI agents).
│     └─ src/lib/          DB connection, dev seed, dev schema snapshot.
│
├─ packages/
│  ├─ impact-engine/       ★ THE MOAT. The scoring brain. Pure, no dependencies.
│  │                       tables.ts = the weights; score.ts = the formula; extract.ts = parsing.
│  ├─ pipeline/            Glue: submit → extract → score → save. Holds the DeepSeek extractor.
│  ├─ db/                  Database shape (Drizzle) + migrations + the prod migration runner.
│  └─ contracts/           Smart contracts (Solidity/Foundry): REBAZ token, tRWI, staking, EAS resolver.
│
├─ deploy/                 Docker + nginx + runbook to ship onto the VPS (isolated).
└─ docs/                   This documentation.
```

## 4. Where data lives
- **Off-chain database (Postgres):** NGO profiles, submissions and their lifecycle, verification
  decisions, links to on-chain records. In **local development** this is an in-process database
  (PGlite — no Docker needed) that auto-seeds demo NGOs. In **production** it is a real Postgres
  container.
- **On-chain (Celo Sepolia testnet):** the source of truth for ownership, sales and staking — *once the
  contracts are deployed* (currently built and tested locally, not yet deployed; needs a funded key).
- **The chain is the source of truth** for who owns what; the database is a fast, queryable index and
  holds the off-chain pipeline.

## 5. External dependencies (and why)
- **DeepSeek** (LLM, OpenAI-compatible) — reads NGO free text into structured actions. Server-side only.
- **Celo Sepolia** — the testnet the contracts target (cheap, EVM, gasless-capable via ERC-4337).
- **EAS (Ethereum Attestation Service)** — signs an on-chain attestation that an impact was verified.
- **OpenZeppelin** — audited building blocks for the smart contracts.
- **Next.js / Drizzle / PGlite / Foundry** — the app framework, database layer, dev DB, and contract toolchain.

The reuse-first plan also names thirdweb, Privy, Hypercerts, Gitcoin Allo, etc. — those are integrated in
later phases, not yet wired.

## 6. Non-obvious decisions (so future-you isn't surprised)
- **The LLM never scores.** It only extracts; a deterministic formula scores. This is what makes IV
  auditable and hard to game. See `/methodology`.
- **No Docker needed for development.** The app runs on an in-process Postgres (PGlite). Docker is only
  for the production VPS deploy.
- **Reference tables are versioned** (`TABLES_VERSION`). Every score is stamped with the version that
  produced it, so old scores stay reproducible even when the tables change.
- **tRWI is ERC-1155 with fractional editions** — one verified impact can be split across many buyers
  without double-counting; buyers can "retire" editions to claim the offset.
- **Two DB code paths.** Dev uses an inline schema snapshot (`lib/dev-schema.ts`) for PGlite; prod uses
  real Drizzle migrations applied by `packages/db` `migrate`. They must stay in sync (see KNOWN_ISSUES).

## 7. Fragile areas — don't change without understanding first
- **`packages/impact-engine/src/tables.ts`** — changing existing weights silently changes everyone's
  scores. Add new actions freely; when you change existing values, bump `TABLES_VERSION`.
- **`apps/web/src/lib/dev-schema.ts`** — a hand-maintained snapshot of the schema for the dev DB. If you
  change the Drizzle schema, update this too (or dev breaks while prod is fine).
- **DeepSeek prompt in `packages/pipeline/src/extractor-deepseek.ts`** — it constrains the model to the
  engine's canonical action keys. If you rename keys in the table, the prompt follows automatically
  (it reads them), but custom phrasing tests should be re-run.
- **Secrets** — never commit `.env`. Keys live only in server environment. The browser never sees them.

## 8. What's done vs. pending
- **Done & tested locally:** the scoring engine, the database layer, the full submit→verify→marketplace
  →leaderboard flow, the DeepSeek extractor, the smart contracts (40 automated tests passing).
- **Built, not yet validated:** the Docker/nginx deploy artifacts (need a Docker host).
- **Pending (needs a funded deployer key + your "go"):** deploying contracts to Celo Sepolia, wiring the
  on-chain mint/marketplace, the blockchain indexer, embedded-wallet onboarding, and the actual VPS deploy.
