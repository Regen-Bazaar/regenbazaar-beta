// Double-counting guard for validators: flags pending reports that look like an already-submitted one.
// Heuristics (cheap, explainable): identical text anywhere; identical actions+quantities from the same org;
// overlapping reporting period with a shared action type from the same org. Validators decide; nothing auto-rejects.

type Sub = {
  id: string;
  orgId: string;
  title: string;
  status: string;
  description: string;
  extractedActions: unknown;
  context: unknown;
};

export type DuplicateHint = { id: string; title: string; status: string; reason: string };

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const actions = (a: unknown) =>
  (Array.isArray(a) ? (a as { actionType?: string; quantity?: number }[]) : []).filter((x) => x?.actionType);
const signature = (a: unknown) =>
  actions(a)
    .map((x) => `${x.actionType}:${x.quantity}`)
    .sort()
    .join("|");
const period = (c: unknown) => {
  const x = (c ?? {}) as { periodStart?: string; periodEnd?: string };
  const s = x.periodStart ? Date.parse(x.periodStart) : NaN;
  const e = x.periodEnd ? Date.parse(x.periodEnd) : NaN;
  return Number.isFinite(s) && Number.isFinite(e) ? { s, e } : null;
};

export function findDuplicates(target: Sub, others: Sub[]): DuplicateHint[] {
  const out: DuplicateHint[] = [];
  const tText = norm(target.description);
  const tSig = signature(target.extractedActions);
  const tTypes = new Set(actions(target.extractedActions).map((x) => x.actionType));
  const tP = period(target.context);
  for (const o of others) {
    if (o.id === target.id || o.status === "rejected") continue;
    let reason = "";
    if (tText.length > 20 && norm(o.description) === tText) reason = "identical report text";
    else if (o.orgId === target.orgId && tSig && signature(o.extractedActions) === tSig)
      reason = "same actions and quantities from the same organisation";
    else if (o.orgId === target.orgId && tP) {
      const oP = period(o.context);
      const shared = actions(o.extractedActions).some((x) => tTypes.has(x.actionType));
      if (oP && shared && oP.s <= tP.e && tP.s <= oP.e) reason = "overlapping period with the same kind of action";
    }
    if (reason) out.push({ id: o.id, title: o.title, status: o.status, reason });
  }
  return out.slice(0, 5);
}
