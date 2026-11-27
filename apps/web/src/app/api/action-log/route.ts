import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte, or, lt, type SQL } from "drizzle-orm";
import { actionLog } from "@rb/db/schema";
import { getDb } from "../../../lib/db";
import { requireActor } from "../../../lib/validator-auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/action-log?person=<id>&action=&object=<id>&from=&to=&before=<iso>,<id>&limit= — newest first.
// Admin: all lines. Validator: only their own. Read only: no route changes or deletes a line.
export async function GET(req: Request) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const q = new URL(req.url).searchParams;
  const conds: SQL[] = [];
  if (a.actor.role !== "admin") {
    // The shared access code is always admin, so a non-admin actor always has an account id.
    conds.push(eq(actionLog.actorId, a.actor.userId as string));
  } else if (q.get("person")) {
    const p = q.get("person")!;
    if (!UUID_RE.test(p)) return NextResponse.json({ error: "person must be a validator id" }, { status: 422 });
    conds.push(eq(actionLog.actorId, p));
  }
  const action = q.get("action");
  if (action) conds.push(eq(actionLog.action, action.slice(0, 40)));
  const object = q.get("object");
  if (object) conds.push(eq(actionLog.objectId, object.slice(0, 100)));
  for (const [key, op] of [["from", gte], ["to", lte]] as const) {
    const v = q.get(key);
    if (!v) continue;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: `${key} must be a date` }, { status: 422 });
    conds.push(op(actionLog.createdAt, d));
  }
  // Paging cursor "<iso time>,<id>": time alone would skip lines that share a timestamp.
  const before = q.get("before");
  if (before) {
    const [t, id] = before.split(",");
    const d = new Date(t);
    if (Number.isNaN(d.getTime()) || !UUID_RE.test(id ?? "")) return NextResponse.json({ error: "before must be '<iso time>,<id>'" }, { status: 422 });
    conds.push(or(lt(actionLog.createdAt, d), and(eq(actionLog.createdAt, d), lt(actionLog.id, id)))!);
  }
  const limit = Math.min(Math.max(Number(q.get("limit")) || 100, 1), 200);
  const db = await getDb();
  const rows = await db.select().from(actionLog).where(conds.length ? and(...conds) : undefined).orderBy(desc(actionLog.createdAt), desc(actionLog.id)).limit(limit);
  return NextResponse.json(rows);
}
