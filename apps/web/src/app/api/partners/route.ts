import { NextResponse } from "next/server";
import { impactSubmissions, listings, partners } from "@rb/db/schema";
import { desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { isAdmin } from "../../../lib/admin";
import { partnerShareError } from "../../../lib/partner-share";

export const runtime = "nodejs";

// GET /api/partners — validators only: every partner with the listings attached to it.
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
  const db = await getDb();
  const rows = await db.select().from(partners).orderBy(desc(partners.createdAt));
  const attached = await db
    .select({
      id: listings.id,
      partnerId: listings.partnerId,
      chainId: listings.chainId,
      tokenId: listings.tokenId,
      active: listings.active,
      submissionId: listings.submissionId,
      title: impactSubmissions.title,
    })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .where(isNotNull(listings.partnerId));
  return NextResponse.json(
    rows.map((p) => ({
      ...p,
      listings: attached.filter((l) => l.partnerId === p.id).map(({ partnerId: _p, ...l }) => ({ ...l, tokenId: String(l.tokenId) })),
    })),
  );
}

// POST /api/partners — create a partner. The share is fixed for the partner's lifetime (owner decision
// 2026-10-07): a different share means a new partner record, so listed lots never change their split.
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "name must be 2 to 120 characters" }, { status: 422 });
  const payoutAddress = typeof body.payoutAddress === "string" ? body.payoutAddress.trim() : "";
  const feeBps = typeof body.feeBps === "number" ? body.feeBps : NaN;
  const bad = partnerShareError({ name, payoutAddress, feeBps });
  if (bad) return NextResponse.json({ error: bad }, { status: 422 });

  const db = await getDb();
  const [created] = await db.insert(partners).values({ name, payoutAddress, feeBps }).returning();
  return NextResponse.json({ ...created, listings: [] }, { status: 201 });
}
