# Regen Bazaar beta: Architecture

_Written for the project owner. You understand the business; this explains how the pieces fit, in plain language.
Positioning and terms come from `docs/POSITIONING.md`; when this page disagrees with it, this page is wrong._

## 1. What this project does
Regen Bazaar is a marketplace for impact that has already happened. A **creator** (an NGO, an informal group or
an individual) reports work they have done, a **validator** checks the proof, and the verified impact is listed
as a **tRWI** (tokenized real-world impact) split into editions. **Buyers** (people, companies or AI agents)
purchase editions, and each purchase pays the creator directly, in the same transaction.

It is not a donation platform and it does not pre-fund projects. More impact gets funded indirectly, after the
result: a creator who can sell finished work has a reason, and the money, to do the next piece.

The product follows one cycle: **Work → Evaluate → Tokenize → Buy.**

## 2. The big picture (how a report flows)
```
Creator writes a report (free text) on /tokenize, on the network chosen in the header
        │
        ▼
[ Extract ]  an LLM (DeepSeek) reads the text → a structured list of actions and numbers
        │     (falls back to keyword parsing if no API key)
        ▼
[ Check ]    the creator checks the actions in the form and adds area, place, proof links and,
        │     optionally, what the work cost (hours, money spent)
        ▼
[ Score ]    a fixed formula (methodology v0.2) turns actions → physical units →
        │     domain scores (Σ units × AW × SM × ESM × S) → Impact Value (Σ domain score × k)
        ▼
[ Store ]    saved to the database as "pending_verification", stamped "v0.2"
        │
        ▼
[ Proof ]    on the validator's request the server fetches the proof links safely, saves a
        │     hash snapshot and raises flags (dates, numbers, place); flags never set anything
        ▼
[ Verify ]   a validator on /verify sets the proof level (P0 to P4), confirms the environmental
        │     sensitivity, optionally attaches a partner, and approves or rejects
        ▼
[ Tokenize ] the platform writes an EAS attestation on that one network, pins the metadata to IPFS
        │     and creates a listing (nothing is minted yet)
        ▼
[ Buy ]      a buyer on /marketplace redeems a platform-signed voucher: pays, and the editions
              are minted to the buyer; the payment is split in the same transaction
```
Two streams meet only in the price: *how much impact* (the Impact Value) and *how sure we are* (the proof
level). The proof level never changes the Impact Value.

**Key principle:** the LLM only *reads*; it never decides the score. The score is a fixed, repeatable formula,
so the same report always gives the same number, and anyone can check it. Impact Value is Regen Bazaar's own
relative index, not a certification, a credit or an offset, and not a common unit for comparing categories.

## 3. Price and money flow
**Price** (methodology v0.2, live since 2026-09-28): price in USD = IV × rate × P × E, split across editions
(100 per report today).
- **IV**, the Impact Value: the main weight of the price.
- **rate**: $1 per IV point for now (provisional).
- **P**, proof factor from the proof level: P1 0.6, P2 0.8, P3 0.9, P4 1.0. P0 is not listed.
- **E**, cost coefficient from 1.0 to 1.5: declared costs can raise the price by at most 50%; they are never
  added as dollars. No declared cost means E = 1.0.

**Primary sale** (contract RegenPrimarySale v2 on all three networks since 2026-10-06), all in one transaction:

| Who | Share |
|---|---|
| Regen Bazaar | 2.5% platform fee |
| Partner (only if the impact came through one, e.g. DeCleanup) | fixed share set when the partner is created; at most 10%, and at most 15% together with the platform fee |
| Creator | the rest: 97.5%, or 95% with a 2.5% partner |

The creator's payout wallet (called `beneficiary` in the contract) can be a personal wallet. The split is part
of the signed voucher, so it cannot be changed between signing and payment.

**Resale** happens on RegenMarketplace (escrow). Today: 2.5% marketplace fee and a creator royalty (2.5% for
collections first minted from 2026-10-07; collections already minted before keep 5%). Planned: a 2.5% partner share on resale too,
which needs a new marketplace version.

**Partners** are managed by validators on `/verify/partners` and attached to a report at approval.

## 4. Networks and hosting
- **Three testnets, one site.** https://app.regenbazaar.com serves Arbitrum Sepolia (chain 421614), Robinhood
  Chain testnet (46630) and Celo Sepolia (11142220). The visitor picks one in the header (kept in a cookie).
- **One report, one network.** A report is attested and listed only on the network selected when it was
  submitted, so the same impact is never sold on two chains. (A few test reports approved before 2026-09-25 are
  listed on both Arbitrum and Robinhood; left as test data.)
- **Contracts:** the v3 suite (TRWI, REBAZ, TRWIStaking, RegenMarketplace, AuthorizedAttesterResolver, EAS) went
  live on Arbitrum Sepolia and Robinhood on 2026-09-24, at the same addresses on both; Celo Sepolia runs the same
  v3 code at its own addresses. The sale contract RegenPrimarySale v2 has a different address on each network;
  the old v1 sale contracts lost their mint rights on 2026-10-06. All addresses: `packages/contracts/deployments/*.json`.
- **Payment currency:** Paxos USDG on Robinhood; a labelled testnet stand-in `tUSDG` on Arbitrum (the Paxos
  testnet faucet stopped dispensing there); native test CELO on Celo Sepolia.
- **Hosting:** a shared VPS running Docker compose with isolated `regenbazaar_*` containers: web (the Next.js
  app), postgres (database), ipfs (self-hosted kubo node for metadata) and two Ponder indexers (Arbitrum Sepolia
  and Robinhood; Celo Sepolia has none yet). nginx in front with a Let's Encrypt certificate. Runbook:
  `deploy/README.md`. thirdweb is **not** used: the sale and marketplace are our own contracts.

## 5. Repository map
This is a **monorepo** (one repo, many packages) managed by pnpm.

```
regenbazaar-app/
├─ apps/
│  ├─ web/                 The website + API (Next.js 15). Everything a user sees.
│  │  └─ src/app/          Pages: home, tokenize (submit a report), submission/[id], dashboard (creator),
│  │                       portfolio (buyer), marketplace, leaderboard, verify + verify/partners
│  │                       (validators), methodology, guide, roadmap.
│  │  └─ src/app/api/      Server endpoints: submissions, verifications, listings (voucher, partner),
│  │                       partners, impact (public, for AI agents).
│  │  └─ src/lib/          Networks, on-chain calls, partner split, IPFS, DB connection, validator access.
│  └─ indexer/             Ponder: reads contract events of one network into Postgres.
│
├─ packages/
│  ├─ impact-engine/       ★ The scoring brain. Pure, no dependencies. v0.2: tables-v02.ts (weights),
│  │                       score-v02.ts (formula), units.ts, proof.ts, price-v02.ts, cost-v02.ts, cards-v02.ts.
│  ├─ pipeline/            Glue: submit → extract → score → save; DeepSeek extractor; proof-link checks.
│  ├─ db/                  Database shape (Drizzle) + migrations + the production migration runner.
│  └─ contracts/           Smart contracts (Solidity/Foundry) and deployment records (deployments/*.json).
│
├─ deploy/                 Dockerfile, compose, nginx and runbook for the VPS.
└─ docs/                   This documentation; methodology in docs/methodology/.
```

## 6. Where data lives
- **Database (Postgres):** creators' names and payout wallets, reports and their status, validator decisions,
  partners, listings (one network each) and links to on-chain records. In local development this is an
  in-process database (PGlite, no Docker needed).
- **On-chain (three testnets):** the source of truth for ownership, sales and attestations.
- **Indexers:** copy on-chain events into their own Postgres schemas. The web app does not read these tables
  yet; it reads its own database and the chain.
- **IPFS:** the token metadata for each listing, pinned on our own node.

## 7. External dependencies (and why)
- **DeepSeek** (LLM): reads the creator's free text into structured actions. Server-side only.
- **EAS (Ethereum Attestation Service)**: the on-chain record that a report was verified.
- **OpenZeppelin**: audited building blocks for the smart contracts.
- **Paxos USDG**: the dollar stablecoin for payments where available.
- **WalletConnect**: optional connection from a phone wallet.
- **Next.js / Drizzle / PGlite / Foundry / Ponder**: app framework, database layer, dev database, contract
  toolchain, indexer.

## 8. Non-obvious decisions (so future-you isn't surprised)
- **The LLM never scores.** It only extracts; a fixed formula scores. This keeps IV checkable and hard to game.
- **Two methodologies live side by side.** v0.1 (`tables.ts`, `score.ts`, `price.ts`) scores nothing new but
  stays untouched so old reports recompute exactly. v0.2 scores every new report. The column
  `methodology_version` says which one produced a row (empty = v0.1).
- **One IV on-chain, domain scores on screens.** The EAS schema and contracts carry a single `impactValue`.
  Screens lead with the domain score and physical units.
- **Weight cards are code.** `packages/impact-engine/src/cards-v02.ts` holds the justification cards; the site
  and `docs/methodology/cards/*.md` are generated from it, so the numbers always come from the tables.
- **Lazy mint.** Nothing is minted until someone buys, so creators need no gas and no crypto knowledge to list.
- **Partner share is per network.** `primarySaleVersion` in `lib/networks.ts` says which voucher format a
  network's sale contract accepts; all three are on version 2.
- **The on-chain field is still named `ngo`** in the EAS schema (`address ngo, ...`). It holds the creator's
  wallet, whoever the creator is; renaming it would need a new schema.
- **Two DB code paths.** Dev uses a schema snapshot (`dev-schema.ts`) for PGlite; production uses real Drizzle
  migrations. A test fails if they drift apart.

## 9. Fragile areas (don't change without understanding first)
- **`packages/impact-engine/src/tables.ts`** (v0.1): do not change; old reports recompute from it.
- **`packages/impact-engine/src/tables-v02.ts`**: changing a weight changes every new score. Change the card
  text and status with it, bump `TABLES_VERSION_V02`, and rerun `scripts/sensitivity.ts` and
  `scripts/render-cards.ts`.
- **`apps/web/src/lib/partner-share.ts`**: the fee caps must match the contract, or a buyer gets a voucher that
  fails at payment.
- **`packages/pipeline/src/proof-check.ts`**: the only code that fetches links given by users. Keep the address
  check inside the socket lookup (it stops DNS rebinding).
- **Indexer schema names** (`deploy/.env`): bump on every contract or config change, or Ponder stops.
- **Secrets**: never commit `.env`. Keys live only in the server environment; the browser never sees them.

## 10. What's done vs. open
- **Live on three testnets:** submit → score → proof check → validate → attest → list → buy with the partner
  split, creator dashboard, buyer portfolio, leaderboard, methodology pages, partners screen.
- **Validator access** is a shared access code today; personal team accounts are on the roadmap.
- **Open:** validator rewards (not designed), partner share on resale (new marketplace version), gasless
  onboarding for non-crypto users, mainnet readiness (multisig keys, external audit, legal review).

See `docs/KNOWN_ISSUES.md` for current limitations and `/roadmap` on the site for what comes next.
