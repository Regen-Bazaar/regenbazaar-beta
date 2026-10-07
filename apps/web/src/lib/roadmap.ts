// Public roadmap: single source for the /roadmap page and docs/ROADMAP.md (scripts/roadmap-md.ts renders it).
// Rules: no dates, no token mechanics, no traction claims. Order = priority. `grant` marks fundable milestones.

export interface Phase {
  id: string;
  title: string;
  goal: string;
  status: "done" | "now" | "next" | "later";
  grant?: boolean;
  items: string[];
  doneWhen: string[];
}

export const ROADMAP_INTRO =
  "Regen Bazaar turns verified real-world impact into tRWI tokens that anyone can buy in a stablecoin, with the " +
  "creator paid in the same transaction. This roadmap is ordered by priority, has no dates, and marks the " +
  "milestones we would take on with grant funding. Everything today runs on test networks. Buying rewards finished " +
  "work, and the payment gives creators more means to keep going.";

// Verified against GitHub repo dates (Regen-Bazaar org) and Karma GAP grant records, 2026-09-25.
export const HISTORY: { when: string; text: string }[] = [
  { when: "Before the platform", text: "Two single-organisation pilots of the model: Clean Phangan (community beach cleanups, Optimism) and EcoThailand Foundation (mangrove restoration, Celo)" },
  { when: "Jan to Feb 2025", text: "Litepaper and the first MVP monorepo" },
  { when: "Mar to May 2025", text: "Contract prototypes on Starknet (Cairo), Move and Stellar" },
  { when: "Apr 2025", text: "Gitcoin Grants GG23 (OSS dApps and Apps round)" },
  { when: "Apr to Jul 2025", text: "EVM contracts and a Next.js dApp; Celo Proof of Ship, Season 4" },
  { when: "Jun 2026", text: "Rebuilt from scratch: impact-scoring engine, lazy-mint contracts with a security self-audit (v1 to v3), end-to-end purchases on Celo Sepolia" },
  { when: "Sep 2026", text: "Arbitrum Open House buildathon: Arbitrum Sepolia and Robinhood Chain testnet, USDG checkout, public beta" },
];

export const DONE: { text: string; proof?: string }[] = [
  { text: "Live beta on three test networks (Arbitrum Sepolia, Robinhood Chain testnet, Celo Sepolia), one site with a network switcher", proof: "https://app.regenbazaar.com" },
  { text: "One report, one network: each impact report is listed only on the network it was submitted on, so it is never sold twice" },
  { text: "Contracts source-verified; 61 Foundry tests; June 2026 security self-audit", proof: "https://sepolia.arbiscan.io/address/0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030#code" },
  { text: "Stablecoin checkout in Paxos USDG, with the creator paid in the same transaction", proof: "https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77" },
  { text: "AI extraction of plain-language reports, deterministic published scoring formula, on-chain EAS attestations", proof: "https://app.regenbazaar.com/methodology" },
  { text: "Methodology v0.2 (Community layer): physical units from public coefficients, a published card with source status for every weight, scores per impact domain, double-counting rules, and a sensitivity test", proof: "https://app.regenbazaar.com/methodology" },
  { text: "Proof levels P0 to P4 set by a validator; proof links fetched safely on the server, saved as a dated snapshot and checked for dates, numbers and place" },
  { text: "Prices in US dollars from the Impact Value and the proof level, with declared costs as a capped coefficient (1.0 to 1.5), paid in a dollar stablecoin on Arbitrum Sepolia and Robinhood Chain testnet" },
  { text: "Generated artwork for every tRWI, pinned to IPFS as the token image" },
  { text: "Buyer page with holdings and retirement; step-by-step guide", proof: "https://app.regenbazaar.com/guide" },
  { text: "Public-beta safety: content moderation, rate limits, reviewer-only approvals, duplicate hints for reviewers" },
];

export const PHASES: Phase[] = [
  {
    id: "beta",
    title: "Public beta and feedback",
    status: "now",
    goal: "Learn from real people what is confusing before anything touches real money.",
    items: [
      "Open testing with the community on all three test networks",
      "Fix every step where testers get stuck (wallet setup, faucets, the two wallet confirmations)",
      "Publish what we learned and what we changed",
    ],
    doneWhen: [
      "Testers from outside the team complete a submission and a purchase without help",
      "Feedback is collected, answered and turned into fixes",
    ],
  },
  {
    id: "trust",
    title: "Trust: methodology v0.2 and proof of impact",
    status: "now",
    grant: true,
    goal: "Make the Impact Value a number a buyer can rely on, and make double counting hard.",
    items: [
      "Dated and geotagged photos read on upload, and a second-party witness flow, as evidence for proof levels P2 and P3",
      "Automatic ecosystem sensitivity at the site coordinates, read on demand from open global maps (ESA WorldCover land cover including mangroves, Allen Coral Atlas reefs, Global Forest Watch data) with no local copy of the maps; today a validator checks the site on the maps by hand",
      "Calibrate the rate per Impact Value point and the cap of the cost coefficient, with Impact Value kept as the main weight of the price; a dollar stablecoin checkout on Celo before mainnet",
      "Versioned scoring, so past reports keep the score of the version that produced them",
      "Similarity checks across all reports, and checks against other impact registries so the same work is not sold twice",
      "Revocation: withdraw the on-chain attestation and delist a claim that turns out to be false",
      "Review of the weights by independent domain experts, with an open comment period",
      "An accredited third-party verification tier for buyers who need it",
      "Every attestation states its proof level (from self-reported to independently verified), who verified it, the evidence used and when it is re-checked",
      "Follow-up monitoring: a dated re-check of the same site (for example survival after 12 and 36 months), attested and linked to the original report",
      "Retiring a tRWI records an on-chain contribution statement: who retired it, how much Impact Value, which project",
      "Wording across the site says what was bought and contributed, never offsetting or carbon neutrality, in line with EU consumer rules on green claims (Directive 2024/825)",
    ],
    doneWhen: [
      "Every scoring weight has a published rationale and cites a source or is marked as a platform estimate",
      "Every listing shows its proof level, and no listing goes live without at least one public proof of the work",
      "Every retirement produces a contribution statement",
      "Duplicate checks run on every submission",
    ],
  },
  {
    id: "ngo",
    title: "Creators: onboarding without crypto",
    status: "next",
    grant: true,
    goal: "Let any impact creator, an NGO, a community group or an individual, join in minutes, without knowing what a wallet is.",
    items: [
      "Sign in by email or Telegram, with a wallet created for the creator behind the scenes; existing wallets still work",
      "Creator profile: mission, country, website, all reports, total sold",
      "Teams: several people per organisation with roles (owner, editor, viewer)",
      "Proof of control before anyone can edit a profile or change the payout wallet",
      "Payout options for creators without crypto experience",
      "Creator dashboard for an organisation or a person: reports, listings, sales and payouts received; pause or withdraw their own listings (impact already used in a listing stays used)",
      "First partner integration: DeCleanup users list bundles of 10 or more verified cleanups, checked against DeCleanup's records on Celo, with a share of each sale going to DeCleanup as the tool that verified them",
    ],
    doneWhen: [
      "A new creator with no wallet can sign up, submit a report and receive a payout",
      "Every profile change is authorised by the creator or their own team members",
      "A DeCleanup user can list a bundle of verified cleanups, and no cleanup can be sold twice",
    ],
  },
  {
    id: "funders",
    title: "Buyers, companies and AI agents",
    status: "later",
    goal: "Make buying impact as easy as a card payment, for individuals, companies and software.",
    items: [
      "Mobile wallets without the in-app browser, gasless checkout, and card payment for people without crypto",
      "Shareable impact statements and a full history of what you bought, downloadable as CSV or PDF with links to each attestation",
      "Company portal: buy across many small projects at once, invoices, and exportable impact reports for sustainability teams",
      "Secondary market on the existing resale contract: on each resale 2.5% royalty to the creator, 2.5% platform fee, and 2.5% to the partner the impact came through",
      "AI-agent purchases: a documented API for software that discovers, evaluates and buys impact",
      "Buyer ranks and a public leaderboard, ranked by Impact Value bought and retired rather than money spent, so a rank cannot simply be bought; weighted by proof level, and joining is opt-in",
      "Levels and badges per impact domain and SDG, streaks for regular purchases, and a personal impact dashboard showing what your purchases stand for",
      "Creator leaderboard by verified impact delivered, so the most effective groups get seen first",
    ],
    doneWhen: [
      "A person can buy impact with a card on a phone in under two minutes",
      "A company can buy a portfolio of impact and download a report for its records",
      "Every buyer has a rank and badges computed from on-chain purchases and retirements, visible on a public leaderboard",
    ],
  },
  {
    id: "validators",
    title: "Validator network and community",
    status: "later",
    goal: "Move verification from our team to an open, accountable community.",
    items: [
      "Personal accounts for the core team with roles (admin, reviewer) instead of one shared access code, and a log of every approval, rejection and partner change",
      "Validator sign-up and onboarding: application, short training on proof levels with sample reports, and a first period in which the core team double-checks each decision",
      "Validator workspace: assigned reports, a checklist per proof level, questions to the creator, and a history of one's own decisions",
      "Validator accounts with a public track record",
      "An open task pool: several independent validators review each report",
      "Accountability: reputation that rewards careful reviews and consequences for false approvals",
      "Rewards for validators: model to be designed",
      "Disputes: creators can appeal a decision to a review panel",
      "Community governance over methodology changes and platform rules",
      "Community buying rounds where buyers pool money to buy impact from many projects at once",
    ],
    doneWhen: [
      "Most reports are verified by community validators, not by the core team",
      "Validator decisions and track records are public",
    ],
  },
  {
    id: "mainnet",
    title: "Mainnet",
    status: "later",
    goal: "Real money, with the safeguards real money needs.",
    items: [
      "External security audit of the contracts",
      "Admin roles held by a multisig with a timelock; separate operating keys",
      "Legal review of the tRWI model; terms of use and privacy policy",
      "Terms that make each creator and buyer responsible for their own country's rules on foreign funding, tax and reporting; creators confirm at sign-up that they may receive foreign funds, including in stablecoins",
      "Sanctions screening of creator and buyer wallets",
      "Checkout only in regulated stablecoins issued natively on each network (for example USDC, and euro stablecoins such as EURe or EURAU), never bridged copies",
      "Launch with pilot partners first, with their consent",
    ],
    doneWhen: [
      "Audit report published and all findings addressed",
      "First real sale pays a partner organisation on mainnet",
    ],
  },
];

export const EXPLORING: string[] = [
  "Outcome-based lending to creators, tied to measured impact",
  "Interoperability with other on-chain regen platforms and registries (Hypercerts and other open impact standards), so impact tokenized here is recognised and counted there, and never counted twice",
  "More networks, only where a stablecoin and real demand exist",
  "Proof-only collections: shares that can be retired but not resold, for buyers who want a record rather than a tradable token",
];
