// Readable text for action log lines (the log stores technical before/after values).
export type LogLineLike = {
  action: string;
  before: unknown;
  after: unknown;
  note: string | null;
  result: string;
  error: string | null;
};

const ACTION_TEXT: Record<string, string> = {
  sign_in: "Signed in",
  sign_in_refused: "Sign-in refused",
  sign_out: "Signed out",
  proof_check: "Proof links checked",
  set_proof_level: "Proof level set",
  set_esm: "Environmental sensitivity confirmed",
  approve: "Approved",
  reject: "Rejected",
  request_info: "Asked for more proof",
  open_impact: "Opened the impact",
  add_note: "Added an internal note",
  set_place_names: "Place names saved",
  partner_create: "Partner added",
  partner_pause: "Partner paused",
  partner_resume: "Partner resumed",
  partner_detach: "Partner detached from a listing",
  validator_add: "Validator added",
  validator_remove: "Validator removed",
  role_change: "Role changed",
  first_admin: "First admin created",
  withdraw_request: "Withdrawal requested",
  withdraw_approve: "Withdrawal approved",
  withdraw_reject: "Withdrawal rejected",
  edition_limit_lift: "Edition limit lifted",
};

export const actionTitle = (a: string) => ACTION_TEXT[a] ?? a.replace(/_/g, " ");

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const word = (v: unknown) => String(v).replace(/_/g, " ");

const FIELD_TEXT: Record<string, string> = {
  status: "status",
  proofLevel: "proof level",
  esm: "sensitivity",
  impactValue: "Impact Value",
  network: "network",
  tokenId: "tRWI",
  partnerId: "partner",
  links: "links",
  role: "role",
  placeNames: "places",
};

/** "status pending verification → rejected", "proof level P1 → P2". Unknown shapes fall back to key: value pairs. */
export function describeChange(l: Pick<LogLineLike, "before" | "after">): string {
  const b = obj(l.before);
  const a = obj(l.after);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== "easUid" && k !== "existing" && k !== "noteId");
  const parts: string[] = [];
  for (const k of keys) {
    const name = FIELD_TEXT[k] ?? word(k);
    const from = b[k];
    const to = a[k];
    const t = (v: unknown) => (v === null || v === undefined || v === "" ? "none" : Array.isArray(v) ? v.join(", ") || "none" : word(v));
    if (k in b && k in a && JSON.stringify(from) !== JSON.stringify(to)) parts.push(`${name}: ${t(from)} → ${t(to)}`);
    else if (!(k in b) && k in a && to !== undefined) parts.push(`${name}: ${t(to)}`);
    else if (k in b && !(k in a)) parts.push(`${name} was ${t(from)}`);
    else if (k in b && k in a) parts.push(`${name}: ${t(to)} (unchanged)`);
  }
  return parts.join(" · ");
}

export function describeLine(l: LogLineLike): { title: string; detail: string } {
  const detail = [describeChange(l), l.note ? `reason: ${l.note}` : "", l.result === "failed" ? `failed: ${l.error ?? "unknown error"}` : ""].filter(Boolean).join(" · ");
  return { title: actionTitle(l.action), detail };
}
