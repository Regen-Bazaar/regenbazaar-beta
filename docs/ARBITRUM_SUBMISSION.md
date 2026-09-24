# Arbitrum Open House Singapore: Online Buildathon · submission draft v2

> Для Paul (в форму не вставлять): v2 после аудита. Изменения: сводка наверху, PMF-раздел, Robinhood Chain
> с настоящим USDG, измеренный газ, страница покупателя, путь «посмотреть без кошелька». Поля [?] ждут вас.
> Правила: `tRWI`, без длинных тире, веса platform-assessed, без трекшена, цифры партнёров не используются.

- **Track:** Promising Products
- **Deadline:** 2026-10-04 15:59 UTC (23:59 SGT, 22:59 Da Nang)

---

## Project name
Regen Bazaar

## Tagline
Fund verified real-world impact on-chain, paid in USDG, with provenance anyone can check.

## At a glance (for judges)
- **Live, two Arbitrum chains:** https://app.regenbazaar.com (Arbitrum Sepolia) and
  https://robinhood.regenbazaar.com (Robinhood Chain testnet).
- **Real Paxos USDG purchase on Robinhood Chain testnet**, 97.5% paid straight to the NGO wallet in the same
  transaction: https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77
- **All contracts source-verified** (Blockscout on both chains, Arbiscan); 61 Foundry tests incl. fuzz;
  OpenZeppelin 5.1.
- **One purchase = attest-backed lazy mint + stablecoin split to the NGO** in one transaction:
  ~465-518k gas, 0.000022 ETH on Arbitrum Sepolia, 0.0000052 ETH on Robinhood Chain testnet.
- **No wallet needed to review:** 2-minute video [?] and the proof transactions below.

## Problem
Small NGOs and community groups do measurable good (reforestation, cleanups, animal rescue, education) but
cannot turn that work into something a funder can buy, hold and verify. Carbon-style registries are built for
large projects and cost more to certify than a small project raises. Donations are unverifiable and
one-directional: the funder gets a receipt, not an asset.

## Solution
An NGO describes its impact in plain language. An AI engine extracts the actions and computes a deterministic,
versioned Impact Value (the LLM never scores; weights are published and platform-assessed, not third-party
certified). A human validator approves; the platform pins metadata to IPFS and attests the claim on-chain with
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
- **Status, stated plainly:** beta on testnets; no production users or revenue yet. [?] pilots / partners,
  only if confirmed

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
  contract. The Paxos testnet faucet has not dispensed on Arbitrum Sepolia since 2026-09-22 (the faucet address
  `0xcc9644EC26A647de0B9b86f1560d5180232f70a3` has no outgoing USDG transfers there since then, while it keeps
  dispensing on Robinhood Chain testnet). So the Arbitrum Sepolia demo sells in `tUSDG`, a stand-in with the
  same interface and decimals, labelled "not Paxos" on-chain and in the UI. Switching it to USDG is one config
  value; the contract already accepts USDG.

## Try it
- **Without a wallet:** video [?]; proof transactions below; contracts on Blockscout.
- **With a wallet (Robinhood Chain testnet):** get test ETH and USDG from the Paxos faucet, open
  Marketplace, "Fund this impact", then **My impact**.
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

**Arbitrum Sepolia (421614)** · explorer https://arbitrum-sepolia.blockscout.com

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
June 2026 security/gas self-audit, and a Celo Sepolia deployment. **Not claimed here.** Built for Arbitrum
during the buildathon, all on branch `feat/arbitrum-buildathon`
(https://github.com/Regen-Bazaar/regenbazaar-beta/tree/feat/arbitrum-buildathon):

- Multichain app and indexer (network registry, per-chain listings, config-driven indexer): `00d4f75`,
  `b98bc3f`, `9b6b816`
- Stablecoin checkout (ERC-20 approve + redeem, USDG allowlist in deploy): `fb1d2ff`, `00d4f75`
- Arbitrum Sepolia deployment, Blockscout-verified; live app with TLS: `0a3a877`, `b3497a8`
- tUSDG stand-in and in-app test-token mint: `86eee42`, `ca6295d`
- **My impact** buyer page (live holdings, Impact Value funded, retire) and network switcher: `51b740c`
- Robinhood Chain testnet as a second network with real USDG, verified contracts, first USDG sale:
  `4662f5d`, `a64e846`, `a170823`
- Indexer reliability fix (Ponder schema crash loop): `9b6b816`

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
[?]

## What's next
- Embedded wallets and gasless checkout for non-crypto funders.
- Calibrate Impact-Value weights with domain experts.
- Multisig + timelock, external audit, then mainnet (Arbitrum One / Robinhood Chain).

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
