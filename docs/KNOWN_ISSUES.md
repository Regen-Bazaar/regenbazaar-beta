# Known issues & technical debt

Things that work but are brittle, edge cases not yet handled, and debt taken on knowingly.

## Dev schema snapshot can drift from migrations
- `apps/web/src/lib/dev-schema.ts` is a hand-maintained SQL snapshot used by the local PGlite dev DB.
  The production path uses real Drizzle migrations (`packages/db/migrations`). If you change the schema in
  `packages/db/src/schema.ts`, you must update **both** the migration (via `pnpm db:generate`) and the dev
  snapshot, or dev and prod diverge.
- _Better fix later:_ apply the real migrations to PGlite in dev too (the test helper already does this),
  removing the hand-maintained snapshot.

## IV reference tables are seed values, not certified
- Weights and multipliers in `impact-engine/src/tables.ts` are placeholders spanning the full spectrum.
  They are explicitly labelled "platform-assessed, not third-party certified" in the UI and methodology.
- Must be calibrated with domain experts before any "certified" claim or real-money use.

## Rule-based extractor is best-effort
- The deterministic keyword parser (`extract.ts`) covers common phrasings only; ambiguous or unusual
  wording may be missed or mis-bucketed. The DeepSeek LLM path is the canonical extractor; rule-based is
  the no-API-key fallback. Quantities are read but units/synonyms are limited.

## On-chain layer is built but not wired to the app
- Contracts compile and pass tests (Foundry, 26 tests) but are **not deployed**. The web app's tokenize /
  marketplace "Fund" actions are UI-level until a funded deployer key lets us deploy to Celo Sepolia and
  connect the front end. Tokenized/verified status in the demo comes from seeded DB rows, not real chain state.

## Deploy artifacts are unvalidated
- `deploy/` (Dockerfile, compose, nginx, runbook) is code-ready but has **not been built on a Docker host**
  (no local Docker daemon). Expect first-deploy iteration: standalone tracing for the pnpm monorepo, the
  one-shot migrate service, and the nginx subdomain/TLS wiring should be verified on the VPS.

## No authentication yet
- There is no wallet/SIWE or embedded-wallet login. Submissions are attributed to a demo NGO
  (`getDemoOrgId`). Onboarding (Privy/thirdweb embedded, gasless) is a later phase.

## Indexer not yet present
- Leaderboard and marketplace read the off-chain DB. Once contracts are live, an indexer (Ponder) should
  feed on-chain events (mint/list/sale/stake) into Postgres so these views reflect chain truth.

## Buyer dashboard / purchases absent
- There is no buyer-side dashboard because purchases require the on-chain marketplace, which is pending.

## Contract dependencies are fetched, not vendored
- `packages/contracts/lib/` (OpenZeppelin, EAS, forge-std) is git-ignored, not committed and not a git
  submodule. A fresh clone must run `bash packages/contracts/scripts/install-deps.sh` before building
  contracts (CI does this). forge-std is pinned to v1.9.6 in that script; the local working copy is
  1.16.1 — standard cheatcodes are stable across both, but bump the pin if a newer cheatcode is needed.

## Operational reminders
- Rotate the GitHub `admin:org` token used during earlier org operations (it appeared in chat).
- Secrets (DeepSeek, deployer, DB) live only in server env / local `.env` files, never committed.
- The next version-control step is pushing this monorepo to a GitHub repo (name/visibility TBD by owner).
