# Regen Bazaar: positioning and terms

The source of truth for every text about Regen Bazaar: app, landing, docs, grant applications, posts.
Owner decisions 2026-10-07. When a text disagrees with this page, the text is wrong.

## What Regen Bazaar is

Regen Bazaar is a marketplace for impact that has already happened. A creator reports work they have done, a
validator checks the proof, and the verified impact is listed as tRWI editions. Buyers purchase those editions.
Each purchase pays the creator directly, in the same transaction.

It is not a donation platform and it does not pre-fund projects. Buyers pay for delivered results, not for
promises.

## How impact gets funded

Funding happens indirectly, after the result:

1. **Incentive.** A creator who can sell finished impact has a reason to do more: "I did it, I sold it, I earned
   from it, why not continue."
2. **Means.** The income gives the creator more money and time for the next piece of work.

One sentence for any text: *"You buy impact that already happened. The money goes straight to the people who
created it, and that is how more impact gets funded: after the result, not before."*

"Fund impact" is acceptable only in this indirect sense. Never "donate", "back a project", "support a
campaign", or "fund a proposal".

## Money flow

| Sale | Creator | Regen Bazaar | Partner (if the impact came through one) |
|---|---|---|---|
| Primary sale | the rest: 97.5%, or 95% with a partner | 2.5% platform fee | 2.5% (e.g. DeCleanup) |
| Resale (planned) | 2.5% royalty | 2.5% marketplace fee | 2.5% |

All shares are paid on-chain in the same transaction (RegenPrimarySale v2 on all three testnets since
2026-10-06). Regen Bazaar and partners such as DeCleanup are non-profit or volunteer projects; these shares are
their running income. Partner caps: partner at most 10%, platform plus partner at most 15%. A partner's share is
fixed when the partner is created. Creators receive no extra platform bonus on a sale; partner rewards (such as
DeCleanup's cDCU) are earned on the partner's side and are not paid again for selling.

## Terms

- **Creator.** Whoever delivered the impact: an NGO, an informal group or an individual. The payout can go to a
  personal wallet. Use "creator" in all texts; "NGO" only when a specific organisation is meant. In contracts the
  creator's wallet is called `beneficiary` / `creator`.
- **Buyer.** A person, company or AI agent that purchases editions. Not "funder", "donor" or "backer".
- **Validator.** A person who checks the proof, sets the proof level and the environmental sensitivity, and
  approves the report. Today the Regen Bazaar team; later a community of validators. Not "reviewer" or "admin"
  in public texts.
- **Partner.** An organisation that brought or verified the impact (e.g. DeCleanup) and receives a fixed share
  of each sale.
- **tRWI.** Tokenized real-world impact: one collection per verified report, attested on-chain (EAS), listed on
  exactly one network.
- **Edition.** One share of a tRWI. A report is split into editions (100 today); a buyer can buy one or more.
  Editions are minted to the buyer at purchase.
- **Listing.** One verified report offered for sale on one network. Not "lot" in public texts.
- **Impact Value (IV).** Regen Bazaar's own relative index (methodology v0.2): the sum of domain scores. Not a
  certification, not a credit, not an offset, and not a common unit to compare categories.
- **Proof level (P0 to P4).** How well the work is evidenced, set by a validator. P0 is not listed. It adjusts
  the price; it never changes the Impact Value.
- **Price.** In US dollars: Impact Value × rate × proof factor × cost coefficient E. IV is the main weight. E is
  1.0 to 1.5 from the costs the creator declares; costs never set the price on their own.
- **Retire.** The buyer keeps an edition permanently: it is burned, can never be resold, and the chain records
  that this buyer retired it. Use when a buyer wants to count the impact as theirs for good (for example in a
  company report). Wording: "retire it in your name". Not "claim the impact" or "offset".

## Words to avoid

- Fund, funder, funded, donate, donor, back, backer (except the indirect sense above).
- Offset, carbon neutral, climate positive, CO₂ saved, carbon credit (EU Directive 2024/825 on green claims).
  Partner figures such as tonnes of CO₂ are quoted as the partner's own estimate.
- Certified, guaranteed, audited impact (Impact Value is our own index).
- "Comparable" across impact categories.
- Token price, yield, returns, investment for buyers.

## Validator rewards

Not designed yet. An earlier plan used the REBAZ token for validator rewards; that needs separate work (token
model, legal, incentives). Tracked as an open task in `docs/KNOWN_ISSUES.md`; do not promise rewards in public
texts.
