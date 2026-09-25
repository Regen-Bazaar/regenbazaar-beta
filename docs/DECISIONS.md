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
