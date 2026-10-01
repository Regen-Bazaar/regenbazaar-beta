# Decisions log

Append-only record of significant choices, why we made them, and the trade-offs accepted.

## 2026-06 — Build a new beta dApp (not revive the old MVP)
- **What:** Start a fresh monorepo instead of reviving `Demo-Regen-Bazaar` (Vite MVP) or `dapp`.
- **Why:** The three old repos (dapp ↔ Supabase, backend ↔ Mongo, contracts ↔ dead Celo Alfajores) were
  never integrated; dependencies were 12–16 months stale; Alfajores was sunset. Re-assembling them was
  more work than a clean, reuse-first build.
- **Trade-off:** Lose the old UI; gain a coherent, current, testable foundation.

## 2026-06 — Reuse-first, custom only the moat
- **What:** Use battle-tested OSS/ecosystem primitives (EAS, Hypercerts, thirdweb, Privy, Allo…) and
  custom-build only the **AI Impact-Value engine** and the **$REBAZ** token.
- **Why:** Less code to maintain, more trust, easier grants/promotion, ecosystem interoperability.
- **Trade-off:** Dependence on external SDKs (some early-stage, e.g. Hypercerts) — mitigated by a plain
  ERC-1155 fallback.

## 2026-06 — LLM extracts, deterministic formula scores
- **What:** The language model only parses free text into structured actions. A pure, versioned formula
  computes Impact Value. The LLM is never in the scoring path.
- **Why:** Auditability and anti-gaming. The same report always produces the same score; nobody can argue
  a number up with wording. Methodology is published at `/methodology`.
- **Trade-off:** The formula's seed weights are not yet expert-calibrated (labelled "platform-assessed,
  not certified").

## 2026-06 — DeepSeek as the LLM (not Anthropic)
- **What:** Swapped the LLM extractor from Anthropic to **DeepSeek** (OpenAI-compatible, function-calling).
- **Why:** Owner already has a DeepSeek API key across other projects; same capability for this task.
- **How:** OpenAI SDK pointed at `api.deepseek.com`; the prompt constrains output to the engine's canonical
  action keys so it scores correctly; a deterministic keyword parser is the fallback. Server-side only.
- **Trade-off:** None material; provider is swappable (the extractor is one file behind an interface).

## 2026-06 — tRWI = ERC-1155 with fractional editions
- **What:** One verified impact mints as ERC-1155 with the Impact Value split across editions.
- **Why:** A single real-world impact has many funders and tiers; fractional editions avoid
  double-counting and allow "retire to claim offset".
- **Trade-off:** Staking and marketplace must be ERC-1155-aware (handled).

## 2026-06 — Local dev with no Docker (PGlite + Foundry + Node)
- **What:** Development runs entirely in-process: PGlite for Postgres, Foundry for contracts, Node/tsx.
- **Why:** Fast iteration, no infrastructure to manage; the server is a deploy target, not a dev box.
- **Trade-off:** A second DB code path (dev schema snapshot) that must be kept in sync with migrations.

## 2026-06 — Network = Celo Sepolia
- **What:** Beta targets Celo Sepolia (chainId 11142220).
- **Why:** Celo Alfajores was sunset; Sepolia is live with ERC-4337 EntryPoint deployed (gasless feasible).
  EAS/Hypercerts will be self-deployed there.
- **Trade-off:** Some ecosystem contracts exist only on Celo mainnet → we deploy our own instances on testnet.

## 2026-06 — Server = deploy target only; everything isolated as `regenbazaar_*`
- **What:** The shared HelpRent VPS receives containers via Docker, fully namespaced and on its own
  network/volume, behind a new nginx server block. We never develop on the live box.
- **Why:** The VPS runs HelpRent in production; a mistake there breaks someone's service.
- **Trade-off:** Extra packaging discipline; deploy is gated on an explicit "go".

## 2026-06 — Versioned reference tables; taxonomy expanded to v0.1
- **What:** Expanded the action taxonomy across the full impact spectrum without changing existing
  weights; bumped `TABLES_VERSION` to `v0.1-seed-2026-06`.
- **Why:** Broader coverage (animals/education/poverty/social/health), while keeping historical scores stable.
- **Trade-off:** Weights remain seed values pending expert calibration.

## 2026-06 — Deployed core to Celo Sepolia + on-chain mint wiring (round 7)
- **What:** Deployed the core (self-deployed EAS + SchemaRegistry, REBAZ, tRWI UUPS proxy, staking, attester
  resolver) to Celo Sepolia and verified source on Blockscout. Wired the app: approve → pin metadata to IPFS
  → EAS attest → mint fractional tRWI. Activated the Ponder indexer.
- **Key decisions:**
  - **On-chain `impactValue = IV × 1e18`** (the human IV is scaled to wei) so the staking reward math
    (built for 1e18) is correct. Metadata keeps the human-readable IV. Caught during the plan double-check.
  - **Self-host IPFS (kubo)** for metadata pinning (owner choice); a read gateway resolves CIDs. Broad
    third-party resolvability can add a pinning service later without changing the token.
  - **Indexer = Ponder** (reads `.env.local`, not `.env`); writes to Postgres schema `indexer`; the chain is
    the source of truth, Postgres is the queryable index.
  - **Operator = the deployer key for beta** (holds TOKENIZER+ATTESTER). Recommended: a separate operator key
    with admin kept offline; mandatory before mainnet.
- **Trade-off:** Deployer/operator is a single hot key (testnet burner, exposed in chat) — acceptable on
  testnet, must rotate + move admin to a multisig before mainnet.

## 2026-06 — v2: platform-issued lazy mint via vouchers (supersedes mint-on-approve)
- **What:** dropped thirdweb (it became paid / heavy registration) and built our own. tRWI is **platform-issued
  and lazily minted on purchase** via platform-signed EIP-712 vouchers (`RegenPrimarySale`); secondary trading
  via our own escrow `RegenMarketplace`. Redeployed the core to Celo Sepolia (v2).
- **Why:** on-chain NGO attribution adds no verifiable value (a wallet is just an address; corporate buyers
  require accredited third-party verification) — the **platform's** authority is what matters. **Lazy mint**
  avoids pre-sale gas and the need for NGOs to have wallets. thirdweb's marketplace went paid → a minimal own
  contract is free and fits our custody model (NGO never holds; impact goes to market).
- **Hardenings:** token/sale split; voucher `deadline` + per-token `nonce` (reprice/delist); EAS is the source
  of truth (TRWI re-checks the attestation on register); separate SIGNER vs ATTESTER keys; correct lazy-mint
  edition accounting. Pricing is off-chain by formula (IV × rate).
- **Trade-off:** custom payment/voucher contracts (self-reviewed, not third-party audited); secondary is open
  (no forced royalty); operator hot key (testnet burner → multisig before mainnet).

## 2026-06 — Mainnet-readiness hardening pass (security/gas audit) — see `docs/AUDIT.md`
- **What:** Audited all six contracts (manual + Slither + OpenZeppelin MCP/Skills ruleset) and remediated
  for mainnet. Key changes:
  - **Role/key separation** (`Deploy.s.sol`): distinct env addresses for admin-multisig / signer / attester /
    upgrader / pauser / feeRecipient / treasury; explicit `UPGRADER_ROLE`+`PAUSER_ROLE` grants; the deployer
    EOA is no longer a TRWI minter; optional guarded admin→multisig handoff.
  - **Reward accounting → global cumulative index** in `TRWIStaking` (Σ rate·seconds). Rate changes settle
    first, so accrual is never retroactive; rewards are per-stake APR (not pool-diluted), so no totals or
    div-by-zero. Chosen over per-stake checkpoint loops (unbounded) and over a Synthetix pool index (wrong
    model here — accrual isn't shared).
  - **`emergencyUnstake`**: principal exit decoupled from reward minting (and from the lock while paused) so
    tRWI can never be trapped by a revoked/capped minter.
  - **`Pausable`** everywhere (entry paths gated; principal exits always open).
  - **Fee baked into the signed voucher** (`feeBps` in struct + typehash) so the NGO/buyer split is tamper-proof.
  - **REBAZ capped** (`ERC20Capped`); **royalty capped** at 10% (registration + proportional marketplace clamp);
    **currency allowlist** (blocks fee-on-transfer/rebasing tokens); **metadata immutable** post-registration
    (removed `setURI`); `EnumerableSet` for stake bookkeeping; CEI reorder; `unchecked` on proven-safe math.
- **Why:** Code was explicitly "testnet placeholder"; the owner requested a full mainnet-readiness pass.
- **Trade-offs accepted:** TRWIStaking storage layout changed (immutable contract → fresh redeploy required,
  no migration). The voucher typehash changed → off-chain signer + frontend EIP-712 must update in lockstep
  with the redeploy (documented in `docs/AUDIT.md`). Emissions remain mint-on-claim (now capped); a funded
  reserve is the longer-term model. Secondary marketplace remains open (royalty now capped, not removed).
- **Verification:** `forge test` 55/55 green; Slither `reentrancy-benign` on `list`/`stake` cleared; no real
  high/medium in `src/` (remaining detectors are OZ-lib false positives or by-design, triaged in `docs/AUDIT.md`).

## 2026-09 — Arbitrum Sepolia deployment + multichain config (Arbitrum Open House buildathon)
- **What:** Same v3 contracts deployed to Arbitrum Sepolia (`deployments/arbitrum-sepolia.json`, own EAS +
  SchemaRegistry, USDG allowlisted on `RegenPrimarySale` via new `ALLOWED_CURRENCY` deploy env). Celo Sepolia
  deployment untouched. Web: `apps/web/src/lib/networks.ts` is the single registry of chain + public addresses
  + sale currency, selected by `NEXT_PUBLIC_NETWORK` at build (default `arbitrum-sepolia`); the four hardcoded
  `11142220` sites now read it. Indexer: chain id / RPC / addresses from env. DB: `listings.chain_id` and a
  per-chain unique `(chain_id, token_id)` so both networks can share one Postgres.
- **Why build-time network, not runtime switch:** `NEXT_PUBLIC_*` is inlined into the browser bundle and wagmi
  config; one image = one network keeps server signer, voucher EIP-712 domain, and wallet chain consistent by
  construction. A runtime multi-network UI was more code for no demo benefit.
- **Why own EAS instead of a canonical EAS:** keeps the deploy script identical across chains and the
  `AuthorizedAttesterResolver` wiring unchanged.
- **Payment in USDG (Paxos testnet token, 6 decimals):** price model output is converted with the sale
  currency's decimals. Buyer flow = ERC-20 `approve` (exact amount) → `redeem`.
- **Bridge instead of faucet:** Arbitrum Sepolia faucets required mainnet balance / LINK / were down; test ETH
  was taken from the Google Cloud Sepolia faucet and bridged via the official Arbitrum Inbox (`depositEth`).
- **Indexer crash loop (root cause):** Ponder 0.8 `start` throws a NonRetryableError when its DB schema was
  created by a different build (contract addresses are part of the build), and `restart: unless-stopped`
  looped it forever (~50% CPU). Fix: per-deployment `INDEXER_SCHEMA` + `restart: on-failure:5` + CPU/memory
  limits.
- **Verification:** Blockscout (no API key to store). Arbiscan would need an Etherscan key; not done.

## 2026-09 — LLM extractor via OpenRouter, model chosen by eval
- **What:** Production extractor points the existing OpenAI-compatible client at OpenRouter
  (`DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1`, `DEEPSEEK_MODEL=deepseek/deepseek-v4-flash-0731`). No code
  path change; env names kept for backward compatibility.
- **Why this model:** `packages/pipeline/eval/extract-eval.ts` (10 cases: units, multi-domain, Russian text,
  no-numbers, future plans, prompt injection) over 8 cheap tool-calling models. DeepSeek V4 Flash: 20/21 (the
  one "miss" is a defensible extra action), no invented numbers, ignored the injection; ~$0.00005 per report.
  Rejected: Mistral Nemo (invented numbers, followed injection), GPT-4.1-nano and Llama 3.1 8B (followed
  injection), Nova Micro and Gemini Flash-Lite (missed actions). Pinned version id, not the floating alias.
- **Budget guard:** submission text capped (title 200, description 5000 chars); key has a $5 OpenRouter limit.
- **Revisit:** with grant money, re-run the eval on a stronger model; add cases from real partner reports.

## 2026-09 — Organisation identified by payout wallet (no auth yet)
- **What:** `/api/submissions` accepts `orgName` + `payoutWallet`; the org is found (case-insensitive) or
  created, unverified. Without them, submissions go to the demo org (renamed "Regen Bazaar demo org (sample
  data)"). Arbitrary `orgId` from the client is no longer accepted.
- **Trade-off:** anyone can create an org for any wallet; payouts only ever go to that wallet, so the harm is
  spam, not theft. Wallet-signature auth (SIWE) is the proper fix.

## 2026-09 — One site, visitor-selected network (replaces one-build-per-network)
- **What:** app.regenbazaar.com serves Arbitrum Sepolia and Robinhood Chain testnet. The choice lives in the
  `rb_network` cookie (header switcher, home "Choose your network", or `?network=<key>` via middleware).
  robinhood.regenbazaar.com is now a 301 into the app with `?network=robinhood-testnet`. One web container.
- **Safety by construction:** the voucher route signs for the listing's own `chain_id`, never the cookie, so a
  wrong cookie cannot produce a voucher for the wrong chain. wagmi knows both chains and switches on purchase.
- **Approve lists on every enabled network**, idempotent per (submission, chain): re-approving never creates a
  second listing of the same impact. Failures are per network.
- **Double-counting hints** (`lib/duplicates.ts`): validators see "possible duplicate" when a pending report has
  identical text, identical actions+quantities from the same org, or an overlapping period with the same kind
  of action. Hints only; the validator decides.

## 2026-09-25 — One report, one network; Celo Sepolia back in the switcher
- **What:** A submission now stores the network selected when it was submitted (`impact_submissions.chain_id`,
  migration `0003`). Approve attests and lists it on that one network only; if the report already has a listing
  on any network, approve returns it and creates nothing. Celo Sepolia (native CELO, v3 contracts from
  `deployments/celo-sepolia.json`) is in `ENABLED_NETWORKS` again; Arbitrum Sepolia stays the default.
- **Why:** listing the same impact on several chains lets it be funded (and claimed) twice, which contradicts the
  platform's no-double-counting rule. This replaces "approve lists on every enabled network" (entry above).
- **Legacy data:** reports approved before this change keep their existing Arbitrum + Robinhood listings (test
  data, left as is). No report is copied onto Celo; Celo shows only what is listed there (the June Mangrove
  report, tokenId 2) plus new test reports submitted while Celo is selected. Rows with no `chain_id` approve
  onto the default network.
- **No Celo indexer:** the web app reads holdings from chain in the browser and does not query Ponder tables, so
  a Celo indexer would only mirror events nobody reads. Not run, to spare memory on the shared host.
- **Fragile:** the network comes from the `rb_network` cookie at submit time; an NGO that forgets to switch
  first lists on the default network. The tokenize page and the validator queue both show the network.

## 2026-09-25 — UI redesign: light/dark theme, readable type, full-width layout
- **What:** Colours are now theme tokens (`bg`, `surface`, `raised`, `fg`, `muted`, `subtle`, `accent`, `ok`,
  `danger`, `line`) defined as CSS variables in `apps/web/src/app/globals.css`, with a dark and a light set.
  Semi-transparent text (`text-paper/45` etc.) is gone. Shared classes `btn`, `card`, `field`, `badge`, `tag`,
  `label-mono`, `page-wrap` (max 1520px). Type scale starts at 14px (mono labels), body 18px.
- **Theme:** a small inline script in `layout.tsx` sets `data-theme` before paint from `localStorage["rb-theme"]`,
  else the system setting; `ThemeToggle` flips and saves it. No flash on load.
- **Why:** reviewers (buildathon judges, NGOs) found the app generic, narrow and hard to read; measured contrast
  of grey text was 3.5 to 4.4:1. Now every text colour is at least 5.3:1 (measured on all 11 pages, both themes,
  at 390px).
- **Header:** 5 links + "More" (Leaderboard, Methodology, Roadmap); 8 links did not fit next to network, theme
  and wallet at 1440px.
- **Home:** hero artwork is the top 3 tRWI cards listed on the current network (fallback: verified reports
  submitted on it), which adds one DB read to `/`.
- **Fragile:** Tailwind v4 puts utilities above components, so a `bg-*` utility on a `.btn` overrides the
  disabled style; add `disabled:opacity-50` where that matters. Brand colours `gold`, `ink`, `paper`, `green`
  stay fixed across themes (gold buttons, ink text on gold); use `text-accent` (not `text-gold`) for gold text.

## 2026-09-25 — Demo polish: link previews, footer, lighter cards, live numbers
- **Link previews:** `favicon.ico` (was 404), `icon.svg`, `apple-icon.png`, title template `%s · Regen Bazaar`,
  per-page descriptions, and Open Graph / X card images rendered with `next/og` (bundled with Next, no new
  dependency). Project pages get their own card (Impact Value, title, organisation, SDGs); pending or rejected
  reports get a generic card and `noindex`, so nothing unapproved leaks into previews. OG fonts are read from
  `apps/web/public/fonts` (both the `next dev` and the standalone Docker working directories are tried).
- **Marketplace:** the test-token mint moved unchanged from `BuyButton` into one `TestTokens` banner; status
  badge sits on the artwork with a solid ink background so its contrast does not depend on the image.
- **Project page:** funds in place with `BuyButton` instead of linking to the marketplace.
- **Home numbers:** read live from the DB (approved reports, total IV, organisations, active listings,
  networks) and labelled as testnet sample data, to avoid reading as traction.

## 2026-09-26 — Demo feedback: RPC in CSP, network menu, framework links
- **CSP:** `connect-src` now lists the origin of every enabled network's RPC (built from `enabledNetworks()` in
  `next.config.ts`). Before, the browser could not read ERC-20 allowance or wait for receipts, so USDG checkout on
  Arbitrum Sepolia and Robinhood failed with "Failed to fetch"; Celo (native CELO) skipped that read. An RPC
  override in `NEXT_PUBLIC_*_RPC` is picked up at build time, as the headers are baked into the build.
- **Network menu** closes after a pick (the `<details>` stayed open).
- **Framework tags:** `FrameworkTag` links SDGs to the UN goal page and EBF tags to `/methodology#aw`, with the full
  name on hover. Inside a card link (dashboard) it renders as a plain tag with the hover text only.
- **Wallet follows the site network:** connecting passes the site network's `chainId`; choosing a network in
  the menu asks the wallet to switch; a wallet on another chain sees "Switch to <network>" instead of its
  address. wagmi's injected connector adds the network (`wallet_addEthereumChain`, our RPC and explorer) when
  the wallet does not know it. Wallet chain is read from `useAccount().chainId`, not `useChainId()`.
  A network the wallet already has with a broken RPC is not repaired by this; the user edits it in the wallet.
- **WalletConnect (QR / phone):** wagmi `walletConnect` connector with its QR modal, enabled only when
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set (build arg from `WALLETCONNECT_PROJECT_ID` in `deploy/.env`).
  "Connect wallet" offers Browser wallet or WalletConnect; other connect buttons use the extension, or
  WalletConnect when there is none (`useConnectWallet`). CSP allows the WalletConnect relay, Reown APIs,
  fonts and the verify iframe. No new dependency: `@walletconnect/ethereum-provider` ships with wagmi.
- **Error display:** `ErrorNote` shows one readable line (first line of the wallet/viem error, or a plain
  message for cancelled requests and missing funds); the full text sits under "Details" in a scroll box with a
  copy button. Used by checkout, test tokens, portfolio, tokenize and verify.
- **Fee headroom on every wallet write:** `feeOverrides()` reads the latest base fee and priority fee from the
  network RPC and passes `maxFeePerGas = 2 x base + tip`. MetaMask Mobile over WalletConnect proposed a cap
  below the Arbitrum Sepolia base fee and the node rejected the purchase. Only the used fee is charged. If the
  read fails, the wallet picks fees as before.

## 2026-09-27 — Verification page for reviewers and the demo
- `/verify` cards show organisation (and whether it is verified), payout wallet, period, region, evidence links
  (or "none attached") and a link to the full report. The queue API adds `org` for validators only.
- After approval the card becomes a green "Approved" panel with the network, token id, EAS UID, a link to the
  attestation transaction and to the listing. A wrong access code now says so.
- Approve failures are no longer silent: if pinning, attestation or listing fails, the API returns 502 with the
  reason and the report stays `pending_verification`, so it can be retried (re-approval is idempotent). Before,
  it was marked `verified` with no listing and dropped out of the queue.

## 2026-09-27 — Roadmap: verification levels, contribution statements, mainnet compliance
- **What:** Added to `apps/web/src/lib/roadmap.ts` (and regenerated `docs/ROADMAP.md`): a verification level in every
  attestation, dated follow-up monitoring, an on-chain contribution statement on retirement, funding/contribution
  wording instead of offsetting (EU Directive 2024/825, applies 27.09.2026), downloadable contribution history, opt-in
  ranks weighted by verification level, and for mainnet: participant-responsibility terms, wallet sanctions
  screening, and checkout only in natively issued regulated stablecoins. Proof-only (non-transferable) collections
  went to "Exploring".
- **Why:** These serve the retail marketplace now and keep later options open. Background research is kept
  outside the repo.

## 2026-09-27 — Submission input validation; roadmap trust phase becomes methodology v0.2
- **What:** `POST /api/submissions` validates `domain` and `context` against the engine tables (`parseDomain`,
  `parseContext` in `@rb/pipeline`) and returns 422 on unknown values; unknown context keys are dropped.
  `GET /api/submissions/<id>/metadata` returns 404 for pending or rejected reports unless the caller is a validator.
  The roadmap trust phase is now "methodology v0.2 and proof of impact" (status now), merged with the verification
  level, follow-up monitoring, contribution statement and green-claims items above; "verification level" and
  "proof level" are one concept, named proof level.
- **Why:** an unknown complexity answer produced a NaN Impact Value and a 500; metadata of unapproved reports was
  public. The methodology audit (kept outside the repo) led to the v0.2 plan: physical units from public coefficients,
  per-domain scores, proof levels, USD price from IV. Scoring tables and price are unchanged in this commit.

## 2026-09-27 — Partner share in RegenPrimarySale (v2, not deployed)
- **What:** optional `partner` + `partnerFeeBps` in the signed primary-sale voucher; caps 10% platform, 10% partner,
  15% combined. Details and tests in `docs/AUDIT.md`.
- **Why:** partners that verify or tokenize impact (first: DeCleanup) are paid in the same transaction as the creator
  and the platform, with no manual transfers.
- **Alternatives:** an on-chain partner registry (rejected: a contract change or admin transaction per partner, more
  attack surface); paying partners from the platform fee off-chain (rejected: manual, not transparent).
- **Trade-offs / fragile:** the partner and rate are only as trustworthy as the server signer, same as `feeBps` today.
  The web still targets v1 until the coordinated redeploy after 2026-10-04; merging this changes nothing live.

## 2026-09-28 — Impact Value methodology v0.2 (Community layer), engine and cards
- **What:** New engine path next to v0.1: `tables-v02.ts`, `units.ts`, `score-v02.ts`, `proof.ts`, entry point
  `scoreImpact(actions, ctx, version)` (default v0.2). Domain score = Σ units × AW × SM × ESM × S; IV = Σ domain
  score × k. 34 justification cards in `docs/methodology/cards/`, Five Dimensions rubric, ±50% sensitivity
  report, methodology text and changelog in `docs/methodology/`.
- **Why:** Owner approved the v0.2 plan on 2026-09-27 (D1 model, D2 single IV via domain coefficients with
  domain scores on screens, D3 proof levels with P1 minimum, D5 server-side link checks with SSRF and
  prompt-injection protection, D7 no new dependencies). v0.1 multipliers were self-declared and rewarded
  wording and period length; every number now carries a source status.
- **How:** `tables.ts`, `price.ts`, `score.ts` and their tests are untouched, so v0.1 scores recompute
  exactly. Lines of one action are merged before scoring; units are normalised (t → kg, m² → ha); tree
  counts need area or density; dedup rules for area vs trees, registry carbon, recycling vs collection,
  workshops vs participants, meals vs families. Proof level never enters IV. Contracts unchanged: EAS still
  carries one `impactValue`, now v0.2.
- **Alternatives:** dropping SM entirely (rejected by owner; fixed as an area factor instead); pricing from
  NGO cost (rejected; cost only calibrates the rate); rubric-derived weights now (deferred: units inside a
  domain differ in size, so v0.1 weights stay as labelled assumptions until the cost survey).
- **Trade-offs / fragile:** all k = 1.0 and most non-environment weights are assumptions pending the cost
  survey (D6); tree counts without area score 0; the default mangrove survival 0.72 is a proxy. The price
  formula (D4) is not implemented until the owner approves it separately. Staking rewards scale with IV, so
  the v0.2 scale must be considered before mainnet.

## 2026-09-28 — Methodology v0.2: data, proof checks, screens, ESM suggestions
- **What:** Migration 0004 (additive, nullable columns; old rows untouched, empty `methodology_version` = v0.1).
  Pipeline scores new reports with v0.2, validates location, proof links (https only), registry declaration and
  v0.2 context; the NGO's corrected actions are scored and the AI reading is stored next to them. Validators set
  the proof level (P1+ required to approve a v0.2 report) and confirm ESM, which rescores the report. Proof links
  are fetched by `proof-check.ts`; flags only. Screens lead with domain scores, physical units and proof level.
  ESM suggestions come from GeoJSON extracts of open layers (`ESM_LAYERS_DIR`).
- **Why:** plan stages 2–5 (D3, D5, D7).
- **How / alternatives:** SSRF protection without new packages: the address check runs inside the socket's DNS
  lookup (blocks rebinding), redirects re-validated; alternative (check then fetch) would be open to rebinding.
  The LLM only lists facts from a proof page; deterministic code compares them with the claim, so text on the
  page cannot produce a flag. Weight cards moved into code (`cards-v02.ts`) so the site and docs share one source.
  Layer data lives outside the image (large, licence attribution per layer).
- **Trade-offs / fragile:** price and currency unchanged until D4; token metadata `regen-bazaar/trwi-2` for v0.2
  reports publishes the country, never coordinates; no photo EXIF reading yet; ESM suggestions need the extracts.

## 2026-09-28 — Community scope, USD price (D4), manual map check, deploy before 04.10
- **Scope:** 12 actions that need capital, a licence or professionals are parked (`parked` in `tables-v02.ts`):
  kept in the tables and cards, score 0 with `out_of_scope`, not offered to the extractor or the form. Registered
  carbon work scores no carbon here. Owner: community groups do not do these for free.
- **Price (D4 approved):** `price-v02.ts`, USD = IV × rate × P × C; rate $1 per point provisional until the cost
  survey. First sales settle in USDG at that price; test CELO counted as $1 on Celo Sepolia until a stablecoin is
  added before mainnet. Listings store `price_usd` and `price_model_version`. Alternative (native token) rejected
  for primary sales: NGO revenue would follow the token price; trading lives on the secondary market.
- **Maps:** validators check the site on satellite, Global Mangrove Watch and Allen Coral Atlas links. Local
  extracts rejected (global coverage would need gigabytes and would not update); an on-demand lookup from open
  global maps (ESA WorldCover as cloud-optimized GeoTIFF, Allen Coral Atlas, Global Forest Watch data) is on the
  roadmap. The GeoJSON loader stays as an optional path (`ESM_LAYERS_DIR`).
- **Rubric:** not used to set weights; kept as a documented cross-check (see the owner discussion of 2026-09-28).
- **Deploy:** owner approved deploying v0.2 before the Arbitrum deadline, after a check on a server copy.

## 2026-09-28 — Price from declared, evidenced cost (SUPERSEDED 2026-10-01: wrong, see the correction below)
- **What:** `cost-v02.ts`: price USD = (volunteer hours × declared value of an hour + money spent) × P. The form's
  complexity step became "What it took". Validators see the country's statutory minimum hourly wage next to the
  declared hourly value (`MIN_WAGE_REFERENCE`, reference only). Amounts are converted with a dated FX table.
- **Why:** owner, 2026-09-28: impact does not depend on cost, but the price does; the rate and domain coefficients k
  had no source, and a survey of pilots would not generalise across countries. Each group declares its own local
  costs, checked through the proof layer; no regional average database, no automatic caps.
- **Alternatives:** IV × rate × P × C (kept only as a fallback for reports without a cost declaration); pilot cost
  survey (rejected); platform-set hourly values by country (rejected: the minimum wage is shown, the group decides).
- **Fragile:** FX and minimum wage tables need periodic updates (dated in code); cost inflation is caught only by the
  validator and by buyers comparing impact per $100.

## 2026-10-01 — Correction: price comes from Impact Value; costs are a coefficient
- **What:** price USD = IV × rate × P × E. E = 1 + 0.5 × min(1, declared cost ÷ (IV × rate)), so declared costs raise
  the price by at most 50% (`price-v02.ts`). Reports without costs: E = 1.0. Complexity C removed from the price.
- **Correction of the 2026-09-28 entry "Price from declared, evidenced cost":** that entry was wrong. "Price = cost × P"
  was Claude's proposal; the owner never decided to replace impact with cost. Owner, 2026-10-01: the impact value is
  the main weight of the price; costs are only an additional coefficient, and spending $1000 does not add $1000.
- **Fragile:** the +50% cap and the $1 rate are set for this methodology version, not calibrated. Unsold editions of
  v0.2 listings were repriced in the database; sold editions keep the price they were bought at.
