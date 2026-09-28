# Colosseum Crypto World's Fair · submission draft v1

> Для Paul (в форму не вставлять): черновик полей формы colosseum.com/arena/hackathon ("Create project").
> Окно: 14.09.2026 06:00 PT – 12.10.2026 23:59 PT (до 13.10 13:59 Да Нанг). Цель: подать к 11.10.
> Треки: главные места + Public Goods + Arbitrum + Robinhood Chain.
> Правила текста: `tRWI`; веса platform-assessed, not third-party certified; только testnet; цифры партнёров не наши; без длинных тире.
> Поля [?] ждут вас.

---

## Project name
Regen Bazaar

## One-liner
A marketplace where NGOs turn verified real-world impact into tRWI tokens that people and AI agents fund in
stablecoins, with the NGO paid in the same transaction.

## Description
Small NGOs and community groups do measurable good (reforestation, cleanups, animal rescue, education) but cannot
turn that work into something a funder can buy, hold and verify. Carbon registries cost more to certify than a
small project raises; donations give the funder a receipt, not an asset.

On Regen Bazaar an organisation describes its work in plain language. An LLM lists the actions and quantities
and the organisation corrects that list. Methodology v0.2 converts them to physical units, scores each impact area
and one Impact Value, Regen Bazaar's own relative index (the LLM never scores). A validator sets a proof level
P0 to P4, metadata is pinned to IPFS and the claim is attested on-chain with EAS. Funders buy fractional editions of that
impact as **tRWI** (tokenized real-world impact, ERC-1155), paid in Paxos USDG. The token is lazily minted from a
platform-signed EIP-712 voucher, so nothing exists on-chain until someone funds it, and 97.5% of the price goes to
the NGO wallet in the same transaction. Funders can hold, transfer or retire editions to claim the impact. A public
`/api/impact` catalogue lets AI agents discover and fund impact programmatically.

Status: public beta on testnets (Arbitrum Sepolia, Robinhood Chain testnet, Celo Sepolia). Impact Value is
Regen Bazaar's own relative index (methodology v0.2), not a certification. No production users or revenue yet.

## Links
- **Live app:** https://app.regenbazaar.com (network switcher: Arbitrum Sepolia, Robinhood Chain testnet, Celo Sepolia)
- **How to try (no prior setup):** https://app.regenbazaar.com/guide
- **Methodology:** https://app.regenbazaar.com/methodology
- **Roadmap:** https://app.regenbazaar.com/roadmap
- **Code (MIT):** https://github.com/Regen-Bazaar/regenbazaar-beta
- **Pitch video and demo video (same recording, founder on camera + product):**
  https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77
  > Для Paul: запись 4:54, лимит каждого видео по правилам 3:00. См. `COLOSSEUM_VIDEO_SCRIPTS.md`.
- **Website:** https://www.regenbazaar.com

## Networks and tools
Arbitrum Sepolia, Robinhood Chain testnet, Celo Sepolia · Paxos USDG · EAS (Ethereum Attestation Service) · IPFS ·
OpenZeppelin 5.1 · Foundry · Ponder indexer · Next.js, wagmi, WalletConnect · OpenRouter (LLM extraction)

## Location
Da Nang, Vietnam

## Team
**Paul Burg**, solo founder. Designs and ships whole systems (architecture, data, agents, integrations, where the
human stays in the loop) and builds them with AI development tools, owning delivery from idea to production.
Before Regen Bazaar: founder of EcoSynthesisX (2023–2026), the ReFi studio behind the Clean Phangan and
EcoThailand impact collections and the dMRV concept Regen Bazaar generalises; builder of HelpRent Da Nang
(rental search platform with an AI assistant). Founded and ran own ventures since 2011 (sales, supply chain in
Asia, operations).
Links: X https://x.com/RegenBazaar · Telegram https://t.me/regen_bazaar · GitHub https://github.com/Regen-Bazaar

---

## Why on-chain (UX judged: how the blockchain improves the experience)
- **The funder gets an asset, not a receipt.** A tRWI edition can be held, transferred or retired; the page
  "My impact" shows exactly which impact the wallet funded.
- **Provenance anyone can check.** Each collection references an EAS attestation; the sale contract checks it
  before minting. No need to trust the platform's database.
- **The NGO is paid instantly.** One transaction verifies the voucher, splits the stablecoin (NGO / platform fee)
  and mints. No payout queue, no bank transfer across borders.
- **Economics the frontend cannot change.** Price, fee and royalty are signed voucher fields.
- **Cheap enough for small tickets.** A full purchase is ~465–518k gas: 0.000022 ETH on Arbitrum Sepolia,
  0.0000052 ETH on Robinhood Chain testnet, so sub-dollar editions make sense.

## Open source and composability
- MIT licence, whole monorepo public: contracts, scoring engine, web app, indexer, deploy.
- Standard primitives: ERC-1155 tRWI (UUPS), ERC-2981 royalty, EIP-712 vouchers, EAS attestations, any
  allowlisted ERC-20 as payment.
- Other protocols can read the EAS `ImpactClaim` attestations and the `/api/impact` JSON catalogue (Impact Value,
  SDG and ecosystem-benefit tags, methodology version) without asking us.
- 61 Foundry tests including fuzz tests; Slither self-audit in `docs/AUDIT.md`; contracts source-verified on
  Blockscout (and Arbiscan on Arbitrum Sepolia). Not externally audited.

## Methodology, stated plainly
- **Live since 2026-09-28 (v0.2, Community layer):** https://app.regenbazaar.com/methodology
  - Score per impact area in physical units (tCO₂e per year from IPCC 2019 and Bernal 2018, kg of waste,
    people, animals); one Impact Value, Regen Bazaar's own relative index, kept for price and the on-chain
    attestation.
  - 34 public weight cards, each with source status (sourced, derived, assumption) and a ±50% sensitivity test.
    Community layer: 22 volunteer actions scored, 12 that need capital or specialists kept aside.
  - Proof levels P0 to P4 set by a validator; the server checks public links (hash snapshot, date, number and
    place flags). Nothing below P1 is listed.
  - Price in USD: IV × rate × P × complexity; primary sale in USDG. The rate is provisional, pending a cost
    survey with pilot groups.
  - Every score is stamped with its methodology version and never rescored; v0.1 reports keep their v0.1 value.
- **Not yet:** weights marked "assumption" await a cost survey and expert review. Not a certification, not a
  carbon credit.

---

## Go-to-market
- **First supply: organisations we already worked with.** Before this platform, EcoSynthesisX ran two
  single-organisation impact collections: Clean Phangan, a community beach-cleanup group on Koh Phangan
  (Optimism, https://cleanphangan.regenbazaar.com), and EcoThailand Foundation, a registered Thai foundation
  restoring mangroves (Celo, https://ecothailand.regenbazaar.com). Their activity figures are theirs, not ours.
  They are the first organisations we invite to list on the multi-organisation marketplace.
- **Next supply: partner platforms.** Integration with DeCleanup (cleanup reports) is on the public roadmap, so
  verified work from partner apps can be listed without re-entering it.
- **Who buys tRWI:**
  - individual funders who want proof of what they funded, retail users on consumer chains (Robinhood Chain);
  - companies with CSR budgets that need granular, auditable purchases across many small projects, settled in a
    regulated-issuer stablecoin;
  - AI agents that allocate funds, through the machine-readable `/api/impact` catalogue and on-chain checks.
- **Distribution:** ReFi communities and public-goods rounds where the founder has worked since 2023, the partner
  organisations' own audiences, and chain ecosystems where the app is live.
- **Demand validation so far (honest):** the two pilot collections showed that organisations will list impact and
  funders will buy it on-chain. Regen Bazaar itself is a testnet beta with no production users or revenue yet;
  the next step is paid listings from the pilot organisations on mainnet.

## Business model
- Platform fee on primary sales: 2.5%, signed into each voucher.
- Capped royalty on secondary sales (max 10%), paid back to the NGO.
- Later: verification services for organisations that need a higher proof level, and an API for funders and
  agents that allocate at volume.
- Path to mainnet: multisig and timelock on admin roles, external audit, cost survey for the v0.2 weights, then Arbitrum One and
  Robinhood Chain mainnet.

---

## Development history (full disclosure)

The contest judges work done between 2026-09-14 and 2026-10-12. Everything below is in the public git history:
https://github.com/Regen-Bazaar/regenbazaar-beta/commits/main

**Before the window (not claimed).** Regen Bazaar is a long-running project; the full timeline is public at
https://app.regenbazaar.com/roadmap ("Journey so far"):
- **Before the platform:** two single-organisation pilots of the model with EcoSynthesisX: Clean Phangan
  (community beach cleanups, impact NFTs on Optimism) and EcoThailand Foundation (mangrove restoration, Celo).
- **Jan to Feb 2025:** litepaper and the first MVP monorepo.
- **Mar to May 2025:** contract prototypes on Starknet (Cairo), Move and Stellar.
- **Apr 2025:** Gitcoin Grants GG23 (OSS dApps and Apps round).
- **Apr to Jul 2025:** EVM contracts and a Next.js dApp; Celo Proof of Ship, Season 4 (contracts on Alfajores).
- **2026-06-03 to 06-06:** rebuilt from scratch in the current repo: contracts (tRWI ERC-1155, REBAZ, staking,
  EAS resolver, voucher primary sale, escrow marketplace), hardened v1 to v3 with a Slither self-audit;
  Impact-Value engine and LLM extraction; web app; end-to-end purchases on Celo Sepolia; Sentry and Dependabot.
- **2026-09-07:** maintenance (MIT licence, README, Next.js security patch).

**During the window (2026-09-14 onward), by commit:**
- Arbitrum Sepolia: deploy script with ERC-20 allowlist, per-chain listings, network registry, USDG checkout
  (approve + redeem), config-driven indexer and crash-loop fix, deployment verified on Blockscout and Arbiscan:
  `fb1d2ff`, `b98bc3f`, `00d4f75`, `9b6b816`, `0a3a877`, `ad91a2e`
- tUSDG stand-in while the Paxos faucet does not dispense on Arbitrum Sepolia, in-app test-token mint: `86eee42`, `ca6295d`
- Live app with TLS and a recorded live purchase: `b3497a8`
- "My impact" buyer page (holdings, Impact Value funded, retire): `51b740c`
- Robinhood Chain testnet with real Paxos USDG, verified contracts, first USDG purchase: `4662f5d`, `a64e846`, `a170823`
- LLM extraction via OpenRouter, model chosen by an eval of 8 low-cost models: `65f1fdd`
- Guide, prices on cards, organisation and payout wallet on submission: `c4badc9`, `2b8c40e`
- Methodology status banner: `2ebcfb1`
- Beta hardening: validator-only approvals, LLM content moderation, rate limits, private pending queue;
  generative tRWI artwork pinned to IPFS: `8131195`
- One site, three networks with a runtime switcher; one report is listed on one network only (no double
  counting); Celo Sepolia added: `c4b5cd2`, `e1e6705`, `3f05bf6`, `4ba15e6`
- Public roadmap page: `987c1cb`
- Redesign with light and dark themes, phone layout: `412a0d8`, `720ec78`, `d94d2f6`
- Wallet UX: switch to the site network, WalletConnect (QR / phone), readable errors: `6d2725d`, `72da940`, `ea8d660`
- Verification page shows evidence and organisation; submission input validation: `9320158`, `8f3e57c`
- Methodology v0.2 live on the site, 2026-09-28: PR https://github.com/Regen-Bazaar/regenbazaar-beta/pull/42
- [?] всё, что будет сделано до 12.10 (дописать перед подачей)

> Для Paul: Arbitrum Open House подаётся параллельно с тем же кодом; правила Colosseum это не запрещают.

## Proof transactions
- Robinhood Chain testnet, purchase in real Paxos USDG through the live app (97.5% to the NGO in the same tx):
  https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77
- Arbitrum Sepolia, purchase through the live app:
  https://arbitrum-sepolia.blockscout.com/tx/0x9b4a1d72107faf1dcc218754e3e3a419a34f31c92fde71d60a496166cd65ceb5
- Arbitrum Sepolia, end-to-end on methodology v0.2 (test data): report, proof level P2, EAS attestation,
  tRWI #10, purchase of 2 editions in USDG, 2026-09-28:
  https://arbitrum-sepolia.blockscout.com/tx/0xb49beb3138eb3e786a992cbe37476cb51f120b469e5bf2de7ef6dd58d98df488
  (report page https://app.regenbazaar.com/submission/12d4ed94-0293-44ff-93a2-aaa8b53280bf)

## Contract addresses (same on Arbitrum Sepolia and Robinhood Chain testnet)
| Contract | Address |
|---|---|
| RegenPrimarySale | `0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030` |
| tRWI (ERC-1155, UUPS proxy) | `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` |
| RegenMarketplace | `0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214` |
| TRWIStaking | `0xB051e3B360A54e6E4808A2A06bEC765D246612B6` |
| REBAZ | `0x5Ea6AE9758472733144Eb24CCE7f310B21367b92` |
| EAS | `0x95cD0E3bDbC670e057416D65C89B584a9a24d95d` |

Celo Sepolia: same v3 contracts at other addresses, `packages/contracts/deployments/celo-sepolia.json`.

---

## Judges' likely questions (answers for Paul)

**"Where do the weights come from?"**
v0.2 is live: each weight has a public card with its source status (sourced, derived, assumption) and a
sensitivity test; environment uses IPCC 2019 and Bernal 2018. Weights marked "assumption" await a cost survey and
expert review. Every score records its methodology version, so nothing is hidden. Note: the video was recorded
before v0.2.

**"Why not just donate?"** A donation gives a receipt. tRWI gives a transferable, retirable asset tied to an
on-chain attestation, and the NGO is paid in the same transaction.

**"Is this a carbon credit?"** No. Impact Value is Regen Bazaar's own relative index; v0.2 shows physical units
for environmental actions, but we do not issue carbon credits and a buyer cannot claim an emissions result.

**"Who stops fake reports?"** A human validator approves every report; evidence is linked; quantities are clamped;
one report is listed on one network only. v0.2 proof levels P0 to P4 (from self-reported to second-party
witnessed); nothing below P1 is listed.

## Screenshots (если форма просит изображения)
Папка: `~/Downloads/RegenBazaar-screenshots-2026-09-25/`. Рекомендую `*-screen.png` (первый экран), светлая тема:
1. `desktop-light-01-home-screen.png`
2. `desktop-light-02-marketplace-screen.png`
3. `desktop-light-03-project-screen.png` (отчёт с on-chain доказательством)
4. `desktop-light-04-tokenize-screen.png`
5. `desktop-light-06-methodology-screen.png`
6. `phone-light-02-marketplace-screen.png` (мобильная версия)
Тёмные версии (`desktop-dark-*`) как запасные. Файлы home по 4–5 МБ; если форма ограничивает размер, пережму.
