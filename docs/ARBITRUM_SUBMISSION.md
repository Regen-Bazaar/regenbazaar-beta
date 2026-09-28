# Arbitrum Open House Singapore: Online Buildathon · submission v4 (submitted 2026-09-27, card updated 2026-09-28)

> Для Paul (в форму не вставлять): **подано 27.09.2026** (Paul сказал «да»), проект в Project Gallery:
> https://www.hackquest.io/projects/Regen-Bazaar. До дедлайна карточку можно править (Edit Project); тексты ниже
> совпадают с карточкой и формой на 27.09. v3: одна площадка с переключателем сети, видео Loom, защита от
> повторного листинга, /roadmap, методология v0.1 → план v0.2, кран Paxos на Arbitrum Sepolia снова работает с 26.09.
> v4 (28.09, «да» Paul): карточка обновлена под методику v0.2 в проде (PR #42) и сквозной тест на Arbitrum Sepolia;
> картинки 3 и 4 заменены на скриншоты v0.2. Поля отправленной формы не менялись.
> Правила: `tRWI`, без длинных тире, веса platform-assessed, без трекшена, цифры партнёров не используются.

- **Tracks:** Overall Prize, Promising Products Track, Grants (all three, Paul 25.09)
- **Deadline:** 2026-10-04 15:59 UTC (23:59 SGT, 22:59 Da Nang)

---

## Project name
Regen Bazaar

## Tagline
Fund verified real-world impact on-chain, paid in USDG, with provenance anyone can check.

## At a glance (for judges)
- **One live app, network switcher:** https://app.regenbazaar.com (Arbitrum Sepolia, Robinhood Chain testnet,
  plus Celo Sepolia, the original network). The old https://robinhood.regenbazaar.com redirects to it.
- **Demo video:** https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77
- **Real Paxos USDG purchase on Robinhood Chain testnet**, 97.5% paid straight to the NGO wallet in the same
  transaction: https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77
- **All contracts source-verified** (Blockscout on both chains, Arbiscan); 61 Foundry tests incl. fuzz;
  OpenZeppelin 5.1.
- **One purchase = attest-backed lazy mint + stablecoin split to the NGO** in one transaction:
  ~465-518k gas, 0.000022 ETH on Arbitrum Sepolia, 0.0000052 ETH on Robinhood Chain testnet.
- **No double counting:** one report is listed on one network only; listing refuses a report already listed anywhere.
- **Methodology v0.2 live (2026-09-28):** scores per impact area in physical units, 34 weight cards, proof
  levels P0 to P4, USD price = IV × rate × proof × complexity. End-to-end check on Arbitrum Sepolia (test
  data): EAS attestation https://arbitrum-sepolia.blockscout.com/tx/0x27b4b46eba1346a6bb76785c8d23f4046d4850e38203e07ab4811213be620b23, purchase in tUSDG https://arbitrum-sepolia.blockscout.com/tx/0xb49beb3138eb3e786a992cbe37476cb51f120b469e5bf2de7ef6dd58d98df488.
- **No wallet needed to review:** the video and the proof transactions below.

## Problem
Small NGOs and community groups do measurable good (reforestation, cleanups, animal rescue, education) but
cannot turn that work into something a funder can buy, hold and verify. Carbon-style registries are built for
large projects and cost more to certify than a small project raises. Donations are unverifiable and
one-directional: the funder gets a receipt, not an asset.

## Solution
An NGO describes its impact in plain language. An LLM extracts the actions (DeepSeek V4 Flash via OpenRouter,
chosen by an eval of 8 low-cost models for zero invented numbers and resistance to prompt injection; the report
is treated strictly as data and the output is validated). A deterministic, versioned formula then computes the
Impact Value: the LLM never scores. Weights are published with a source status each; Impact Value is Regen Bazaar's own relative index, not a certification. A human validator sets the proof level (P0 to P4) and approves; the platform pins metadata to IPFS and attests the claim on-chain with
EAS. Funders buy fractional editions of that impact as **tRWI** (tokenized real-world impact, ERC-1155) and pay
in **USDG**. The token is lazily minted at purchase from a platform-signed voucher, so nothing is minted until
someone funds it, and the NGO is paid in the same transaction.

## Who pays and why (product-market fit)
- **Individual funders** who want proof of what they funded, not a receipt: a transferable, retirable asset
  with an on-chain attestation, visible on the **My impact** page.
- **Companies with CSR / sustainability budgets** that need auditable, granular impact purchases across
  many small projects, settled in a regulated-issuer stablecoin (USDG).
- **AI agents** that allocate funds: a public machine-readable catalogue (`/api/impact`) exposes Impact Value,
  framework tags (SDG, EBF) and methodology, and every claim is verifiable on-chain.
- **NGOs** get paid directly in stablecoins, with no certification cost up front.
- **Revenue model:** platform fee on primary sales (2.5%, signed into each voucher) and a capped royalty
  on secondary sales that goes back to the NGO.
- **Where this comes from:** before Regen Bazaar existed, we ran two single-organisation pilots of this model:
  Clean Phangan, a community beach-cleanup group on Koh Phangan (impact NFTs on Optimism,
  `0x5f7d5dee10e4cc693f0f9b047286d752550b4323`, https://cleanphangan.regenbazaar.com), and EcoThailand
  Foundation, a registered Thai foundation restoring mangroves (Celo, https://ecothailand.regenbazaar.com).
  Regen Bazaar generalises what they proved into a multi-organisation marketplace with scoring, attestation and
  stablecoin settlement.
- **Status, stated plainly:** beta on testnets; no production users or revenue yet.

## Methodology status (stated plainly)
- **Methodology v0.2 "Community layer", live since 2026-09-28** (PR #42): https://app.regenbazaar.com/methodology
- Impact Value is Regen Bazaar's own relative index, not a certification. Each impact area (environment, animal
  welfare, education, poverty, social, health) gets its own score in physical units (mangroves: hectares to
  tCO2e per year from IPCC 2019 and Bernal et al. 2018; waste in kg). One overall IV (sum of area scores × k) is
  kept for price, EAS attestation and staking.
- Every one of the 34 weights has a public card marked sourced, derived or assumption, with a ±50% sensitivity
  check. The Community layer scores 22 actions volunteers can deliver; 12 that need capital, a licence or
  professionals score 0 for now.
- Proof levels P0 to P4 are set only by a validator; nothing below P1 is listed. The server fetches public proof
  links (https only, SSRF-protected), keeps a hash snapshot and raises flags; page text cannot change flags,
  level or IV.
- Price in USD = IV × rate × proof level × complexity. The $1 per point rate is provisional, to be calibrated
  with a cost survey of pilot groups.
- v0.1 scores stay versioned and auditable; the v0.1 engine files are unchanged.

## Why on-chain, and why Arbitrum
- **Provenance anyone can check:** each tRWI collection references an EAS attestation; the sale contract
  verifies it before minting.
- **Fractional, transferable, retirable:** editions split one claim across funders; retiring burns editions
  to claim the impact permanently.
- **Tamper-proof economics:** price, fee and royalty are fields of the EIP-712 voucher; the frontend cannot
  change them.
- **Cost:** a full purchase is ~465k gas, 0.000022 ETH on Arbitrum Sepolia; an approve is 0.0000023 ETH.
  That is what makes sub-dollar impact editions viable.
- **Robinhood Chain:** a consumer-finance chain where USDG is native is a natural home for retail impact
  funding.

## How it works
1. NGO submits impact in free text; the engine extracts actions and scores Impact Value
   (`IV = Σ(AW·SM·TBV·ESM·PIM·ACDM)`, methodology published at `/methodology`).
2. Validator approves; metadata pinned to IPFS; EAS `ImpactClaim` attestation created.
3. Listing registered off-chain (no mint). Price derived from Impact Value, in USDG.
4. Buyer gets a signed voucher, approves USDG, calls `RegenPrimarySale.redeem`: the contract checks signature,
   deadline, nonce, currency allowlist and the attestation, pays NGO and fee, and lazily mints tRWI.
5. Ponder indexes mints and sales; the buyer sees holdings and can retire editions on **My impact**.

## USDG (Paxos) integration
- **Robinhood Chain testnet: real Paxos USDG** (`0x7E955252E15c84f5768B83c41a71F9eba181802F`) is the sale
  currency. Purchase paid in USDG (1.245 USDG: 1.213875 to the NGO, 0.031125 platform fee): https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77
- **Arbitrum Sepolia:** Paxos USDG (`0xFFC95faa3d63Cde504a05B567C600B78C0b41892`) is allowlisted in the sale
  contract. The Paxos testnet faucet stopped dispensing on Arbitrum Sepolia from 2026-09-22 to 2026-09-26 (the faucet
  address `0xcc9644EC26A647de0B9b86f1560d5180232f70a3` had no outgoing USDG transfers there in that window; it
  resumed on 2026-09-26). So the Arbitrum Sepolia demo sells in `tUSDG`, a stand-in with the
  same interface and decimals, labelled "not Paxos" on-chain and in the UI. The contract already accepts USDG;
  switching is one config value.

## Try it
- **Without a wallet:** video https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77; proof transactions below; contracts on Blockscout.
- **With a wallet (Robinhood Chain testnet):** get test ETH and USDG from the Paxos faucet, pick Robinhood
  Chain testnet in the network switcher, open Marketplace, "Fund this impact", then **My impact**.
- **With a wallet (Arbitrum Sepolia):** "Get 100 test tUSDG" in the Marketplace, then "Fund this impact".

## Contract addresses

**Robinhood Chain testnet (46630)** · explorer https://explorer.testnet.chain.robinhood.com

Same deployer and nonce sequence as Arbitrum Sepolia, so the core addresses are identical on both chains.

| Contract | Address |
|---|---|
| RegenPrimarySale | `0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030` |
| tRWI (ERC-1155, UUPS proxy) | `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` |
| RegenMarketplace | `0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214` |
| TRWIStaking | `0xB051e3B360A54e6E4808A2A06bEC765D246612B6` |
| REBAZ | `0x5Ea6AE9758472733144Eb24CCE7f310B21367b92` |
| EAS / SchemaRegistry / AuthorizedAttesterResolver | `0x95cD…d95d` / `0xa5dB…40b4` / `0xA4B1…abB1` (as on Arbitrum Sepolia) |
| Paxos USDG (payment) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` |

**Arbitrum Sepolia (421614)** · verified on Arbiscan (https://sepolia.arbiscan.io/address/0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030#code) and Blockscout (https://arbitrum-sepolia.blockscout.com)

| Contract | Address |
|---|---|
| RegenPrimarySale (voucher sale, lazy mint, stablecoin payments) | `0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030` |
| tRWI (ERC-1155, UUPS proxy) | `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` |
| tRWI implementation | `0x6446Cf9161F58A3FadEf2f3711265054c5DA84aC` |
| RegenMarketplace (secondary, escrow, capped royalty) | `0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214` |
| TRWIStaking | `0xB051e3B360A54e6E4808A2A06bEC765D246612B6` |
| REBAZ (ERC-20, capped) | `0x5Ea6AE9758472733144Eb24CCE7f310B21367b92` |
| EAS | `0x95cD0E3bDbC670e057416D65C89B584a9a24d95d` |
| SchemaRegistry | `0xa5dB5eC4d2F1435f7cb3504414981347E28340b4` |
| AuthorizedAttesterResolver | `0xA4B19AA834Db5cF19AcA0D3bcD0b1340e9c6abB1` |
| tUSDG (testnet stand-in, not Paxos) | `0x738B0C655E050320764EA1A7191BEA226B053410` |

**Token / factory:** tRWI is the token contract; collections are registered by `RegenPrimarySale` on first
redeem (no separate factory). REBAZ is the platform ERC-20.

**Proof transactions**
- Robinhood Chain testnet, purchase in real Paxos USDG through the live app: https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77
- Arbitrum Sepolia, purchase through the live app (2 editions, 1.245 tUSDG):
  https://arbitrum-sepolia.blockscout.com/tx/0x9b4a1d72107faf1dcc218754e3e3a419a34f31c92fde71d60a496166cd65ceb5
- Arbitrum Sepolia, scripted end-to-end (attest, voucher, approve, redeem):
  https://arbitrum-sepolia.blockscout.com/tx/0xc6cc5d5c0281b969a33f50918774a21d0fa4beef53d93f2fd0717f62927590aa

## Built during the buildathon (since 2026-09-14)
Regen Bazaar existed before the buildathon: the Impact-Value engine, AI extraction, the contract set and its
June 2026 security/gas self-audit, and a Celo Sepolia deployment. **Not claimed here.** Built during the
buildathon: PR #26 (https://github.com/Regen-Bazaar/regenbazaar-beta/pull/26, branch `feat/arbitrum-buildathon`)
and follow-ups #27-#39, all merged to `main`:

- Multichain app and indexer (network registry, per-chain listings, config-driven indexer): `00d4f75`,
  `b98bc3f`, `9b6b816`
- Stablecoin checkout (ERC-20 approve + redeem, USDG allowlist in deploy): `fb1d2ff`, `00d4f75`
- Arbitrum Sepolia deployment, Blockscout-verified; live app with TLS: `0a3a877`, `b3497a8`
- tUSDG stand-in and in-app test-token mint: `86eee42`, `ca6295d`
- **My impact** buyer page (live holdings, Impact Value funded, retire) and network switcher: `51b740c`
- Robinhood Chain testnet as a second network with real USDG, verified contracts, first USDG sale:
  `4662f5d`, `a64e846`, `a170823`
- Indexer reliability fix (Ponder schema crash loop): `9b6b816`
- One app for all networks, Celo Sepolia in the switcher, one report listed on one network only: #29, #31
- UI redesign (light/dark theme, readable type, phone layout) and demo polish: #32-#36
- Wallet switches to or adds the site network, WalletConnect, guide with test tokens per network: #37
- Input validation, verification page with evidence and duplicate hints, roadmap with methodology v0.2: #38, #39
- Methodology v0.2 live (per-area scores, weight cards, proof levels P0 to P4, USD price, step-by-step
  submission form, validator panel, per-area leaderboard) and public links in token metadata: #42, #43
- End-to-end v0.2 check on Arbitrum Sepolia (test data): approval at P2, EAS attestation, tRWI #10, purchase of
  2 editions in tUSDG at $0.5075 each, matching the formula

## Smart contract quality
- Solidity 0.8.29, OpenZeppelin 5.1 (AccessControl, Pausable, ReentrancyGuard, SafeERC20, UUPS, ERC20Capped),
  EAS. 61 Foundry tests including fuzz tests. Self-audit with Slither: `docs/AUDIT.md`.
- Separated roles (signer, attester, upgrader, pauser, admin) with an optional multisig handoff; the deployer
  cannot mint tRWI; only `RegenPrimarySale` can.
- EIP-712 vouchers with deadline and per-token nonce; fee and royalty signed; ERC-20 currency allowlist;
  royalty capped at 10%; metadata immutable after registration.
- Not externally audited. Testnet only.

## Sponsor technologies
- [x] Paxos / USDG
- [x] Robinhood Chain
- [x] OpenZeppelin
- [ ] GMX, Dune, ZeroDev, Fhenix, Alchemy, AWS

## Team
Paul Burg (team leader on HackQuest).

## What's next
- Embedded wallets and gasless checkout for non-crypto funders.
- Methodology v0.2 calibration: cost survey with pilot groups for the rate, then review of the weights by domain experts.
- Multisig + timelock, external audit, then mainnet (Arbitrum One / Robinhood Chain).

## HackQuest project card (Project Setup page)

> Для Paul: поля карточки проекта, как сохранены 28.09. Кошелёк 0x7380…21B5 подключён вами (для получения приза, сеть Arbitrum).

- **Name:** Regen Bazaar
- **Intro** (199/200):

```
NGOs turn verified real-world impact into tRWI tokens that anyone can fund in Paxos USDG. AI extracts, a transparent formula scores, EAS attests on-chain, and the NGO is paid in the same transaction.
```

- **Sector (up to 4):** RWA, AI, DeFi
- **Tech tags (up to 8):** Solidity, Next, React, Node, Web3
- **MVP Link:** https://app.regenbazaar.com
- **Project Link:** https://github.com/Regen-Bazaar/regenbazaar-beta
- **X (Twitter):** RegenBazaar
- **Images (max 4, 1280x720):** home and marketplace (dark theme); v0.2 report page with proof and v0.2 step-by-step
  tokenize form (light theme, `RegenBazaar/assets/app-proof-v02.jpg`, `app-tokenize-v02.jpg`)
- **Demo video:** https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77 (Loom, ~5 min)
- **Description** (as on the card, 28.09):

```
Regen Bazaar is a marketplace for tokenized real-world impact (tRWI). Small NGOs and community groups do measurable good (reforestation, cleanups, animal rescue, education) but cannot turn that work into something a funder can buy, hold and verify. Regen Bazaar closes that gap on Arbitrum.

Demo video (5 min): https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77

How it works: an NGO describes its work in plain language. An LLM extracts the actions (the report is treated strictly as data and the output is validated). A deterministic, versioned formula (methodology v0.2) computes the Impact Value; the LLM never scores. A validator checks the public proof, sets a proof level (P0 to P4) and approves; the platform pins metadata and a generated artwork to IPFS and attests the claim on-chain with EAS. Funders buy fractional editions as tRWI (ERC-1155) and pay in Paxos USDG. The token is lazily minted at purchase from a platform-signed EIP-712 voucher, and the NGO is paid in the same transaction.

One live app, one network switcher: https://app.regenbazaar.com runs on Arbitrum Sepolia and Robinhood Chain testnet (plus Celo Sepolia, the original network); the wallet switches to the chosen network. Real Paxos USDG purchase on Robinhood Chain testnet, 97.5% paid straight to the NGO: https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77

No double counting: one impact report is listed on one network only, the one the organisation chose. The listing step refuses a report that is already listed anywhere, and validators see hints when a new report looks like an earlier one.

Who pays: individual funders who want proof of what they funded, companies with CSR budgets that need auditable impact purchases in a regulated-issuer stablecoin, and AI agents (public machine-readable catalogue at /api/impact). Revenue: 2.5% platform fee signed into each voucher, plus a capped royalty back to the NGO on resales.

USDG: Paxos USDG is allowlisted on both Arbitrum chains. The Paxos testnet faucet stopped dispensing on Arbitrum Sepolia from 2026-09-22 to 2026-09-26, so the Arbitrum Sepolia demo sells in tUSDG, a clearly labelled stand-in with the same interface; the contract already accepts USDG and switching is one config value.

Methodology v0.2, live since 2026-09-28: https://app.regenbazaar.com/methodology
Impact Value is Regen Bazaar's own relative index, not a certification. Each impact area (environment, animal welfare, education, poverty, social, health) gets its own score in physical units: for example mangroves go from hectares to tCO2e per year (IPCC 2019, Bernal et al. 2018), waste is counted in kg. One overall IV (sum of area scores × k) is kept for price, EAS attestation and staking. Every one of the 34 weights has a public card marked sourced, derived or assumption, with its sensitivity: https://app.regenbazaar.com/methodology/cards/mangroves_planted
Community layer: the 22 actions volunteers can deliver are scored; 12 that need capital, a licence or professionals score 0 for now.
Proof levels P0 to P4 are set only by a validator, and a report below P1 is not listed. The server fetches public proof links (https only, SSRF-protected), stores a hash snapshot and raises flags on dates, numbers and place; page text cannot change the flags, the level or the IV (covered by a prompt-injection test).
Price in USD = IV × rate × proof level × complexity, paid in stablecoin at that price. The $1 per point rate is provisional and will be calibrated with a cost survey of pilot groups.

End-to-end check on Arbitrum Sepolia, 2026-09-28 (test data): v0.2 report, proof-link check, approval at P2, EAS attestation (https://arbitrum-sepolia.blockscout.com/tx/0x27b4b46eba1346a6bb76785c8d23f4046d4850e38203e07ab4811213be620b23), tRWI #10, purchase of 2 editions in tUSDG (https://arbitrum-sepolia.blockscout.com/tx/0xb49beb3138eb3e786a992cbe37476cb51f120b469e5bf2de7ef6dd58d98df488). The price, $0.5075 per edition, matched the formula, and the IV in the token matched the database: https://app.regenbazaar.com/submission/12d4ed94-0293-44ff-93a2-aaa8b53280bf

Before Regen Bazaar we ran two single-organisation pilots of this model: Clean Phangan (community beach cleanups, Optimism) and EcoThailand Foundation (mangroves, Celo). Status: beta on testnets, no production users or revenue yet.

Contracts are source-verified (Blockscout on both chains, Arbiscan); 61 Foundry tests; OpenZeppelin 5.1. Guide: https://app.regenbazaar.com/guide
```
- **Progress During Hackathon** (as on the card, 28.09):

```
Built during the buildathon (https://github.com/Regen-Bazaar/regenbazaar-beta, PR #26 and follow-ups #27-#43):

- Deployed and source-verified the full contract set on Arbitrum Sepolia (Blockscout + Arbiscan) and Robinhood Chain testnet (Blockscout).
- USDG checkout: Paxos USDG allowlisted on both chains; real USDG purchases on Robinhood Chain testnet; labelled tUSDG stand-in on Arbitrum Sepolia, added while the Paxos faucet was not dispensing there.
- One app with a network switcher (Arbitrum Sepolia, Robinhood Chain testnet, Celo Sepolia); the wallet switches to the chosen network or adds it; WalletConnect for phone wallets. The old robinhood.regenbazaar.com address redirects to it.
- Multichain indexer: one network registry, per-chain listings, config-driven Ponder indexer, fix for an indexer crash loop.
- Double-counting guard: one report is listed on one network only; listing refuses a report already listed anywhere; validators see duplicate hints and the evidence on the verification page.
- Generative tRWI artwork: a deterministic SVG impact card drawn from the impact data, pinned to IPFS as the token image.
- Buyer 'My impact' page (live holdings, Impact Value funded, retire), step-by-step /guide with test tokens for every network, public /roadmap, prices on cards, on-chain proof links.
- New interface: light and dark theme, readable type, phone layout.
- LLM extraction via OpenRouter, model chosen by an eval of 8 low-cost models (no invented numbers, resists prompt injection).
- Public-beta safety: LLM content moderation, input validation, rate limits, validator-only approvals, link-only evidence.
- Methodology v0.2 "Community layer", live 2026-09-28 (PR #42): scores per impact area in physical units, 34 weight cards (sourced / derived / assumption), proof levels P0 to P4 set by a validator, server-side proof-link checks with hash snapshots, USD price = IV × rate × proof × complexity, step-by-step submission form, validator panel, per-area leaderboard. Tests: engine 57, pipeline 31, db 2.
- End-to-end v0.2 check on Arbitrum Sepolia (test data): report, proof check, P2 approval, EAS attestation, tRWI #10, purchase of 2 editions in tUSDG; price and IV matched the formula.

Before the buildathon (not claimed): the Impact Value engine, the contract set and its June 2026 self-audit, a Celo Sepolia deployment.
```

- **Fundraising Status:** Bootstrapped, not raised.
- **Deployment details (judges only):** Ecosystem: Arbitrum Sepolia; Testnet:

```
Same addresses on Arbitrum Sepolia (421614) and Robinhood Chain testnet (46630).
RegenPrimarySale (sale, lazy mint, USDG): 0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030
tRWI (ERC-1155, UUPS proxy): 0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da
RegenMarketplace: 0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214
TRWIStaking: 0xB051e3B360A54e6E4808A2A06bEC765D246612B6
REBAZ (ERC-20): 0x5Ea6AE9758472733144Eb24CCE7f310B21367b92
EAS: 0x95cD0E3bDbC670e057416D65C89B584a9a24d95d
Arbiscan: https://sepolia.arbiscan.io/address/0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030#code
Robinhood explorer: https://explorer.testnet.chain.robinhood.com/address/0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030
App: https://app.regenbazaar.com (one app, network switcher: Arbitrum Sepolia and Robinhood Chain testnet)
```

## HackQuest form fields (each max 300 characters, checked)

> Для Paul: поля формы подачи на HackQuest, как отправлено 27.09.

**What is your contract address?** (42/300)

```
0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030
```

**Link to frontend/UI/website** (252/300)

```
https://app.regenbazaar.com (one app, network switcher: Arbitrum Sepolia with tUSDG, Robinhood Chain testnet with real Paxos USDG) | How to try: https://app.regenbazaar.com/guide | Demo video: https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77
```

**Core Protocol / Smart Contract Addresses** (291/300)

```
Same addresses on Arbitrum Sepolia and Robinhood Chain testnet: RegenPrimarySale 0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030 | RegenMarketplace 0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214 | TRWIStaking 0xB051e3B360A54e6E4808A2A06bEC765D246612B6 | EAS 0x95cD0E3bDbC670e057416D65C89B584a9a24d95d
```

**Factory/Pool Contracts** (153/300)

```
N/A. No factory or pool: each tRWI collection is registered by RegenPrimarySale on its first purchase (lazy mint from a platform-signed EIP-712 voucher).
```

**Token Contract Address** (185/300)

```
tRWI (ERC-1155, UUPS proxy) 0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da | REBAZ (ERC-20) 0x5Ea6AE9758472733144Eb24CCE7f310B21367b92 | same on Arbitrum Sepolia and Robinhood Chain testnet
```

**Which parts of your code were produced during the Buildathon** (284/300)

```
Since 14.09, github.com/Regen-Bazaar/regenbazaar-beta PRs 26-39: Arbitrum + Robinhood deploys, one app with network switcher, multichain indexer, USDG checkout, My impact, duplicate guard, validator evidence view, /roadmap, /guide. Pre-existing: scoring engine, contracts, Celo pilot.
```

**Prize tracks:** Overall Prize, Promising Products Track, Grants

**Sponsor technologies:** Robinhood Chain, OpenZeppelin, Paxos/USDG

---

## 2-minute video script

| Time | Screen | Voice-over |
|---|---|---|
| 0:00-0:15 | Landing | "Small NGOs do real good, but funders can't buy or verify it. Regen Bazaar turns verified impact into on-chain assets you fund in USDG, on Arbitrum." |
| 0:15-0:40 | /tokenize: paste text, extracted actions, Impact Value | "An NGO describes its work. Our engine extracts the actions and computes a deterministic Impact Value with published, platform-assessed weights." |
| 0:40-0:55 | /verify: approve | "A validator approves. Metadata goes to IPFS and the claim is attested with EAS." |
| 0:55-1:30 | robinhood.regenbazaar.com /marketplace: Fund, approve USDG, confirm | "A funder pays in Paxos USDG on Robinhood Chain. The contract checks the attestation, pays the NGO and mints tRWI in one transaction." |
| 1:30-1:45 | /portfolio: holdings, Retire 1 edition | "The funder sees exactly what they funded and can retire editions to claim the impact." |
| 1:45-2:00 | Blockscout verified contract + tx; logo | "Open source, verified, on Arbitrum Sepolia and Robinhood Chain. Regen Bazaar: fund real impact, verifiably." |
