# Known issues & technical debt

Things that work but are brittle, edge cases not yet handled, and debt taken on knowingly.

## Dev schema snapshot is a separate code path (now guarded)
- The local PGlite dev DB applies an inline SQL snapshot (`@rb/db` `dev-schema`) instead of the real
  Drizzle migrations (to keep the migrations folder out of the web bundle). If you change
  `packages/db/src/schema.ts`, update **both** the migration (`pnpm db:generate`) and `src/dev-schema.ts`.
- This is now guarded: `packages/db` `dev-schema-drift` test introspects both schemas and fails if they
  diverge. So drift is caught by CI rather than discovered at runtime.
- _Better fix later:_ apply the real migrations to PGlite in dev too, removing the snapshot entirely.

## IV reference tables are Regen Bazaar's own index, not certified
- **Updated 2026-09-28:** new reports use the v0.2 tables (`impact-engine/src/tables-v02.ts`); every weight has a
  justification card with its source status (sourced, derived or assumption). The v0.1 seed tables (`tables.ts`)
  stay only so old reports recompute.
- Many v0.2 weights are still labelled assumptions (see the methodology v0.2 item below). Impact Value is labelled
  as Regen Bazaar's own index, not a certification, in the UI and methodology.
- Must be calibrated with domain experts before any "certified" claim or real-money use.

## Rule-based extractor is best-effort
- The deterministic keyword parser (`extract.ts`) covers common phrasings only; ambiguous or unusual
  wording may be missed or mis-bucketed. The DeepSeek LLM path is the canonical extractor; rule-based is
  the no-API-key fallback. Quantities are read but units/synonyms are limited.

## On-chain layer: three testnets, one site (resolved 2026-09)
- **Resolved:** "one network per build" is gone. One site, app.regenbazaar.com, serves Arbitrum Sepolia,
  Robinhood Chain testnet and Celo Sepolia with a network switcher in the header. All three run the v3 contracts
  and, since 2026-10-06, RegenPrimarySale v2. Listings are per chain (`listings.chain_id`); a report is listed on
  exactly one network.

## Deploy artifacts are unvalidated (resolved 2026-09)
- **Resolved:** `deploy/` runs on the shared VPS (Docker compose: web, migrate, postgres, ipfs, two Ponder
  indexers; nginx with TLS).

## No authentication yet (partly resolved)
- **Resolved:** submissions are no longer attributed to a demo NGO; each creator is a name plus payout wallet
  (see "Organisation profiles" below). Validator screens and APIs require a shared access code (`ADMIN_TOKEN`).
- **Still open:** no wallet/SIWE login for creators or buyers, and no personal validator accounts (on the
  roadmap). Gasless onboarding for non-crypto users is a later phase; thirdweb is not used.

## Indexer not yet present (resolved)
- **Resolved:** Ponder indexers run for Arbitrum Sepolia and Robinhood Chain testnet. Leaderboard and marketplace
  still read the off-chain DB (see "Indexers are per chain" below).

## Buyer dashboard / purchases absent (resolved)
- **Resolved:** purchases run through RegenPrimarySale; `/portfolio` shows the connected wallet's tRWI, read from
  the chain, with retire.

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
- **Resolved: marketplace buy.** Buying works through our own contracts (RegenPrimarySale, RegenMarketplace);
  thirdweb is not used. Non-crypto onboarding (embedded wallet, gasless) is still a later phase.
- **Resolved: deploy artifacts.** The compose stack runs on the VPS.
- **Ponder reads `.env.local`** (not `.env`); contract addresses + start blocks must be set there (or in the
  process env) or it syncs from block 0.

## Hardening pass (mainnet-readiness) — status (see `docs/AUDIT.md`)
- **DONE: v3 deployed + verified.** Audited contracts deployed to Celo Sepolia (addresses in
  `deployments/celo-sepolia.json`, startBlock 27285071), live-verified on-chain (deployer NOT a TRWI minter,
  REBAZ cap=1e27, e2e attest→feeBps-voucher→redeem→mint smoke), and source-verified on Blockscout. Off-chain
  signer + frontend EIP-712 updated with `feeBps` and pointed at v3. Branch merged to local `main`.
- **Superseded (2026-09):** the old HelpRent VPS 62.72.44.6 was decommissioned 2026-07-12; the app now runs on
  169.58.27.199 against the Arbitrum Sepolia deployment (see "Arbitrum buildathon deployment" below).
- **Resolved: push to remote.** The repo is on GitHub (`Regen-Bazaar/regenbazaar-beta`); changes go through PRs.
- **Emissions still mint-on-claim (now capped).** REBAZ has a hard cap, but staking still mints rewards on
  demand; once the cap is hit, normal `claim`/`unstake` revert (principal still exits via `emergencyUnstake`).
  A funded-reserve emission model is the intended longer-term replacement.
- **Multisig + timelock — needs a Safe address (not provisionable in code).** The deploy script supports
  role separation + an admin→multisig handoff via env (`ADMIN_MULTISIG`, `RENOUNCE_DEPLOYER_ADMIN`, etc.),
  but a Gnosis Safe and an OZ `TimelockController` must be created and their addresses supplied before mainnet.
- **Branch coverage gaps.** Line coverage on changed contracts is ~80–87% and the security-critical paths
  (pause/exit, royalty cap, RoyaltyTooHigh, currency-allowlist toggle, emergency exit, non-retroactive rate)
  have direct tests (61 total). Remaining gaps are branch-level (some revert/edge branches, the deploy-script
  multisig-handoff path). Add full branch coverage + a fork test of the real deploy before mainnet.

## Arbitrum buildathon deployment (2026-09)
- **Indexer schema must be bumped** (`INDEXER_SCHEMA` in `deploy/.env`) whenever contract addresses or indexer
  config change, or Ponder exits (now capped at 5 restarts instead of looping).
- **USDG is a Paxos testnet token**; buyers need testnet USDG (faucet.paxos.com, Arbitrum Sepolia) plus a
  little ETH for gas. Approve is for the exact amount (one approval per purchase).
- **Public RPC** (`sepolia-rollup.arbitrum.io`) is rate-limited; set `RPC_URL` in `deploy/.env` to a provider.
- **Two contracts are partial matches on Blockscout** (SchemaRegistry, ERC1967Proxy: metadata hash differs);
  sources are published and readable. All Arbitrum Sepolia contracts are also verified on Arbiscan.
- **Live at https://app.regenbazaar.com** (VPS 169.58.27.199, nginx `regenbazaar.conf`, Let's Encrypt via webroot,
  renew hook reloads nginx). Cloudflare record `app` is **DNS-only (not proxied)**: proxying would break the
  HTTP-01 webroot renewal unless the challenge path is also served on 443 or the cert moves to dns-cloudflare.
- **Resolved: `/api/verifications` auth.** Approve, reject, proof checks and partner changes require the shared
  validator access code (`ADMIN_TOKEN`, server env; unset means nobody has access). Personal validator accounts
  are still open.
- **Demo sells in tUSDG** (`SALE_CURRENCY=tUSDG`) because the Paxos testnet faucet stopped dispensing
  (no outgoing transfers from `0xcc96…70a3` after 2026-09-22). Real USDG is allowlisted; switch = unset
  `SALE_CURRENCY` + rebuild. Listings are priced in the currency active at approve time.

## Beta gaps (2026-09)
- **Organisation profiles:** an org is only a name + payout wallet created at first submission. No profile
  page, no editable mission/country/website, no proof that the submitter controls the wallet (needs SIWE).
  The first name typed for a wallet is kept; later names for the same wallet are ignored silently.
- **Double counting** is guarded by human review + heuristics, not by cryptographic uniqueness. Cross-registry
  checks (other platforms, Hypercerts) and evidence requirements (geotagged photos) are not built.
- **Indexers are per chain** (`indexer_arbsep_v3`, `indexer_rh_v2` since 2026-10-06; none for Celo); public RPCs
  occasionally throw transient BlockNotFound errors that Ponder retries. The web app does not read these tables yet.
- **Legacy double listings:** reports approved before 2026-09-25 are listed on both Arbitrum Sepolia and Robinhood
  Chain testnet (test data, intentionally left). New reports are listed on one network only.
- **Network chosen by cookie at submit:** a report goes to whichever network was selected in the header when it
  was submitted; there is no way to move it to another network after submission.

## Operational reminders
- Rotate the GitHub `admin:org` token used during earlier org operations (it appeared in chat).
- Secrets (DeepSeek, deployer, DB) live only in server env / local `.env` files, never committed.
- Resolved: the monorepo is on GitHub (`Regen-Bazaar/regenbazaar-beta`).

## Intermittent React hydration error #418 on /marketplace (found 2026-09-25)
- About 1 in 10 fresh loads of `/marketplace` in headless Chrome throw React error #418 (server HTML does not
  match the client). React recovers by client-rendering the page, so visitors see the same content.
- Side effect fixed: the re-render dropped `data-theme` from `<html>`; `ThemeToggle` now re-applies the saved or
  system theme on mount.
- Update after PR #34: the theme script moved from a hand-written `<head>` to the start of `<body>`. Measured
  in headless Chrome: 3 errors in 13 loads before, 1 in 45 loads after. So the `<head>` script was the main
  trigger but not the only one. Server and client body markup are identical apart from the theme icon, which
  points at `<head>`/document-level elements. Next step: reproduce with a non-minified production build.

## 2026-09-26 — Wallets
- Zerion (Chrome extension) fails with a 404 when confirming testnet transactions on Celo Sepolia and Arbitrum
  Sepolia; nothing reaches the chain and our server logs no 404. The same transactions simulate fine on the
  public RPC. The guide tells testers to use MetaMask or Rabby.
- Over WalletConnect, switching to or adding a testnet depends on the phone wallet; some refuse chains they
  do not list.
- The WalletConnect domain must be allowlisted for the project id at cloud.reown.com, or connections fail.

## 2026-09-28 — Methodology v0.2 (live since 2026-09-28)
- **Provisional numbers.** All six domain coefficients k are 1.0 and most non-environment weights are labelled
  assumptions until the expert round. The ±50% sensitivity test
  (`docs/methodology/sensitivity.md`) shows most assumption weights change the ranking of sample reports.
- **USD price rate is provisional** ($1 per IV point, `price-v02.ts`); the cost coefficient E is capped at 1.5 without calibration. v0.2 listings store
  `price_usd`; v0.1 listings keep IV × 0.5 in the sale currency, so the two are not directly comparable. On Celo
  Sepolia test CELO is counted as $1 (`usdPerUnit` in `lib/networks.ts`); mainnet needs a stablecoin there.
  Staking rewards scale with IV, so the v0.2 scale must be reviewed before mainnet.
- **Tree counts without area score no carbon.** The form asks for the planted area; the rule-based fallback
  extractor cannot read areas from text, only the LLM can.
- **Default mangrove survival 0.72 is a proxy** (Bourgeois 2024 biomass ratio), replaced by measured survival.
- **ESM suggestions need layer data.** Without `ESM_LAYERS_DIR` (manifest + GeoJSON extracts) validators set ESM
  by hand. The extracts are not in the repo; see `docs/methodology/esm-layers.md`. Point-in-polygon runs in
  memory, so large layers must be clipped to pilot regions.
- **Proof checks:** Facebook, Instagram and X often need a login, so fetched pages return little text; the
  form asks for a screenshot link. Photo EXIF (date, GPS) is not read yet: media are links, not uploads.
  Duplicate detection compares exact snapshot hashes only, so a re-encoded photo is not caught.
- **Country list** in the form covers the eight countries with grid factors; others submit without a country.
- **Report page shows pending reports by direct link** (existing behaviour, unchanged by v0.2).
- **Deploy order:** migration 0004 (additive) before the new web build; `methodology_version` stays empty for
  old rows, which the app reads as v0.1.
- **Token metadata links (fixed 2026-09-28):** metadata pinned before this date has `external_url` pointing at
  `http://0.0.0.0:3000/...` (the server's bind address). IPFS content is immutable, so those tokens keep it;
  the report is still found by its title, EAS UID and the in-metadata data. New listings use `PUBLIC_SITE_URL`.
- **Cost-based price tables are dated** (`cost-v02.ts`, FX as of 2026-09-28, minimum wages checked 2026-09-28,
  details in `docs/methodology/minimum-wages.md`). India's figure is an advisory national floor from secondary
  sources; Laos may have raised its rate in 2026; Cambodia has only a garment-sector rate. Refresh before mainnet.
- **Partner share** (updated 2026-10-07): partners are managed at `/verify/partners` (validators only) and
  attached at approval. A paused partner blocks its lots' sales until resumed or detached. Detaching does not
  revoke a voucher signed in the last hour; that voucher still pays the partner until it expires.

## Validator rewards (open)
- Validator rewards: not designed. An earlier plan used the REBAZ token; needs separate design (token model, legal
  review, incentives). Owner: revisit later. Do not promise rewards in public texts.
