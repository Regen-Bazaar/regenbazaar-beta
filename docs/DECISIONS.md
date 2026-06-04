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
