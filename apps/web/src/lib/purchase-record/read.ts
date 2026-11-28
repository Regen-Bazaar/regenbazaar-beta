// Read side of the purchase record, for the screens of gamification (My impact, boards, purchase history).
// Everything here reads our own tables; nothing calls the chain. A wallet's rows cover every network at once.
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { formatUnits } from "viem";
import { editionEvents, holdings, impactSubmissions, listings, organizations, recordCursors } from "@rb/db/schema";
import type { DB } from "@rb/db";
import { buyerPoints, holdingPoints, pointsPerEdition, emptyAreaPoints, IMPACT_AREAS, type AreaPoints, type PointsImpact } from "@rb/impact-engine";
import { networkByChainId, tokenInstanceUrl, type NetworkKey } from "../networks";
import { RECORDED_CHAINS, recordedCurrency, tokenGeneration, type RecordedChain } from "./contracts";

export function normalizeWallet(wallet: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("not a wallet address");
  return wallet.toLowerCase();
}

interface ListedImpact {
  listingId: string;
  submissionId: string;
  title: string;
  domain: string | null;
  proofLevel: string | null;
  withdrawnAt: Date | null;
  impact: PointsImpact;
}

const key = (chainId: number, tokenContract: string, tokenId: string) => `${chainId}:${tokenContract}:${tokenId}`;

/** Listings behind a set of on-chain tokens. A token is matched to the listing of its own contract generation. */
async function listedImpacts(db: DB, tokens: { chainId: number; tokenContract: string; tokenId: string }[]): Promise<Map<string, ListedImpact>> {
  const out = new Map<string, ListedImpact>();
  const idsByChain = new Map<number, Set<string>>();
  for (const t of tokens) idsByChain.set(t.chainId, (idsByChain.get(t.chainId) ?? new Set()).add(t.tokenId));
  if (!idsByChain.size) return out;
  const rows = await db
    .select({
      listingId: listings.id,
      chainId: listings.chainId,
      tokenId: listings.tokenId,
      generation: listings.contractGeneration,
      maxEditions: listings.maxEditions,
      beneficiary: listings.beneficiary,
      withdrawnAt: listings.withdrawnAt,
      submissionId: impactSubmissions.id,
      title: impactSubmissions.title,
      domain: impactSubmissions.domain,
      ivValue: impactSubmissions.ivValue,
      methodologyVersion: impactSubmissions.methodologyVersion,
      domainScores: impactSubmissions.domainScores,
      proofLevel: impactSubmissions.proofLevel,
      orgWallet: organizations.walletAddress,
    })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .innerJoin(organizations, eq(impactSubmissions.orgId, organizations.id))
    .where(or(...[...idsByChain].map(([chainId, ids]) => and(eq(listings.chainId, chainId), inArray(listings.tokenId, [...ids])))));
  for (const t of tokens) {
    const generation = tokenGeneration(t.chainId, t.tokenContract);
    const r = rows.find((x) => x.chainId === t.chainId && String(x.tokenId) === t.tokenId && x.generation === generation);
    if (!r) continue;
    out.set(key(t.chainId, t.tokenContract, t.tokenId), {
      listingId: r.listingId,
      submissionId: r.submissionId,
      title: r.title,
      domain: r.domain,
      proofLevel: r.proofLevel,
      withdrawnAt: r.withdrawnAt,
      impact: {
        methodologyVersion: r.methodologyVersion,
        domain: r.domain,
        ivValue: Number(r.ivValue ?? 0) || 0,
        domainScores: r.domainScores,
        proofLevel: r.proofLevel,
        maxEditions: r.maxEditions,
        withdrawn: r.withdrawnAt != null,
        creatorWallets: [r.beneficiary, r.orgWallet],
      },
    });
  }
  return out;
}

export interface HoldingRow {
  chainId: number;
  network: NetworkKey | null;
  tokenContract: string;
  tokenId: string;
  editionsHeld: number;
  editionsRetired: number;
  listed: boolean; // false = a token that is on the chain but is not an impact of the site (test scripts)
  submissionId: string | null;
  title: string | null;
  domain: string | null;
  proofLevel: string | null;
  withdrawn: boolean;
  ownImpact: boolean; // the wallet is the creator: no buyer points
  pointsPerEdition: AreaPoints;
  points: AreaPoints;
  tokenUrl: string | null; // the edition collection on the block explorer
}

/** What a wallet holds and has retired, on every network, with the points each holding gives. */
export async function walletHoldings(db: DB, wallet: string, opts: { includeUnlisted?: boolean } = {}): Promise<HoldingRow[]> {
  const w = normalizeWallet(wallet);
  const rows = await db.select().from(holdings).where(eq(holdings.wallet, w));
  const live = rows
    .map((r) => ({ chainId: r.chainId, tokenContract: r.tokenContract, tokenId: String(r.tokenId), editionsHeld: Number(r.editionsHeld), editionsRetired: Number(r.editionsRetired) }))
    .filter((r) => r.editionsHeld > 0 || r.editionsRetired > 0);
  const listed = await listedImpacts(db, live);
  const out: HoldingRow[] = [];
  for (const r of live) {
    const l = listed.get(key(r.chainId, r.tokenContract, r.tokenId));
    if (!l && !opts.includeUnlisted) continue;
    const net = networkByChainId(r.chainId);
    out.push({
      ...r,
      network: net?.key ?? null,
      listed: !!l,
      submissionId: l?.submissionId ?? null,
      title: l?.title ?? null,
      domain: l?.domain ?? null,
      proofLevel: l?.proofLevel ?? null,
      withdrawn: l?.impact.withdrawn ?? false,
      ownImpact: l ? l.impact.creatorWallets.some((c) => c.toLowerCase() === w) : false,
      pointsPerEdition: l ? pointsPerEdition(l.impact) : emptyAreaPoints(),
      points: l ? holdingPoints(w, { editionsHeld: r.editionsHeld, editionsRetired: r.editionsRetired, impact: l.impact }) : emptyAreaPoints(),
      tokenUrl: net ? tokenUrlFor(r.chainId, r.tokenContract, r.tokenId) : null,
    });
  }
  return out.sort((a, b) => a.chainId - b.chainId || Number(a.tokenId) - Number(b.tokenId));
}

function tokenUrlFor(chainId: number, tokenContract: string, tokenId: string): string | null {
  const net = networkByChainId(chainId);
  return net ? tokenInstanceUrl({ ...net, trwi: tokenContract as `0x${string}` }, tokenId) : null;
}

export interface WalletPoints {
  wallet: string;
  points: AreaPoints; // per area; areas are never added together
  areasOpened: number; // areas with any points, 0 to 6
  trwiCount: number; // different tRWI held or retired
  editionsHeld: number;
  editionsRetired: number;
  updatedAt: Date | null; // when the record last read the chain (the oldest of the networks)
}

/** A buyer's impact points per area, with the three counts shown above the rings. */
export async function walletPoints(db: DB, wallet: string): Promise<WalletPoints> {
  const w = normalizeWallet(wallet);
  const rows = await walletHoldings(db, w);
  const points = emptyAreaPoints();
  for (const r of rows) for (const area of IMPACT_AREAS) points[area] += r.points[area];
  for (const area of IMPACT_AREAS) points[area] = Math.round(points[area] * 1e6) / 1e6;
  return {
    wallet: w,
    points,
    areasOpened: IMPACT_AREAS.filter((a) => points[a] > 0).length,
    trwiCount: rows.length,
    editionsHeld: rows.reduce((n, r) => n + r.editionsHeld, 0),
    editionsRetired: rows.reduce((n, r) => n + r.editionsRetired, 0),
    updatedAt: (await recordStatus(db)).updatedAt,
  };
}

const HISTORY_SCAN = 5_000;

export interface HistoryRow {
  date: Date; // time of the block
  kind: "bought" | "retired";
  chainId: number;
  network: NetworkKey | null;
  tokenContract: string;
  tokenId: string;
  submissionId: string | null;
  title: string | null;
  editions: number;
  /** Bought rows only. `amount` is the whole payment in the coin's smallest unit; `formatted` is null for an unknown coin. */
  pricePaid: { amount: string; currency: string; symbol: string | null; formatted: string | null } | null;
  inNameOf: string | null; // retired on revision 4: the name written into the statement
  txHash: string;
  txUrl: string | null; // the on-chain record
}

/** Purchase history of a wallet: what it bought and retired, newest first. Show it to the connected wallet only. */
export async function purchaseHistory(db: DB, wallet: string, opts: { limit?: number; includeUnlisted?: boolean } = {}): Promise<HistoryRow[]> {
  const w = normalizeWallet(wallet);
  const limit = Math.min(Math.max(1, opts.limit ?? 200), 1000);
  const rows = await db
    .select()
    .from(editionEvents)
    .where(and(eq(editionEvents.wallet, w), inArray(editionEvents.kind, ["bought", "retired"])))
    .orderBy(desc(editionEvents.blockTime), desc(editionEvents.blockNumber), desc(editionEvents.logIndex))
    .limit(HISTORY_SCAN); // the limit is applied after tokens outside the site are dropped
  const listed = await listedImpacts(db, rows.map((r) => ({ chainId: r.chainId, tokenContract: r.tokenContract, tokenId: String(r.tokenId) })));
  const out: HistoryRow[] = [];
  for (const r of rows) {
    const tokenId = String(r.tokenId);
    const l = listed.get(key(r.chainId, r.tokenContract, tokenId));
    if (!l && !opts.includeUnlisted) continue;
    const net = networkByChainId(r.chainId);
    const coin = r.currency ? recordedCurrency(r.chainId, r.currency) : undefined;
    const explorer = net?.chain.blockExplorers?.default.url;
    out.push({
      date: r.blockTime,
      kind: r.kind as "bought" | "retired",
      chainId: r.chainId,
      network: net?.key ?? null,
      tokenContract: r.tokenContract,
      tokenId,
      submissionId: l?.submissionId ?? null,
      title: l?.title ?? null,
      editions: Number(r.amount),
      pricePaid:
        r.kind === "bought" && r.totalPaid != null && r.currency
          ? { amount: String(r.totalPaid), currency: r.currency, symbol: coin?.symbol ?? null, formatted: coin ? formatUnits(BigInt(String(r.totalPaid)), coin.decimals) : null }
          : null,
      inNameOf: r.inNameOf,
      txHash: r.txHash,
      txUrl: explorer ? `${explorer}/tx/${r.txHash}` : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface RecordStatus {
  updatedAt: Date | null; // oldest "last read" over the networks; null = the job has never run
  chains: { chainId: number; readTo: number | null; updatedAt: Date | null; events: number }[];
}

/** How current the record is ("updated N minutes ago"), per network. */
export async function recordStatus(db: DB, recorded: RecordedChain[] = RECORDED_CHAINS): Promise<RecordStatus> {
  const cursors = await db.select().from(recordCursors);
  const counts = await db.select({ chainId: editionEvents.chainId, n: sql<number>`count(*)::int` }).from(editionEvents).groupBy(editionEvents.chainId);
  const chains = recorded.map((c) => {
    const own = cursors.filter((x) => x.chainId === c.chainId && c.contracts.some((k) => k.address === x.contract));
    const complete = own.length === c.contracts.length;
    return {
      chainId: c.chainId,
      readTo: complete ? Math.min(...own.map((x) => x.lastBlock)) : null,
      updatedAt: complete ? new Date(Math.min(...own.map((x) => x.updatedAt.getTime()))) : null,
      events: counts.find((x) => x.chainId === c.chainId)?.n ?? 0,
    };
  });
  const times = chains.map((c) => c.updatedAt);
  return { updatedAt: times.some((t) => !t) ? null : new Date(Math.min(...times.map((t) => t!.getTime()))), chains };
}

/** Every wallet's points in one area, highest first: the input of a buyers board. Board opt-in is applied by the caller. */
export async function areaBoard(db: DB, area: (typeof IMPACT_AREAS)[number], opts: { limit?: number } = {}): Promise<{ wallet: string; points: number }[]> {
  const rows = await db.select().from(holdings);
  const live = rows
    .map((r) => ({ chainId: r.chainId, tokenContract: r.tokenContract, tokenId: String(r.tokenId), wallet: r.wallet, editionsHeld: Number(r.editionsHeld), editionsRetired: Number(r.editionsRetired) }))
    .filter((r) => r.editionsHeld > 0 || r.editionsRetired > 0);
  const listed = await listedImpacts(db, live);
  const byWallet = new Map<string, { editionsHeld: number; editionsRetired: number; impact: PointsImpact }[]>();
  for (const r of live) {
    const l = listed.get(key(r.chainId, r.tokenContract, r.tokenId));
    if (!l) continue;
    byWallet.set(r.wallet, [...(byWallet.get(r.wallet) ?? []), { editionsHeld: r.editionsHeld, editionsRetired: r.editionsRetired, impact: l.impact }]);
  }
  return [...byWallet]
    .map(([wallet, hs]) => ({ wallet, points: buyerPoints(wallet, hs)[area] }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.wallet.localeCompare(b.wallet))
    .slice(0, Math.min(Math.max(1, opts.limit ?? 100), 1000));
}
