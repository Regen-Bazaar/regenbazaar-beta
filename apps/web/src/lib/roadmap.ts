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
  "Regen Bazaar turns verified real-world impact into tRWI tokens that anyone can fund in a stablecoin, with the " +
  "organisation paid in the same transaction. This roadmap is ordered by priority, has no dates, and marks the " +
  "milestones we would take on with grant funding. Everything today runs on test networks.";

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
  { text: "Stablecoin checkout in Paxos USDG, with the organisation paid in the same transaction", proof: "https://explorer.testnet.chain.robinhood.com/tx/0xea4a18d20c2fc3c4ed2a46ef7681129a99b905118745ff2de9ad95609ca2ba77" },
  { text: "AI extraction of plain-language reports, deterministic published scoring formula (v0.1), on-chain EAS attestations", proof: "https://app.regenbazaar.com/methodology" },
  { text: "Generated artwork for every tRWI, pinned to IPFS as the token image" },
  { text: "Funder page with holdings and retirement; step-by-step guide", proof: "https://app.regenbazaar.com/guide" },
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
    goal: "Make the Impact Value a number a funder can rely on, and make double counting hard.",
    items: [
      "Methodology v0.2 for community groups and small organisations: environmental actions in physical units from public coefficients (IPCC default tables, US EPA WARM, IFI grid emission factors, peer-reviewed mangrove rates); social, education and health actions defined by IRIS+ metrics",
      "A written rationale for every scoring weight, with its source or marked as a platform estimate, and a sensitivity test of how rankings change when weights move",
      "Scores per impact domain (environment, animal welfare, education, poverty, social, health), with the overall Impact Value kept for pricing and rewards",
      "Proof of impact: links to public posts and reports, dated and geotagged photos, a second-party witness; an AI check flags mismatches and a person sets the proof level",
      "Ecosystem sensitivity from the location of the work, using open data (ecoregions, coral reef and mangrove maps, forest change)",
      "Price in US dollars derived from the Impact Value, the proof level and the difficulty of the work",
      "Versioned scoring, so past reports keep the score of the version that produced them",
      "Similarity checks across all reports, and checks against other impact registries so the same work is not sold twice",
      "Revocation: withdraw the on-chain attestation and delist a claim that turns out to be false",
      "Review of the weights by independent domain experts, with an open comment period",
      "An accredited third-party verification tier for buyers who need it",
      "Every attestation states its proof level (from self-reported to independently verified), who verified it, the evidence used and when it is re-checked",
      "Follow-up monitoring: a dated re-check of the same site (for example survival after 12 and 36 months), attested and linked to the original report",
      "Retiring a tRWI records an on-chain contribution statement: who retired it, how much Impact Value, which project",
      "Wording across the site says what was funded and contributed, never offsetting or carbon neutrality, in line with EU consumer rules on green claims (Directive 2024/825)",
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
    title: "Organisations: onboarding without crypto",
    status: "next",
    grant: true,
    goal: "Let any NGO or community group join in minutes, without knowing what a wallet is.",
    items: [
      "Sign in by email or Telegram, with a wallet created for the organisation behind the scenes; existing wallets still work",
      "Organisation profile: mission, country, website, all reports, total funded",
      "Teams: several people per organisation with roles (owner, editor, viewer)",
      "Proof of control before anyone can edit a profile or change the payout wallet",
      "Payout options for organisations without crypto experience",
      "Organisation dashboard: reports, listings, sales, funds received",
      "First partner integration: DeCleanup users list bundles of 10 or more verified cleanups, checked against DeCleanup's records on Celo, with a share of each sale going to DeCleanup as the tool that verified them",
    ],
    doneWhen: [
      "A new organisation with no wallet can sign up, submit a report and receive a payout",
      "Every profile change is authorised by the organisation's own members",
      "A DeCleanup user can list a bundle of verified cleanups, and no cleanup can be sold twice",
    ],
  },
  {
    id: "funders",
    title: "Funders, companies and AI agents",
    status: "later",
    goal: "Make funding impact as easy as a card payment, for individuals, companies and software.",
    items: [
      "Mobile wallets without the in-app browser, gasless checkout, and card payment for people without crypto",
      "Shareable impact certificates and a full history of what you funded, downloadable as CSV or PDF with links to each attestation",
      "Company portal: buy across many small projects at once, invoices, and exportable impact reports for sustainability teams",
      "Secondary market on the existing resale contract, with a capped royalty back to the organisation",
      "AI-agent funding: a documented API for software that discovers, evaluates and funds impact",
      "Funder ranks and a public leaderboard, ranked by Impact Value funded and retired rather than money spent, so a rank cannot simply be bought; weighted by proof level, and joining is opt-in",
      "Levels and badges per impact domain and SDG, streaks for regular funding, and a personal impact dashboard showing what your funding achieved",
      "Organisation leaderboard by verified impact delivered, so the most effective groups get seen first",
    ],
    doneWhen: [
      "A person can fund impact with a card on a phone in under two minutes",
      "A company can buy a portfolio of impact and download a report for its records",
      "Every funder has a rank and badges computed from on-chain purchases and retirements, visible on a public leaderboard",
    ],
  },
  {
    id: "validators",
    title: "Validator network and community",
    status: "later",
    goal: "Move verification from our team to an open, accountable community.",
    items: [
      "Validator accounts with a public track record",
      "An open task pool: several independent validators review each report",
      "Accountability: reputation that rewards careful reviews and consequences for false approvals",
      "Disputes: organisations can appeal a decision to a review panel",
      "Community governance over methodology changes and platform rules",
      "Community funding rounds where funders pool support for many projects at once",
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
      "Terms that make each organisation and funder responsible for their own country's rules on foreign funding, tax and reporting; organisations confirm at sign-up that they may receive foreign funds, including in stablecoins",
      "Sanctions screening of organisation and funder wallets",
      "Checkout only in regulated stablecoins issued natively on each network (for example USDC, and euro stablecoins such as EURe or EURAU), never bridged copies",
      "Launch with pilot partners first, with their consent",
    ],
    doneWhen: [
      "Audit report published and all findings addressed",
      "First real funding reaches a partner organisation on mainnet",
    ],
  },
];

export const EXPLORING: string[] = [
  "Outcome-based lending to organisations, tied to measured impact",
  "Interoperability with other on-chain regen platforms and registries (Hypercerts and other open impact standards), so impact tokenized here is recognised and counted there, and never counted twice",
  "More networks, only where a stablecoin and real demand exist",
  "Proof-only collections: shares that can be retired but not resold, for funders who want a record rather than a tradable token",
];
