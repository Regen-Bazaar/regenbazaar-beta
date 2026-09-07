# `apps/web` — Regen Bazaar beta dApp

Next.js 15 App Router frontend and API for the beta. Project overview, architecture and
runbook live in the [repository README](../../README.md) and [`docs/`](../../docs).

## What runs here

- **Pages** — tokenize, verify, dashboard, marketplace, leaderboard, methodology.
- **APIs** — `/api/submissions`, `/api/verifications`, and a public `/api/impact` intended
  for AI agents to read.
- **Onchain** — voucher signing (EIP-712) and EAS attestation via `src/lib/onchain.ts`.
  The operator key is read from the environment and is never committed.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind · wagmi + viem · Drizzle ORM
(PGlite in dev, postgres-js in prod) · TanStack Query · Sentry.

Workspace packages: `@rb/impact-engine` (deterministic Impact-Value scoring),
`@rb/pipeline` (submit → extract → score → persist), `@rb/db` (schema and migrations).

## Local setup

```bash
pnpm install
cp .env.example .env.local   # fill in, never commit .env.local
pnpm --filter web dev        # http://localhost:3000
```

Network for the beta is Celo Sepolia (chainId 11142220). Contract addresses and the
EAS schema UID are in [`packages/contracts/deployments/celo-sepolia.json`](../../packages/contracts/deployments/celo-sepolia.json).

## Related

- [Regen Bazaar](https://www.regenbazaar.com) — marketing site
- [EcoSynthesisX](https://www.ecosynthesisx.com/) — the DAO behind the project
