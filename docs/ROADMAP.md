# Regen Bazaar roadmap

Living document. Status as of 2026-09-25: public beta on Arbitrum Sepolia and Robinhood Chain testnet
(https://app.regenbazaar.com). Order within a section is priority order. Nothing here is committed to a date.

## Now (beta, testnets)
- [x] Contracts deployed and source-verified on Arbitrum Sepolia and Robinhood Chain testnet
- [x] USDG checkout (Paxos USDG; labelled tUSDG stand-in on Arbitrum Sepolia while the Paxos faucet is down there)
- [x] One site, visitor-selected network; approve lists on every network; one listing per report per network
- [x] LLM extraction (model chosen by eval), content moderation, rate limits, validator-only approvals
- [x] Generative tRWI artwork pinned to IPFS as the token image
- [x] Buyer "My impact" page, guide, duplicate hints for validators
- [ ] Public testing with the community; collect feedback and fix what confuses people

## Next: trust and verification
**Impact methodology**
- Calibrate Impact Value weights against established standards with domain experts
- Express selected actions in physical units (for example tCO₂e for restoration); keep versioned scoring
- Fix known weight imbalances (for example hectares restored vs seedlings planted)

**Double counting and evidence**
- Required evidence: geotagged, dated photos; the AI checks that evidence matches the report
- Semantic similarity check across all reports (not only exact matches)
- Community verification: several independent confirmations; validators have something at stake for false
  approvals
- Cross-registry checks so the same work is not sold on two platforms (Hypercerts and other registries)
- Revocation flow: revoke the EAS attestation and delist if a claim turns out to be false

## Next: organisations (NGO experience)
- Organisation profile page: name, country, website, mission, all reports, total funded
- Several people per organisation with roles (owner, editor, viewer); admin tools for the platform team
- Sign-in by email or Telegram with an embedded wallet created for the NGO (no crypto knowledge needed);
  existing wallets still supported
- Proof of wallet control (signature) before an organisation can edit its profile or change its payout wallet
- Payout options suitable for NGOs without crypto experience

## Next: funders
- Mobile wallets without the MetaMask in-app browser (WalletConnect or embedded wallets)
- Gasless checkout (sponsored transactions) so funders only need the stablecoin
- Card or fiat on-ramp for people without crypto
- Receipts and impact certificates to share; "My impact" history across networks
- Secondary market UI on the existing RegenMarketplace contract (capped royalty back to the NGO)
- Staking tRWI for REBAZ (contract exists; UI not built)

## Platform
- Network switcher polish; add networks only where a stablecoin and real demand exist
- AI-agent buyers: richer public API and documentation for programmatic funding
- Analytics for NGOs and funders; public impact dashboard

## Mainnet readiness
- External security audit of the contracts
- Admin roles moved to a multisig with a timelock; separate operator, signer and attester keys
- Emission model for REBAZ from a funded reserve instead of mint-on-claim
- Legal review of the tRWI model per jurisdiction; terms of use and privacy policy
- Mainnet launch with real partner reports (pilot partners first, with their consent)
