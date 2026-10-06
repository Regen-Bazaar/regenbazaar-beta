# Smart-contract security audit & mainnet-readiness remediation

_Date: 2026-06 · Branch: `harden/mainnet-readiness` · Scope: `packages/contracts/src/*.sol` + `script/Deploy.s.sol`_

## Scope & method

Six contracts on **Celo Sepolia** (chainId 11142220), OpenZeppelin 5.1.0, solc 0.8.29, Foundry:
`TRWI` (ERC-1155 UUPS), `RegenPrimarySale` (EIP-712 voucher lazy-mint), `TRWIStaking`,
`RegenMarketplace`, `REBAZ` (ERC-20), `AuthorizedAttesterResolver` (EAS gate).

Method: manual line-by-line review against the **OWASP Smart Contract Top 10** and **EEA EthTrust
Security Levels** (which supersedes the frozen SWC Registry); **Slither** static analysis (before/after);
the **OpenZeppelin Contracts MCP + Skills** ruleset (agent toolchain — see `.mcp.json`); full Foundry test
suite incl. new adversarial cases.

Authoritative agent tooling used / configured:
- OpenZeppelin Contracts MCP — `mcp.openzeppelin.com` (wired in `.mcp.json`; activates on session reload).
- OpenZeppelin Skills — `github.com/OpenZeppelin/openzeppelin-skills`.
- Slither 0.11.4 (`pipx`/pip), `forge test`, `forge coverage`.

## What was already solid (kept intact)

UUPS implementation locked via `_disableInitializers()` ([TRWI.sol](../packages/contracts/src/TRWI.sol))
with a storage `__gap`; `nonReentrant` on every state-changing entry; SafeERC20; EIP-712 domain with
chainId; malleability-safe `ECDSA.recover`; EAS attestation anchoring as the source of truth; custom errors.

## Findings & remediation

| # | Sev | Finding | Status | Fix |
|---|-----|---------|--------|-----|
| H1 | High | Single-key trust root: deployer EOA = admin + minter + signer + attester + feeRecipient + treasury, could self-grant upgrader. | **Fixed** | `Deploy.s.sol` now reads separate addresses (`ADMIN_MULTISIG`/`SIGNER_ADDR`/`ATTESTER_ADDR`/`UPGRADER_ADDR`/`PAUSER_ADDR`/`FEE_RECIPIENT`/`TREASURY`), grants `UPGRADER_ROLE`+`PAUSER_ROLE` explicitly, **removes the deployer-EOA `MINTER_ROLE` grant**, and offers a guarded admin→multisig handoff (`RENOUNCE_DEPLOYER_ADMIN`). |
| H2 | High | Stuck-stake fund lock: `unstake()` returned the NFT only after `rebaz.mint()`; a revoked/capped minter trapped the tRWI. | **Fixed** | New `emergencyUnstake()` returns principal with **no reward mint**, always callable (bypasses lock while paused). Test: `test_EmergencyUnstake_AfterMinterRevoked`. |
| M1 | Med | Retroactive reward rate: a rate change repriced already-elapsed time. | **Fixed** | Global cumulative index `rewardIndex` (Σ rate·seconds); `setBaseRewardRate` settles first → never retroactive. Tests: `test_RateChange_NotRetroactive`, `test_TwoStakers_StaggeredNotDiluted`. |
| M2 | Med | Platform fee not in the signed voucher; admin could change the NGO/buyer split after signing. | **Fixed** | `feeBps` added to the `Voucher` struct + `VOUCHER_TYPEHASH`; the split is now signed. Test: `test_TamperedFeeBps_RevertsBadSignature`. ⚠ **Cross-boundary** — see below. |
| M3 | Med | Uncapped REBAZ minting (unbounded inflation). | **Fixed** | `REBAZ` now extends `ERC20Capped` with a constructor cap (default 1B). Test: `test_REBAZ_MintPastCap_Reverts`. |
| M4 | Med | No pause anywhere; 5/6 contracts immutable. | **Fixed** | `Pausable` + `PAUSER_ROLE` on sale/marketplace/staking/TRWI. Entry paths gated (`redeem`/`buy`/`list`/`stake`/`mint`/`claim`/`unstake`); principal-exit paths always open (`emergencyUnstake`/`cancel`/`retire`). Test: `test_Paused_BlocksEntry_AllowsExit`. |
| M5 | Low | Royalty: only ERC-2981's 100% ceiling + a binary clamp; a high royalty could starve secondary beneficiaries. | **Fixed** | `MAX_ROYALTY_BPS = 1000` enforced at TRWI registration; marketplace uses a **proportional** cap (`min(royalty, 10%·total)`). Test: `test_Royalty_CappedAtMax`. |
| M6 | Med | `setURI` admin-mutable post EAS-anchor; metadata could drift from the attestation. | **Fixed** | `setURI` removed; metadata is immutable post-registration (a change requires a new attestation). |
| L1 | Low | Fee-on-transfer / rebasing ERC-20s break pay-in/pay-out accounting. | **Fixed** | Admin currency allowlist in sale & marketplace (NATIVE always allowed). Tests: `test_NonAllowlistedCurrency_Reverts` (both). |
| L2 | Low | `_userStakes` never pruned (unbounded view). | **Fixed** | Switched to `EnumerableSet.UintSet`; entries removed on unstake/emergencyUnstake. |
| L3 | Info | CEI: `stake()`/`list()` transferred before state writes (not reachable — ERC-1155 has no sender hook). | **Fixed** | Reordered so external transfers run last. Confirmed: Slither `reentrancy-benign` on `list`/`stake` cleared. |
| G | Gas | `unchecked` on proven-safe math; struct packing. | **Done** | `unchecked` on `c.minted += amount` (post-cap). Reward math multiplies-before-dividing (no precision loss). |

## Slither triage (after remediation)

`reentrancy-benign` on `list`/`stake` (present in baseline) is **gone**. Remaining detectors are not actionable:
- `incorrect-exp`, `divide-before-multiply`, `shadowing-local` → all inside **`lib/` (OZ `Math.mulDiv`,
  `ERC20Permit`)** — known false positives in audited code.
- `arbitrary-send-eth` on `_pay` → **by design**: pays the signed `feeBps`/`beneficiary` (sale) or the
  escrow listing's beneficiary/creator (marketplace), behind `nonReentrant` + CEI.
- `reentrancy-events` on `TRWI.mint`/`retire` → events after `_mint`/`_burn`; state already updated, `mint`
  is `MINTER_ROLE`-only (the nonReentrant sale). Informational.
- `unused-return` on `EnumerableSet.add/remove` → intentional.
- `locked-ether` on `AuthorizedAttesterResolver` → inherited from EAS `SchemaResolver` (payable base); the
  resolver is not designed to hold funds.

## Tests

`forge test` → **55 passed, 0 failed** (45 pre-existing + 10 new adversarial). Coverage on changed
contracts: 80–87% lines (TRWIStaking 87%, REBAZ 100%). New tests cover: emergency exit after minter revoke,
non-retroactive rate + staggered two-staker accrual, pause-blocks-entry/allows-exit, lock-bypass-when-paused,
tampered-feeBps signature rejection, royalty cap, currency allowlist, REBAZ cap.

## ⚠ Cross-boundary handoff (MUST land together with redeploy)

Adding `feeBps` to the voucher changed `VOUCHER_TYPEHASH`. The off-chain signer **and** frontend EIP-712
types must add `feeBps` (type `uint96`) **in the same position (after `royaltyBps`, before `nonce`)** or
every `redeem` reverts `BadSignature`. Touch points:
- `apps/web/src/lib/onchain.ts` — `ImpactVoucher` type + EIP-712 `types.Voucher` array + contract address.
- `apps/web/src/app/api/listings/[id]/voucher/route.ts` — set `feeBps` on the voucher.
- `apps/web/src/components/BuyButton.tsx`, `apps/indexer/src/abis.ts` — refresh ABIs (regenerate from
  `packages/contracts/abis/*` after the new build).

These were intentionally **not** changed now: the live frontend still targets the currently-deployed
(pre-remediation) contracts and must switch only when the new set is deployed.

## Deployment status

Pre-remediation contracts remain live on Celo Sepolia (see `broadcast/`/`deployments/`). Because 5/6 are
immutable, the fixes require a **fresh full redeploy with split roles** (recommended over a TRWI-only
upgrade). The deploy is **gated on explicit approval** — not performed as part of this audit. Recommended
order: deploy with multisig env set → wire roles → `setCurrencyAllowed` for accepted stablecoins → update
frontend/signer EIP-712 + addresses → verify on Celoscan → optional `RENOUNCE_DEPLOYER_ADMIN=true`.

## 2026-09-27: RegenPrimarySale v2, partner share

**Change.** The signed voucher gains `address partner` and `uint96 partnerFeeBps`; the EIP-712 domain version
is `"2"`. `redeem` pays platform fee, partner share and beneficiary remainder in one transaction and emits
`PartnerPaid` when the partner share is non-zero. No partner registry on-chain: partners and rates live in the
signed voucher, so a new partner needs no contract change.

**Checks.** `feeBps <= 1000`, `partnerFeeBps <= 1000`, `feeBps + partnerFeeBps <= 1500` (15% owner cap),
`partner == 0` requires `partnerFeeBps == 0`. Both shares round down; the remainder goes to the beneficiary.
`_voucherStructHash` concatenates three `abi.encode` chunks (all fields are one word each) to avoid
stack-too-deep; `test_HashVoucher_MatchesTypedData` checks it against an independent EIP-712 computation.

**Tests added (14):** three-way split in native and ERC-20; no partner pays nothing and emits no `PartnerPaid`;
15% at the limits passes; partner above 10%, total above 15%, fee without partner all revert; tampered partner
or partner fee fails the signature; a v1-domain signature fails; a partner that rejects payment reverts the
whole redeem with no partial payouts; a re-entering partner is blocked; fuzz: the three payouts always sum to
the price and the beneficiary gets at least 85%. `forge test`: 75 passed.

**Residual risk.** A partner address that cannot receive native currency blocks sales of that listing (the
server should refuse such partners, or use ERC-20 listings). A partner contract can spend gas in `receive`;
bounded by the buyer's gas limit, no funds at risk under `nonReentrant`.

**Not deployed.** `RegenPrimarySale` is not upgradeable: v2 is a new deployment. The frontend still signs v1
vouchers for the live contracts. Must land together with the redeploy: `apps/web/src/lib/onchain.ts`
(`types.Voucher`, address), `apps/web/src/app/api/listings/[id]/voucher/route.ts`, `apps/web/src/lib/chain.ts`
(redeem ABI tuple), `apps/web/src/components/BuyButton.tsx`, regenerated `packages/contracts/abis/`. Order:
deploy v2 → `setCurrencyAllowed` → `MINTER_ROLE` on TRWI → `SIGNER_ROLE` → switch web → test purchase with and
without partner → revoke `MINTER_ROLE` from v1.

### 2026-10-06: web side of the partner share (A3–A5, not switched on)

**Change.** `partners` table (name, payout address, share in bps, active) and `listings.partner_id`
(migration `0005_partners.sql`). Each network carries `primarySaleVersion` (1 or 2) next to `primarySale`
in `apps/web/src/lib/networks.ts`; all networks stay on 1, so merging this changes nothing on-chain. The
signer (`onchain.ts`) picks the EIP-712 domain and field list from that version; a v1 signature is
byte-identical to the previous code. The voucher route adds `partner` / `partnerFeeBps` and `version`;
`BuyButton` and `scripts/buy-via-api.ts` send the matching tuple (`redeemAbiV1` / `redeemAbiV2`).
A validator attaches a partner at approval with an optional `partnerId` in `POST /api/verifications`.
The submission page shows the split (creator, partner, platform); marketplace cards show it when a partner
is attached.

**Server checks (mirror the contract).** Partner share 1–1000 bps, platform + partner ≤ 1500 bps, non-zero
payout address, partner active. A listing with a partner is refused (409) on a v1 network instead of being
sold without the partner's share. A partner address with contract code is refused for native-currency
listings (residual risk above).

**Verified (local anvil, throwaway chain).** Server v2 signature recovers the operator through the deployed
v2 `hashVoucher`; tampered `partnerFeeBps` does not; v1 signature identical to the old field list; v1 with a
partner throws; `redeemAbiV2` matches the regenerated contract ABI; `forge test` 75 passed.

**Switch (A6, needs the owner's yes).** Deploy v2 per network → `setCurrencyAllowed` → `MINTER_ROLE` on
TRWI → `SIGNER_ROLE` to the operator → set `primarySale` to the v2 address and `primarySaleVersion: 2` →
update the indexer's RegenPrimarySale address (the `Sold` event is unchanged; `PartnerPaid` is new) →
apply migration 0005 → test purchase with and without partner (`scripts/test-v2-flow.ts` with
`PARTNER` / `PARTNER_FEE_BPS`) → revoke `MINTER_ROLE` from v1. Unsold v1 listings keep working after the
switch: vouchers are signed fresh on each purchase.

### 2026-10-06: v2 live on all three testnets

v2 deployed with `script/DeployPrimarySaleV2.s.sol` (addresses in `deployments/*.json`, `primarySaleV2`), web
switched (PR #52), migration 0005 applied by the migrate container, indexers read v1 + v2 (`PRIMARY_SALE_ADDRESS`
comma list, schemas `indexer_arbsep_v3` / `indexer_rh_v2`). Checks: Celo Sepolia redeem with a 5% partner paid
the partner exactly 5% (`PartnerPaid`); live-app purchase on Arbitrum Sepolia through the voucher API; v1
`MINTER_ROLE` revoked on all three. Rollback: image `regenbazaar_web:pre-partner`, `.env.bak-pre-partner-20261006`,
DB dump `/root/regenbazaar-backups/regenbazaar-pre-partner-20261006.sql` (v1 would need its MINTER_ROLE back).
Open: Arbitrum Sepolia Blockscout source verification (API behind a Cloudflare challenge).
