# Handover — Regen Bazaar beta (state, what's needed from you, what's next)

_Single page to read at the end of this build phase. Plain language._

## Where we are
**Phase A core is built and proven live on the Celo Sepolia testnet.** The full product flow works
end-to-end against real contracts and real IPFS:

> NGO submission → admin approve → AI Impact Value score → metadata pinned to IPFS → EAS attestation →
> fractional tRWI minted on-chain → indexed → queryable.

| Workstream | State |
|---|---|
| Smart contracts v2 (tRWI lazy-mint, **RegenPrimarySale** voucher, **RegenMarketplace**, staking, EAS) | ✅ deployed + Blockscout-verified (45 forge tests) |
| AI Impact-Value engine + DeepSeek + price formula | ✅ working (off-chain tests green) |
| Tokenize → verify → EAS-attest + register listing (no mint) | ✅ |
| Buyer redeem (voucher → pay → lazy mint) | ✅ live-proven on Celo Sepolia |
| Self-host IPFS metadata pinning | ✅ proven (uri resolves to pinned JSON) |
| Indexer (Ponder, v2 events) | ✅ live-validated (CollectionRegistered/ImpactMinted/Sold → GraphQL) |
| Web app + **wallet connect + Fund (buy) UI** | ✅ renders; buy needs a real wallet (MetaMask) to click through |
| Deploy artifacts (Docker/compose/nginx/ipfs/indexer) | 🟡 code-ready, not yet run on a Docker host |
| Marketplace **own contracts** (thirdweb dropped — went paid) | ✅ built (primary voucher + secondary escrow) |
| **Live VPS deploy** | ✅ **LIVE at https://app.regenbazaar.com** (isolated `regenbazaar_*`, TLS, HelpRent untouched) |
| Non-crypto onboarding (embedded/gasless) | ⏳ later — self-host ERC-4337 (free), not built |

Deployed addresses + explorer links: `packages/contracts/deployments/celo-sepolia.json` and the README.

---

## 1. What I need from YOU

### A. Accounts / keys to create or hand over
| # | Item | Why | How to get it |
|---|---|---|---|
| A1 | ~~thirdweb~~ — **dropped** (went paid/heavy). Marketplace is our own free contracts. | n/a | n/a |
| A2 | Non-crypto onboarding (embedded/gasless) — **no paid provider**; plan = self-host ERC-4337 (free). | So wallet-less users can buy gaslessly (later phase). | Self-hosted bundler (Alto/rundler) + paymaster on the VPS — no signup |
| A3 | **DeepSeek API key for this project** | Production LLM extraction (now only borrowed from another project's .env for tests) | platform.deepseek.com → API key (server env only) |
| A4 | **Production RPC for Celo Sepolia** (optional but recommended) | The public `forno` RPC is rate-limited (Ponder warned) | Alchemy / dRPC / Infura Celo Sepolia endpoint |
| A5 | **Pinata/web3.storage key** (optional, later) | Broad third-party resolvability of IPFS metadata beyond our own gateway | pinata.cloud / web3.storage token |

### B. Manual actions (only you can do)
| # | Action | Notes |
|---|---|---|
| B1 | 🔴 **Rotate the GitHub org token** `ghp_RZyH…` | It was pasted in chat → treat as compromised |
| B2 | **Push this monorepo to GitHub** (decide repo name + visibility) | CI (GitHub Actions) runs automatically on push |
| B3 | **DNS A-record** for a subdomain (e.g. `app.regenbazaar.com`) → `62.72.44.6` | Needed before TLS/cert on the VPS |
| B4 | **Explicit "go" to deploy on the HelpRent VPS** | I will not touch the live prod box without it |
| B5 | **Fund the operator** with testnet CELO if it runs low | Currently ~9.4 CELO (plenty for now) |
| B6 | (Before mainnet) **Rotate deployer/operator key + move admin to a multisig** | Current key is a testnet burner exposed in chat |
| B7 | (Before mainnet/real money) **Legal review** | Selling "impact" + a token with rewards → securities/greenwashing/CSRD |

### C. Decisions I need from you
| # | Decision | My recommendation |
|---|---|---|
| C1 | Marketplace listing currency | CELO for beta (simplest); a test-stablecoin later |
| C2 | tRWI defaults: editions per mint, royalty % | 100 editions, 5% royalty (currently coded; easy to change) |
| C3 | Separate operator key vs reuse deployer | Separate operator key (grant it TOKENIZER+ATTESTER), keep admin offline |
| C4 | Real NGO data vs the demo seed for the beta | — |
| C5 | $REBAZ tokenomics (supply/emission/reward pool) | Placeholder on testnet is fine; finalize before mainnet |

---

## 2. What I'll do once you unblock each item
- **You give A1 (+ A2)** → I build **W6**: deploy thirdweb Marketplace V3, wire list + buy ("Fund this impact"), embedded-wallet onboarding so non-crypto users can buy.
- **You give B3 + B4 (DNS + "go")** → I run the **VPS deploy**: ship the isolated `regenbazaar_*` stack (web + indexer + IPFS + Postgres) via Docker, new nginx server-block + TLS, smoke-test on the live subdomain. (A3/A4 get set in the server `.env`.)
- **You push to GitHub (B2)** → CI starts gating every change; I can then open PRs instead of local commits.

## 3. Remaining work I CAN still do WITHOUT you (optional, deploy-independent)
Not zero — these are polish on top of the working core, doable now with no keys:
- **Surface on-chain proof in the UI**: on a tokenized submission, show the Blockscout token link + EAS attestation link + tx hashes (the data is already recorded in the DB on mint). Marketplace cards link to the on-chain token.
- **Read from the indexer when available**: make the web data layer optionally read leaderboard/holdings from the indexer's tables when a shared Postgres is configured (graceful fallback to current behavior).
- **Frontend/design polish**: richer home page, buyer-facing discovery/filtering, empty/loading/error states, accessibility pass, SEO/OG metadata.
- **More tests**: API route integration tests; broaden the IV taxonomy further.

Say the word and I'll pick these up; otherwise they wait until the product direction (marketplace/onboarding) is set, since some of this UI depends on those flows.

## 4. Security reminders (standing)
- Secrets live only in server `.env` files (git-ignored): deployer/operator key, DeepSeek, DB, future thirdweb/Privy/RPC keys. Never committed, never in the browser bundle.
- The browser never receives any private key. The LLM key is server-side only.
- HelpRent VPS is shared prod — everything we deploy is namespaced `regenbazaar_*`, its own network/volumes, no global docker prune, HelpRent's containers/ports/nginx untouched.

## Pointers
- Architecture: `docs/ARCHITECTURE.md` · Decisions: `docs/DECISIONS.md` · Known issues: `docs/KNOWN_ISSUES.md`
- Deployed addresses: `packages/contracts/deployments/celo-sepolia.json`
- Deploy runbook: `deploy/README.md`
