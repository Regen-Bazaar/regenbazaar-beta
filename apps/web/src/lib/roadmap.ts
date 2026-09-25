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
    title: "Trust: methodology and verification",
    status: "next",
    grant: true,
    goal: "Make the Impact Value a number a funder can rely on, and make double counting hard.",
    items: [
      "Calibrate scoring weights with domain experts against established impact standards",
      "Express selected actions in physical units (for example tCO₂e for restoration), with versioned scoring so past scores stay auditable",
      "Required evidence: dated, geotagged photos, with an AI check that evidence matches the report",
      "Similarity checks across all reports, and checks against other impact registries so the same work is not sold twice",
      "Revocation: withdraw the on-chain attestation and delist a claim that turns out to be false",
      "An accredited third-party verification tier for buyers who need it",
    ],
    doneWhen: [
      "Every scoring weight cites a source or is marked as an expert estimate, published on the methodology page",
      "No listing goes live without evidence, and duplicate checks run on every submission",
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
    ],
    doneWhen: [
      "A new organisation with no wallet can sign up, submit a report and receive a payout",
      "Every profile change is authorised by the organisation's own members",
    ],
  },
  {
    id: "funders",
    title: "Funders, companies and AI agents",
    status: "later",
    goal: "Make funding impact as easy as a card payment, for individuals, companies and software.",
    items: [
      "Mobile wallets without the in-app browser, gasless checkout, and card payment for people without crypto",
      "Shareable impact certificates and a full history of what you funded",
      "Company portal: buy across many small projects at once, invoices, and exportable impact reports for sustainability teams",
      "Secondary market on the existing resale contract, with a capped royalty back to the organisation",
      "AI-agent funding: a documented API for software that discovers, evaluates and funds impact",
      "Funder recognition based on what you have funded and retired",
    ],
    doneWhen: [
      "A person can fund impact with a card on a phone in under two minutes",
      "A company can buy a portfolio of impact and download a report for its records",
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
  "Interoperability with Hypercerts and other open impact standards",
  "More networks, only where a stablecoin and real demand exist",
];
