# Smart-contract design: tRWI issuer, sale and attribution (v3 + RegenPrimarySale v2)

_The settled design that runs today. Terms follow `docs/POSITIONING.md`. Security review: `docs/AUDIT.md`._

## The model: platform-issued, lazy-minted, open resale
When a creator's verified impact is tokenized on Regen Bazaar:
- **Regen Bazaar is the on-chain issuer.** On-chain a wallet is just an address; nothing proves who stands
  behind it. So the platform's authority (a validator checked the proof, the methodology scored it) is what
  carries weight. The **creator** (an NGO, an informal group or an individual) is recorded as `creator` from the
  immutable EAS attestation and is the payout `beneficiary`. The beneficiary can be a personal wallet.
- **Lazy mint:** nothing is minted until a buyer buys. No gas before the first sale; the creator needs no
  transaction to list. A tokenized impact is a *collection* of `maxEditions` (100 today) editions; `totalIV` is
  split across them.
- **Vouchers:** the platform signs an EIP-712 voucher (price, currency, beneficiary, fees, royalty, deadline,
  nonce); the buyer redeems it to pay and mint editions to themselves.
- **Open resale:** once held, a tRWI is a normal ERC-1155, resellable through our escrow marketplace (no
  transfer restriction). A buyer can also retire editions (burn them) to keep the impact permanently in their name.

## Networks
Three testnets, one listing per report on exactly one network:

| Network | Chain id | Record |
|---|---|---|
| Arbitrum Sepolia | 421614 | `packages/contracts/deployments/arbitrum-sepolia.json` |
| Robinhood Chain testnet | 46630 | `packages/contracts/deployments/robinhood-testnet.json` |
| Celo Sepolia | 11142220 | `packages/contracts/deployments/celo-sepolia.json` |

The v3 suite was deployed on Arbitrum Sepolia and Robinhood on 2026-09-24 with the same deployer and nonce
sequence, so those contracts share addresses on both chains. Celo Sepolia runs the same v3 code at its own
addresses. RegenPrimarySale v2 was deployed on 2026-10-06 at a **separate address on each network** (field
`primarySaleV2` in each record); the v1 sale contracts had their TRWI mint rights revoked the same day.

## Contracts (v3)
- **TRWI** (ERC-1155 + ERC-2981, UUPS proxy): the token. `mint()` is limited to `MINTER_ROLE`, held only by
  RegenPrimarySale v2. A collection is registered on its first mint and **anchored to the EAS attestation**: the
  creator, `totalIV` and `metadataURI` must equal the attestation, so the token cannot contradict the verified
  impact. The royalty is stored at that first mint (capped at 10%). `impactValueOf` uses `maxEditions` as the
  denominator; `retiredEditions = minted − supply`. Metadata is immutable.
- **RegenPrimarySale v2**: primary sale. Holds `SIGNER_ROLE`. `redeem(voucher, amount, sig)` checks the EIP-712
  signature (domain version "2"), `deadline` and per-token `nonce`, takes the payment, splits it and calls
  `TRWI.mint(buyer)`. `bumpNonce(tokenId)` cancels outstanding vouchers (reprice or delist).
- **RegenMarketplace**: resale escrow. The seller escrows editions and sets the price; on a sale it pays the
  marketplace fee (2.5%), the ERC-2981 royalty (capped at 10%) and the rest to the listing's beneficiary (normally the seller). Native
  coin or ERC-20.
- **EAS + AuthorizedAttesterResolver**: provenance. Only `ATTESTER_ROLE` can attest the ImpactClaim schema
  (`address ngo, uint256 impactValue, string metadataURI`; the `ngo` field holds the creator's wallet, whoever the
  creator is).
- **REBAZ + TRWIStaking**: capped utility token (1,000,000,000) and staking of tRWI for REBAZ. Testnet only; no
  promise of rewards to anyone in public texts.

## Money split
**Primary sale (live, RegenPrimarySale v2), one transaction:**
- platform fee `feeBps`: 2.5% (contract cap 10%);
- optional partner share `partnerFeeBps` to `partner`, when the impact came through a partner such as DeCleanup:
  fixed when the partner is created, contract cap 10% for the partner and 15% for platform plus partner;
- the rest to the creator's `beneficiary`: 97.5%, or 95% with a 2.5% partner.

All three are signed into the voucher, so nobody can change the split between signing and payment. No partner
registry lives on-chain; adding a partner needs no contract change. A `PartnerPaid` event records each partner
payment.

**Resale (RegenMarketplace):**
- today: 2.5% marketplace fee to Regen Bazaar, creator royalty via ERC-2981 (2.5% for collections first minted
  from 2026-10-07; collections minted earlier keep 5%), the rest to the listing's beneficiary;
- planned: creator 2.5%, Regen Bazaar 2.5%, partner 2.5%. The partner part needs a new RegenMarketplace version,
  because **ERC-2981 names only one royalty receiver per token**: the royalty can go to the creator or the
  partner, not both. The marketplace will have to read the partner itself and pay it as a separate share.

## Price (off-chain, methodology v0.2)
Price in USD = IV × rate × P × E, split across editions, then converted to the sale currency.
IV is the Impact Value (the main weight); the rate is $1 per IV point for now; P is the proof factor from the
proof level set by a validator (P1 0.6 to P4 1.0, P0 not listed); E is the cost coefficient from 1.0 to 1.5 from
the creator's declared costs. Reports scored under v0.1 keep their old score and price. The contracts only see
the final `pricePerEdition` in the voucher.

## Long-term hardenings (built in)
1. Sale logic is **separate from the token**: a smaller attack surface, and sale mechanics can change (as with
   v2) without touching the asset.
2. Voucher **`deadline` + per-token `nonce`**: safe reprice and delist.
3. **EAS is the source of truth**: TRWI re-checks the attestation on register, so a leaked signer key alone
   cannot invent impact.
4. **Signer, attester and admin are separate roles**; all move to a multisig before mainnet (today one testnet
   key holds them).
5. Fee caps are constants in the contract, and the server refuses a partner the contract would reject.
6. All contracts are pausable.

## End-to-end flow (proven live on all three testnets, partner split included; see `docs/AUDIT.md`)
submit → AI extraction + v0.2 score → validator sets the proof level and approves → platform **EAS-attests**,
pins metadata to IPFS and registers a **listing** (no mint) → buyer connects a wallet → fetches a signed
**voucher** → **redeem** (pays; mints editions; fee to the platform, partner share to the partner, the rest to the
creator) → **indexer** records it. Resale through the escrow marketplace.

## Out of scope (later)
Partner share on resale (new marketplace version); transfer restriction (forced royalties); gasless onboarding
for non-crypto buyers; multisig keys and timelock (before mainnet); external audit; third-party accredited
verification.
