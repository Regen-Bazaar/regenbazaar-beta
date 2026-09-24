# Arbitrum Open House Singapore: Online Buildathon · submission draft

> Для Paul: черновик на одобрение. Поля формы на английском. Правила текста соблюдены: `tRWI`, без длинных
> тире, таблицы весов помечены как platform-assessed, трекшена и пользователей не заявляем, цифры Clean Phangan /
> EcoThailand не используются. Отмечено [?] там, где нужно ваше решение.

- **Track:** Promising Products
- **Deadline:** 2026-10-04 15:59 UTC (23:59 SGT, 22:59 Da Nang)

---

## Project name
Regen Bazaar

## Tagline (one line)
Turn verified real-world impact into on-chain assets that anyone can fund in stablecoins.

## Short description
Small NGOs and community groups do measurable good (mangrove planting, beach cleanups, animal rescue,
education) but have no way to turn that work into something a funder can buy, hold and verify. Regen Bazaar
lets an organisation describe its impact in plain language; an AI engine extracts the actions and computes a
deterministic, versioned Impact Value; a human validator approves it; the platform attests the claim on-chain
with EAS and pins the metadata to IPFS. Funders then buy fractional editions of that impact as tRWI
(tokenized real-world impact, ERC-1155) and pay in a stablecoin. The token is lazily minted at purchase from a
platform-signed voucher, so nothing is minted until someone actually funds it.

## Why on-chain
- **Provenance anyone can check.** Each tRWI collection references an EAS attestation (who attested, which
  Impact Value, which metadata). A buyer or an AI agent can verify the claim without trusting our database.
- **Fractional, transferable, retirable.** ERC-1155 editions split one impact claim across many funders;
  editions can be retired to claim the offset, and resold with a capped royalty back to the NGO.
- **Stablecoin settlement, no intermediary.** The buyer pays the NGO directly in the same transaction as the
  mint; the platform fee and royalty are part of the signed voucher and cannot be altered by the frontend.
- **Arbitrum makes it economical.** A full attest + voucher redeem + mint costs cents of gas, which matters
  when an edition sells for less than one dollar.

## How it works (flow)
1. NGO submits impact in free text (web app).
2. Impact engine: LLM extracts structured actions; a deterministic formula scores Impact Value
   (`IV = Σ(AW·SM·TBV·ESM·PIM·ACDM)`). Weights are platform-assessed, not third-party certified, and published
   at `/methodology`.
3. Validator approves; platform pins metadata to IPFS and creates an EAS `ImpactClaim` attestation.
4. Listing is registered off-chain (no mint yet). Price is derived from Impact Value.
5. Buyer connects a wallet, gets a platform-signed EIP-712 voucher, approves the stablecoin, calls
   `RegenPrimarySale.redeem`. The contract checks signature, deadline, nonce, currency allowlist and the EAS
   attestation, splits payment (NGO / platform fee) and lazily mints the tRWI editions to the buyer.
6. Ponder indexer syncs mints and sales into Postgres for the marketplace and leaderboard.

## Live demo
- **App:** https://app.regenbazaar.com (Arbitrum Sepolia; network badge in the header)
- **Repository:** https://github.com/Regen-Bazaar/regenbazaar-beta (branch `feat/arbitrum-buildathon`)
- **How to try:** connect a wallet on Arbitrum Sepolia (needs a little test ETH), open Marketplace, click
  "Get 100 test tUSDG", then "Fund this impact".

## Main contract addresses (Arbitrum Sepolia, chainId 421614)
All source-verified on Blockscout (https://arbitrum-sepolia.blockscout.com).

| Contract | Address |
|---|---|
| RegenPrimarySale (voucher sale, lazy mint, stablecoin payments) | `0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030` |
| tRWI (ERC-1155, UUPS proxy) | `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` |
| tRWI implementation | `0x6446Cf9161F58A3FadEf2f3711265054c5DA84aC` |
| RegenMarketplace (secondary, escrow, capped royalty) | `0x3Cd225C24183a7bcE3EefD3C309b82A27f6Be214` |
| TRWIStaking (stake tRWI, earn REBAZ) | `0xB051e3B360A54e6E4808A2A06bEC765D246612B6` |
| REBAZ (ERC-20, capped) | `0x5Ea6AE9758472733144Eb24CCE7f310B21367b92` |
| EAS | `0x95cD0E3bDbC670e057416D65C89B584a9a24d95d` |
| SchemaRegistry | `0xa5dB5eC4d2F1435f7cb3504414981347E28340b4` |
| AuthorizedAttesterResolver | `0xA4B19AA834Db5cF19AcA0D3bcD0b1340e9c6abB1` |

**Token / factory addresses:** tRWI `0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da` (ERC-1155; collections are
created by `RegenPrimarySale` on first redeem, no separate factory). REBAZ
`0x5Ea6AE9758472733144Eb24CCE7f310B21367b92`. Payment tokens: Paxos USDG
`0xFFC95faa3d63Cde504a05B567C600B78C0b41892` (allowlisted), tUSDG `0x738B0C655E050320764EA1A7191BEA226B053410`
(testnet stand-in, allowlisted).

**Proof transactions:**
- Purchase through the live app (2 editions for 1.245 tUSDG):
  https://arbitrum-sepolia.blockscout.com/tx/0x9b4a1d72107faf1dcc218754e3e3a419a34f31c92fde71d60a496166cd65ceb5
- Scripted end-to-end (attest, voucher, approve, redeem, 10 editions):
  https://arbitrum-sepolia.blockscout.com/tx/0xc6cc5d5c0281b969a33f50918774a21d0fa4beef53d93f2fd0717f62927590aa

## USDG (Paxos) integration
- Paxos USDG on Arbitrum Sepolia (`0xFFC9…1892`, 6 decimals) is allowlisted in `RegenPrimarySale` at deploy
  (`ALLOWED_CURRENCY`), and the app prices listings in USDG units and runs the ERC-20 approve + redeem flow.
- Honest note: the Paxos testnet faucet has not dispensed USDG since 2026-09-22 (no outgoing transfers from
  the faucet address on-chain), so we could not fund a test buyer. The live demo therefore sells in `tUSDG`, a
  testnet stand-in with the same ERC-20 interface and decimals, clearly labelled "not Paxos" on-chain and in
  the UI. Switching the demo to real USDG is one config value plus a rebuild; the contract already accepts it.

## What was built during the buildathon (since 2026-09-14)
Regen Bazaar existed before the buildathon (impact engine, Celo Sepolia contracts, hardening audit in June
2026). Everything below was built for Arbitrum during the buildathon; all commits dated 2026-09-24 on
`feat/arbitrum-buildathon`:

| Commit | What |
|---|---|
| [fb1d2ff](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/fb1d2ff) | Arbitrum Sepolia RPC and ERC-20 (USDG) allowlist in the deploy script |
| [b98bc3f](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/b98bc3f) | Per-chain listings (`chain_id`, unique per chain) so networks share one database |
| [00d4f75](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/00d4f75) | Network registry in the web app, Arbitrum Sepolia, stablecoin payment with approve |
| [9b6b816](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/9b6b816) | Indexer chain from config; fix for a Ponder schema crash loop; capped restarts |
| [0a3a877](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/0a3a877) | Deployment of all contracts to Arbitrum Sepolia, verified on Blockscout |
| [86eee42](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/86eee42) | tUSDG testnet stand-in, allowlisted and verified; end-to-end redeem proven |
| [ca6295d](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/ca6295d) | USDG / tUSDG switch and in-app test-token mint for demo buyers |
| [b3497a8](https://github.com/Regen-Bazaar/regenbazaar-beta/commit/b3497a8) | Live app on Arbitrum Sepolia with TLS; live purchase recorded |

Built before the buildathon (not claimed): the Impact-Value engine, AI extraction pipeline, the v3 contract
set and its security/gas audit (`docs/AUDIT.md`), and the Celo Sepolia deployment.

## Smart contract quality notes
- Solidity 0.8.29, OpenZeppelin 5 (AccessControl, Pausable, ReentrancyGuard, SafeERC20, UUPS, ERC20Capped),
  EAS. 61 Foundry tests including fuzz tests; self-audit with Slither in `docs/AUDIT.md`.
- Role separation (signer, attester, upgrader, pauser, admin) with an optional handoff to a multisig; the
  deployer is not a tRWI minter; only `RegenPrimarySale` can mint.
- EIP-712 vouchers with deadline and per-token nonce; fee and royalty are signed fields; currency allowlist
  blocks fee-on-transfer tokens; royalty capped at 10%; metadata immutable after registration.
- Not externally audited. Testnet only.

## Sponsor technologies (checkboxes)
- [x] **Paxos / USDG** (allowlisted payment token, see note above)
- [x] **OpenZeppelin** (contracts library)
- [ ] GMX, Robinhood Chain, Dune, ZeroDev, Fhenix, Alchemy, AWS: not used

## Team
[?] Solo / team: заполнить (Paul Burg, роль, контакты).

## What's next
- Embedded wallets and gasless onboarding for non-crypto funders.
- Calibrate Impact-Value weights with domain experts (currently platform-assessed, not third-party certified).
- Multisig + timelock, external audit, then Arbitrum One.

---

## 2-minute video script (if the form asks for one)

| Time | Screen | Voice-over |
|---|---|---|
| 0:00-0:15 | Landing page | "Small NGOs do real, measurable good, but funders can't buy or verify it. Regen Bazaar turns verified impact into on-chain assets you can fund in stablecoins, on Arbitrum." |
| 0:15-0:40 | /tokenize: paste an impact description, show extracted actions and Impact Value | "An NGO describes its work in plain language. Our engine extracts the actions and computes a deterministic Impact Value. The weights are published and platform-assessed." |
| 0:40-1:00 | /verify: approve | "A validator approves. The platform pins the metadata to IPFS and attests the claim with EAS on Arbitrum Sepolia." |
| 1:00-1:35 | /marketplace: Get test tUSDG, Fund this impact, wallet approve + confirm, tx link | "A funder picks an impact, pays in a USDG-compatible stablecoin, and the tRWI editions are minted to them in the same transaction. The NGO is paid directly." |
| 1:35-1:50 | Blockscout: verified RegenPrimarySale, the redeem tx | "All contracts are open source and verified. USDG is allowlisted; the demo uses a labelled stand-in while the Paxos faucet is down." |
| 1:50-2:00 | Logo + URL | "Regen Bazaar: fund real impact, verifiably. app.regenbazaar.com." |
