// Validator workspace: things to look at (fixed rules, no AI), the consequence line, the creator history summary.
// Marks are worded as "look at", never as a verdict; nothing here sets a level, a score or a status.
import { computePriceV02, labourCheck, type CostDeclaration, type ProofLevel } from "@rb/impact-engine";

export type Mark = { code: string; text: string };

export type CreatorHistorySummary = { total: number; approved: number; rejected: number; pending: number; withdrawn: number };

export type MarkInput = {
  history: CreatorHistorySummary; // the creator's OTHER impacts (this one excluded)
  ivValue: number;
  ivMedianOthers: number | null; // median over all other impacts with a value; null when fewer than 5
  duplicates: number;
  links: string[]; // proof links and photo links
  checks: { url: string; error?: string; flags: { severity: string }[] }[] | null; // stored automatic checks, null = none yet
  checking: boolean; // the automatic check is running now
  cost: CostDeclaration | null | undefined;
  country: string | undefined;
  hasCoordinates: boolean;
  proofLinkCount: number;
  lastRequestAt: string | null; // an earlier "request more proof"
};

export const LARGE_IV_TIMES_MEDIAN = 3;
export const MIN_OTHERS_FOR_MEDIAN = 5;

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length < MIN_OTHERS_FOR_MEDIAN) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function attentionMarks(i: MarkInput): Mark[] {
  const out: Mark[] = [];
  if (i.history.total === 0) out.push({ code: "first_impact", text: "First impact from this wallet" });
  if (i.history.rejected > 0) out.push({ code: "earlier_rejection", text: `${i.history.rejected} earlier impact${i.history.rejected > 1 ? "s" : ""} from this wallet rejected` });
  if (i.history.withdrawn > 0) out.push({ code: "earlier_withdrawn", text: `${i.history.withdrawn} earlier impact${i.history.withdrawn > 1 ? "s" : ""} from this wallet withdrawn` });
  if (i.ivMedianOthers && i.ivValue >= i.ivMedianOthers * LARGE_IV_TIMES_MEDIAN) {
    out.push({ code: "large_iv", text: `Large Impact Value (${(i.ivValue / i.ivMedianOthers).toFixed(1)}× the median of other impacts)` });
  }
  if (i.duplicates > 0) out.push({ code: "duplicate", text: `Possible duplicate (${i.duplicates})` });
  if (i.proofLinkCount === 0) out.push({ code: "no_proof_links", text: "No proof links" });
  if (i.links.length > 0) {
    if (!i.checks || i.checks.length === 0) {
      if (!i.checking) out.push({ code: "links_unchecked", text: "Links not checked yet" });
    } else {
      const byUrl = new Map(i.checks.map((c) => [c.url, c]));
      const unchecked = i.links.filter((u) => !byUrl.has(u)).length;
      const failed = i.links.filter((u) => {
        const c = byUrl.get(u);
        return !!c && (!!c.error || c.flags.some((f) => f.severity === "fail"));
      }).length;
      if (failed) out.push({ code: "link_failed", text: `${failed} link${failed > 1 ? "s" : ""} could not be opened` });
      if (unchecked && !i.checking) out.push({ code: "links_unchecked", text: `${unchecked} link${unchecked > 1 ? "s" : ""} not checked yet` });
    }
  }
  if (i.cost) {
    const c = labourCheck(i.cost, i.country);
    if (c.ratio !== null && (c.ratio > 3 || c.ratio < 1)) out.push({ code: "cost_far", text: `Declared hourly value is ${c.ratio}× the minimum wage reference` });
  }
  if (!i.hasCoordinates) out.push({ code: "no_coordinates", text: "No coordinates" });
  if (i.lastRequestAt) out.push({ code: "info_requested", text: "More proof was requested earlier" });
  return out;
}

export type PriceAtLevel = { level: ProofLevel; factor: number; totalUsd: number; perEditionUsd: number };

/** What each proof level would make the price. Plain information; not tied to any button. */
export function consequenceLine(iv: number, cost: CostDeclaration | null | undefined, editions = 100): PriceAtLevel[] {
  const out: PriceAtLevel[] = [];
  for (const level of ["P1", "P2", "P3", "P4"] as const) {
    const p = computePriceV02(iv, level, cost ?? undefined, editions);
    if (p) out.push({ level, factor: p.p, totalUsd: p.totalUsd, perEditionUsd: p.perEditionUsd });
  }
  return out;
}

export const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;

export function historyText(h: CreatorHistorySummary): string {
  if (h.total === 0) return "first impact from this wallet";
  const parts = [`${h.approved} approved`, `${h.rejected} rejected`];
  if (h.pending) parts.push(`${h.pending} waiting`);
  if (h.withdrawn) parts.push(`${h.withdrawn} withdrawn`);
  return parts.join(", ");
}

export function summarizeHistory(rows: { status: string; withdrawn: boolean }[]): CreatorHistorySummary {
  const s: CreatorHistorySummary = { total: rows.length, approved: 0, rejected: 0, pending: 0, withdrawn: 0 };
  for (const r of rows) {
    if (r.status === "verified" || r.status === "tokenized") s.approved++;
    else if (r.status === "rejected") s.rejected++;
    else if (r.status === "pending_verification") s.pending++;
    if (r.withdrawn) s.withdrawn++;
  }
  return s;
}

export type AiReadSource = "ai" | "fallback_error" | "fallback_empty" | "not_configured";

/** Honest label for the reading the creator started from. Old reports did not record which reader answered. */
export function aiReadLabel(src: string | undefined): { title: string; tone: "ok" | "warn" | "unknown" } {
  switch (src) {
    case "ai":
      return { title: "Read by the AI", tone: "ok" };
    case "fallback_error":
      return { title: "The AI did not answer; read by a keyword parser", tone: "warn" };
    case "fallback_empty":
      return { title: "The AI found no actions; read by a keyword parser", tone: "warn" };
    case "not_configured":
      return { title: "No AI configured; read by a keyword parser", tone: "warn" };
    default:
      return { title: "Automatic reading (which reader answered was not recorded)", tone: "unknown" };
  }
}
