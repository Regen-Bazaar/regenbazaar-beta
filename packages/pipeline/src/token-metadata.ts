// Builds the PUBLIC tRWI token metadata JSON — the single place that decides what travels with the
// token forever (pinned to IPFS, read by wallets/marketplaces/agents on every resale). It embeds the
// impact DATA directly (name, what was done, quantities, tags, approximate region, dates, IV) so the
// token is self-describing and does NOT depend on our website staying up.
//
// Deliberately EXCLUDED (privacy / permanence): the NGO's raw free-text report, precise geolocation,
// beneficiary PII, raw media, and validator notes. Only an allowlist of safe fields is published.
// Shape is ERC-1155 / OpenSea-compatible (name/description/image/attributes) plus a machine-readable
// `properties` block for AI-agent buyers.

import type { ExtractedAction, FrameworkTags } from "@rb/impact-engine";

export interface TokenMetadataInput {
  title: string;
  domain?: string | null;
  actions: ExtractedAction[];
  frameworks?: FrameworkTags | null;
  impactValue: number;
  editions: number;
  regionCode?: string | null; // coarse region only — never precise coordinates
  periodStart?: string | null;
  periodEnd?: string | null;
  tablesVersion: string;
  easUID?: string | null;
  imageUri?: string | null; // ipfs://… set at mint
  externalUrl?: string | null; // optional human link back to the detail page (NOT the source of truth)
}

export interface TokenAttribute {
  trait_type: string;
  value: string | number;
  display_type?: "number";
}

export interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: TokenAttribute[];
  properties: {
    schema: "regen-bazaar/trwi-1";
    impactValue: number;
    editions: number;
    tablesVersion: string;
    assessment: "platform-assessed (beta)";
    thirdPartyCertified: false;
    frameworks: { sdg: string[]; ebf: string[] };
    actions: ExtractedAction[];
    region?: string;
    period?: { start?: string; end?: string };
    easUID?: string;
  };
}

const PLACEHOLDER_IMAGE = "ipfs://__set_at_mint__";

const pretty = (s: string) => s.replace(/_/g, " ");
const year = (d?: string | null) => (d ? d.slice(0, 4) : undefined);

export function buildTokenMetadata(input: TokenMetadataInput): TokenMetadata {
  const sdg = input.frameworks?.sdg ?? [];
  const ebf = input.frameworks?.ebf ?? [];
  const region = input.regionCode ? pretty(input.regionCode) : undefined;
  const period = [year(input.periodStart), year(input.periodEnd)].filter(Boolean).join("–");

  const deeds = input.actions.map((a) => `${a.quantity.toLocaleString("en-US")} ${pretty(a.actionType)}`);
  const description =
    (deeds.length ? `Verified real-world impact: ${deeds.join(", ")}.` : "Verified real-world impact.") +
    " Impact Value is platform-assessed (beta), not third-party certified.";

  const attributes: TokenAttribute[] = [];
  if (input.domain) attributes.push({ trait_type: "Impact domain", value: pretty(input.domain) });
  for (const a of input.actions) {
    attributes.push({ trait_type: pretty(a.actionType), value: a.quantity, display_type: "number" });
  }
  attributes.push({ trait_type: "Impact Value", value: input.impactValue, display_type: "number" });
  attributes.push({ trait_type: "Editions", value: input.editions, display_type: "number" });
  if (region) attributes.push({ trait_type: "Region (approximate)", value: region });
  if (period) attributes.push({ trait_type: "Period", value: period });
  for (const s of sdg) attributes.push({ trait_type: "SDG", value: s });
  for (const e of ebf) attributes.push({ trait_type: "EBF", value: e });
  if (input.easUID) attributes.push({ trait_type: "EAS attestation", value: input.easUID });
  attributes.push({ trait_type: "Methodology", value: `${input.tablesVersion} (platform-assessed, not certified)` });

  return {
    name: input.title,
    description,
    image: input.imageUri || PLACEHOLDER_IMAGE,
    ...(input.externalUrl ? { external_url: input.externalUrl } : {}),
    attributes,
    properties: {
      schema: "regen-bazaar/trwi-1",
      impactValue: input.impactValue,
      editions: input.editions,
      tablesVersion: input.tablesVersion,
      assessment: "platform-assessed (beta)",
      thirdPartyCertified: false,
      frameworks: { sdg, ebf },
      actions: input.actions,
      ...(region ? { region } : {}),
      ...(input.periodStart || input.periodEnd
        ? { period: { start: input.periodStart ?? undefined, end: input.periodEnd ?? undefined } }
        : {}),
      ...(input.easUID ? { easUID: input.easUID } : {}),
    },
  };
}
