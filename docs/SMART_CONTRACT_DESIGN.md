# Smart-contract design — tRWI minter / custody / attribution (v2)

_The decision and the architecture we shipped. Full options analysis is in the build plan; this is the
settled design._

## The model: platform-issued, lazy-minted (A + C), open secondary
When an NGO tokenizes impact through RegenBazaar:
- **RegenBazaar is the on-chain issuer/minter.** On-chain a wallet is just an address (no name proves it's
  an NGO); most NGOs are unknown; corporate buyers require third-party accredited verification anyway. So the
  *platform's* authority (we verify, score, and stand behind the impact) is what carries weight — not an NGO
  wallet address. The NGO is still recorded as the `creator` (from the immutable EAS attestation) and is the
  payout beneficiary.
- **Lazy mint:** nothing is minted until a buyer buys. No pre-sale gas; NGOs need no wallet to tokenize. A
  tokenized impact is a *collection* of `maxEditions` (N) fractional shares; `totalIV` is split across N.
- **Vouchers:** the platform signs an EIP-712 `ImpactVoucher` (commercial terms); the buyer redeems it to pay
  and lazily mint editions to themselves.
- **Open secondary:** once held, a tRWI is a normal ERC-1155 — resellable via our escrow marketplace (no
  transfer restriction).

## Contracts (Celo Sepolia)
- **TRWI** (ERC-1155 + ERC-2981, UUPS) — the token. `mint()` is gated to `MINTER_ROLE` (the sale contract).
  A collection is registered on its first mint and **anchored to the EAS attestation**: the params
  (`creator==ngo`, `totalIV==impactValue`, `metadataURI`) must equal the attestation, so the token can't
  contradict the verified impact. `impactValueOf` uses `maxEditions` as the denominator;
  `retiredEditions = minted − supply`.
- **RegenPrimarySale** — primary sale. Holds `SIGNER_ROLE`. `redeem(voucher, amount, sig)` verifies the
  EIP-712 signature + `deadline` + per-token `nonce`, pulls payment, splits **platform fee + NGO beneficiary**,
  and calls `TRWI.mint(buyer)`. `bumpNonce(tokenId)` invalidates outstanding vouchers (reprice/delist).
- **RegenMarketplace** — secondary escrow (lister escrows editions; on buy, fee + ERC-2981 royalty +
  beneficiary; native or ERC-20).
- **EAS + AuthorizedAttesterResolver** — provenance: only `ATTESTER_ROLE` can attest the ImpactClaim schema.
- **REBAZ + TRWIStaking** — utility token + stake tRWI → REBAZ.

## Long-term hardenings (built in)
1. Sale logic (RegenPrimarySale) is **separate from the token** — smaller attack surface; swap sale mechanics
   without touching the asset.
2. Voucher **`deadline` + per-token `nonce`** → safe reprice/delist.
3. **EAS is the source of truth** — TRWI re-checks the attestation on register, so a leaked SIGNER alone can't
   fabricate terms.
4. **SIGNER ≠ ATTESTER ≠ admin** keys (defense in depth). All → multisig/MPC before mainnet.
5. Correct lazy-mint accounting (`minted` tracked separately; `retired = minted − supply`).
6. Pricing is off-chain by formula (IV × rate); listing currency → stablecoin recommended for value stability.

## End-to-end flow (proven live on Celo Sepolia)
submit → AI Impact-Value score → human verify → platform **EAS-attests** + pins metadata to IPFS + registers
an off-chain **listing** (no mint) → buyer connects wallet → fetches a platform-signed **voucher** →
**redeem** (pays; lazily mints editions; fee → platform, rest → NGO) → **indexer** records it → marketplace /
dashboards read the index. Secondary resale via the escrow marketplace.

## Deployed addresses (v2)
See `packages/contracts/deployments/celo-sepolia.json` (verified on Blockscout). Key:
TRWI `0x796B521EBF9221A0f4212C10767898AfCd81087d`, RegenPrimarySale
`0x49A5a77e3DBd76411737820fd968142b6154be26`, RegenMarketplace
`0x09c0cbB98Dbb0E37B684abF33e7Beac7f62B4A21`.

## Out of scope (later)
Transfer restriction (forced-secondary royalties); gasless/AA for non-crypto buyers; custodial proceeds
ledger for wallet-less NGOs; multisig keys (before mainnet); 3rd-party accredited verification (corporate tier).
