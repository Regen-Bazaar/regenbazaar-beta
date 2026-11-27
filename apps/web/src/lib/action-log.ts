// Append-only action log. The site only ever inserts and reads; no route updates or deletes a line.
import { actionLog } from "@rb/db/schema";
import type { DB } from "@rb/db";
import type { Actor } from "./validator-auth";

export type LogAction =
  | "sign_in"
  | "sign_in_refused"
  | "sign_out"
  | "proof_check"
  | "set_proof_level"
  | "set_esm"
  | "approve"
  | "reject"
  | "request_info"
  | "partner_create"
  | "partner_pause"
  | "partner_resume"
  | "partner_detach"
  | "validator_add"
  | "validator_remove"
  | "role_change"
  | "first_admin";

export type LogEntry = {
  action: LogAction;
  objectType?: "impact" | "listing" | "partner" | "validator";
  objectId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string | null;
  error?: string | null; // set = the action failed
  // For lines without a signed-in actor (e.g. a refused sign-in): the wallet that tried.
  wallet?: string | null;
};

/** Writes exactly one line. A failing log write never undoes or hides the action itself: it is reported on stderr. */
export async function logAction(db: DB, actor: Actor | null, e: LogEntry): Promise<void> {
  try {
    await db.insert(actionLog).values({
      actorId: actor?.userId ?? null,
      actorWallet: actor?.wallet ?? e.wallet ?? null,
      actorName: actor ? (actor.name ?? (actor.via === "shared" ? "shared access code" : null)) : null,
      action: e.action,
      objectType: e.objectType ?? null,
      objectId: e.objectId ?? null,
      before: e.before === undefined ? null : e.before,
      after: e.after === undefined ? null : e.after,
      note: e.note ? e.note.slice(0, 2000) : null,
      result: e.error ? "failed" : "done",
      error: e.error ? e.error.slice(0, 500) : null,
    });
  } catch (err) {
    console.error("action_log write failed", e.action, err instanceof Error ? err.message : err);
  }
}
