import { NextResponse } from "next/server";
import { processSubmission, createDeepSeekExtractor, moderate } from "@rb/pipeline";
import { impactSubmissions, organizations } from "@rb/db/schema";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getAddress, isAddress } from "viem";
import type { DB } from "@rb/db";
import { getDb, getDemoOrgId } from "../../../lib/db";
import { isAdmin } from "../../../lib/admin";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { findDuplicates } from "../../../lib/duplicates";
import { currentNetwork } from "../../../lib/network-server";

export const runtime = "nodejs";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_MEDIA = 5;
const PUBLIC_STATUSES = ["verified", "tokenized"];
const PER_IP_PER_HOUR = 5;
const GLOBAL_PER_HOUR = 60;

// An organisation is identified by its payout wallet (the address paid on every sale). No auth yet: a new
// wallet creates an unverified org; an existing wallet reuses its org (name is not overwritten).
async function findOrCreateOrg(db: DB, name: string, wallet: `0x${string}`): Promise<string> {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(sql`lower(${organizations.walletAddress}) = ${wallet.toLowerCase()}`)
    .limit(1);
  if (existing) return existing.id;
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "org";
  const [created] = await db
    .insert(organizations)
    .values({ walletAddress: wallet, name, slug: `${base}-${wallet.slice(2, 8).toLowerCase()}`, verified: false })
    .returning({ id: organizations.id });
  return created.id;
}

// GET /api/submissions?status=pending_verification — list submissions (newest first).
// Public callers only see approved reports; the pending queue and other statuses are admin-only.
export async function GET(req: Request) {
  const db = await getDb();
  const status = new URL(req.url).searchParams.get("status");
  const admin = isAdmin(req);
  if (!admin && status && !PUBLIC_STATUSES.includes(status)) {
    return NextResponse.json({ error: "validator access required" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(impactSubmissions)
    .where(
      status
        ? eq(impactSubmissions.status, status as never)
        : admin
          ? undefined
          : inArray(impactSubmissions.status, PUBLIC_STATUSES as never[]),
    )
    .orderBy(desc(impactSubmissions.createdAt))
    .limit(100);
  if (!admin) return NextResponse.json(rows);
  // Validators also get double-counting hints against everything already submitted.
  const all = await db.select().from(impactSubmissions).orderBy(desc(impactSubmissions.createdAt)).limit(2000);
  return NextResponse.json(rows.map((r) => ({ ...r, possibleDuplicates: findDuplicates(r, all) })));
}

// POST /api/submissions — extract -> deterministically score -> persist into the verification queue.
export async function POST(req: Request) {
  if (!rateLimit(`sub:${clientIp(req)}`, PER_IP_PER_HOUR, 3_600_000) || !rateLimit("sub:all", GLOBAL_PER_HOUR, 3_600_000)) {
    return NextResponse.json({ error: "too many submissions, please try again later" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.title !== "string" || typeof body.description !== "string") {
    return NextResponse.json({ error: "title and description are required" }, { status: 422 });
  }
  // Caps keep LLM cost and prompt size bounded for this unauthenticated endpoint.
  const title = body.title.trim().slice(0, MAX_TITLE);
  const description = body.description.trim();
  if (!title || !description) return NextResponse.json({ error: "title and description are required" }, { status: 422 });
  if (description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: `description is limited to ${MAX_DESCRIPTION} characters` }, { status: 422 });
  }
  const payoutWallet = typeof body.payoutWallet === "string" ? body.payoutWallet.trim() : "";
  const orgName = typeof body.orgName === "string" ? body.orgName.trim().slice(0, 100) : "";
  if (payoutWallet && !isAddress(payoutWallet)) {
    return NextResponse.json({ error: "payout wallet is not a valid EVM address" }, { status: 422 });
  }
  if (payoutWallet && !orgName) {
    return NextResponse.json({ error: "organisation name is required with a payout wallet" }, { status: 422 });
  }

  // Evidence links: plain http(s) URLs only (rendered as links, never embedded).
  const mediaUris = Array.isArray(body.mediaUris)
    ? (body.mediaUris as unknown[])
        .filter((u): u is string => typeof u === "string" && /^https?:\/\/\S{3,300}$/i.test(u.trim()))
        .map((u) => u.trim())
        .slice(0, MAX_MEDIA)
    : [];

  const verdict = await moderate([`Organisation: ${orgName}`, `Title: ${title}`, description, ...mediaUris].join("\n"));
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: `submission rejected by content check (${verdict.category}). Please describe real-world impact only.` },
      { status: 422 },
    );
  }

  const db = await getDb();
  const orgId = payoutWallet ? await findOrCreateOrg(db, orgName, getAddress(payoutWallet)) : await getDemoOrgId(db);
  const extractor = process.env.DEEPSEEK_API_KEY ? createDeepSeekExtractor() : undefined;
  // One report, one network: the report is listed only on the network selected when it was submitted.
  const chainId = (await currentNetwork()).chain.id;

  try {
    const { submission, iv } = await processSubmission(
      db,
      {
        orgId,
        title,
        description,
        domain: body.domain as never,
        context: body.context as never,
        mediaUris,
        chainId,
      },
      { extractor },
    );
    return NextResponse.json(
      { id: submission.id, status: submission.status, impactValue: iv.impactValue, frameworkTags: iv.frameworkTags },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
