# Known issues & technical debt

Things that work but are brittle, edge cases not yet handled, and debt taken on knowingly.

## Dev schema snapshot is a separate code path (now guarded)
- The local PGlite dev DB applies an inline SQL snapshot (`@rb/db` `dev-schema`) instead of the real
  Drizzle migrations (to keep the migrations folder out of the web bundle). If you change
  `packages/db/src/schema.ts`, update **both** the migration (`pnpm db:generate`) and `src/dev-schema.ts`.
- This is now guarded: `packages/db` `dev-schema-drift` test introspects both schemas and fails if they
  diverge. So drift is caught by CI rather than discovered at runtime.
- _Better fix later:_ apply the real migrations to PGlite in dev too, removing the snapshot entirely.

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

## Dependency audit status
- The HIGH advisory (drizzle-orm SQL injection via SQL identifiers, GHSA-gpj5-g38j-94v9) is **fixed** —
  drizzle-orm bumped to ^0.45.2 across `@rb/db` and `apps/web`; all tests green on the new version.
- Remaining `pnpm audit` findings are **moderate, dev/build-tooling only** (esbuild dev-server, postcss
  build-time stringify) — pulled transitively via Next/tailwind, not reachable in the production runtime.
  Accepted for beta; revisit on a Next/Tailwind bump.

## On-chain / deploy (round 7)
- **Public RPC is rate-limited.** The indexer + app use `forno.celo-sepolia.celo-testnet.org` (Ponder
  warns). Use a provider RPC (Alchemy/dRPC/Infura) for production throughput.
- **IPFS resolvability.** Metadata is pinned to a self-hosted kubo node; external readers (wallets/explorers)
  resolve it only via our read gateway or the DHT. For broad reach, add a pinning service (Pinata/web3.storage)
  later — the token's `ipfs://<cid>` does not change.
- **Operator is a hot key.** The web server signs attest/mint with the operator key (= deployer for beta).
  Use a dedicated operator key and keep admin offline; rotate + multisig before mainnet.
- **Marketplace buy + non-crypto onboarding not built.** "Fund" needs thirdweb Marketplace V3 + an
  embedded-wallet onboarding provider (client IDs pending from owner).
- **Deploy artifacts not Docker-validated.** `deploy/` (compose: web+migrate+ipfs+indexer+postgres) is
  code-ready but unrun on a Docker host; expect first-deploy iteration on the VPS.
- **Ponder reads `.env.local`** (not `.env`); contract addresses + start blocks must be set there (or in the
  process env) or it syncs from block 0.

## Hardening pass (mainnet-readiness) — follow-ups (see `docs/AUDIT.md`)
- **Redeploy required, not done.** The fixes change immutable contracts (and TRWIStaking storage layout), so
  the currently-deployed Celo Sepolia set is now stale. A fresh split-role redeploy is prepared in
  `Deploy.s.sol` but **gated on explicit approval** — not broadcast.
- **Voucher typehash changed (`feeBps` added).** Until the off-chain signer + frontend EIP-712 types are
  updated in lockstep with the new deployment, `redeem` will revert `BadSignature`. Exact files listed in
  `docs/AUDIT.md` (`apps/web/src/lib/onchain.ts`, `.../listings/[id]/voucher/route.ts`, `BuyButton.tsx`,
  `apps/indexer/src/abis.ts`). The live frontend was intentionally left pointing at the old contracts.
- **Emissions still mint-on-claim (now capped).** REBAZ has a hard cap, but staking still mints rewards on
  demand; once the cap is hit, normal `claim`/`unstake` revert (principal still exits via `emergencyUnstake`).
  A funded-reserve emission model is the intended longer-term replacement.
- **Multisig + timelock are config, not yet provisioned.** Role separation is supported by the deploy script
  but a Gnosis Safe (admin) and an OZ `TimelockController` for sensitive setters still need to be created and
  passed via env before the mainnet deploy.
- **Branch coverage gaps.** Line coverage on changed contracts is ~80–87% and the security-critical paths
  (pause/exit, royalty cap, RoyaltyTooHigh, currency-allowlist toggle, emergency exit, non-retroactive rate)
  have direct tests (61 total). Remaining gaps are branch-level (some revert/edge branches, the deploy-script
  multisig-handoff path). Add full branch coverage + a fork test of the real deploy before mainnet.

## Operational reminders
- Rotate the GitHub `admin:org` token used during earlier org operations (it appeared in chat).
- Secrets (DeepSeek, deployer, DB) live only in server env / local `.env` files, never committed.
- The next version-control step is pushing this monorepo to a GitHub repo (name/visibility TBD by owner).
