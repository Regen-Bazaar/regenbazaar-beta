import { NextResponse } from "next/server";
import { partners } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { isAdmin } from "../../../../lib/admin";

export const runtime = "nodejs";

// PATCH /api/partners/<id> — pause or resume a partner. Name, address and share are not editable:
// a paused partner's lots stop selling until resumed or detached.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "active (true/false) is required" }, { status: 422 });
  const db = await getDb();
  const [updated] = await db.update(partners).set({ active: body.active }).where(eq(partners.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "partner not found" }, { status: 404 });
  return NextResponse.json(updated);
}
