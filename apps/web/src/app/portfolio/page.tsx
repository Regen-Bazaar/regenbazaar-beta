import { eq } from "drizzle-orm";
import { impactSubmissions, listings } from "@rb/db/schema";
import { getDb } from "../../lib/db";
import { NETWORK } from "../../lib/networks";
import { Portfolio, type PortfolioItem } from "../../components/Portfolio";

export const dynamic = "force-dynamic";

// Buyer view: the connected wallet's tRWI on this network. Holdings are read from chain in the browser;
// the server only supplies the catalogue of this network's collections (titles, IV, attestation refs).
export default async function PortfolioPage() {
  const db = await getDb();
  const rows = await db
    .select({
      tokenId: listings.tokenId,
      maxEditions: listings.maxEditions,
      easUid: listings.easUid,
      metadataUri: listings.metadataUri,
      submissionId: listings.submissionId,
      title: impactSubmissions.title,
      domain: impactSubmissions.domain,
      ivValue: impactSubmissions.ivValue,
    })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .where(eq(listings.chainId, NETWORK.chain.id));

  const items: PortfolioItem[] = rows.map((r) => ({
    tokenId: String(r.tokenId),
    maxEditions: r.maxEditions,
    easUid: r.easUid,
    metadataUri: r.metadataUri,
    submissionId: r.submissionId,
    title: r.title,
    domain: r.domain,
    totalIV: Number(r.ivValue ?? 0),
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">My impact</h1>
      <p className="mt-2 text-paper/70">
        tRWI you hold on {NETWORK.chain.name}, read live from the chain. Retire editions to permanently claim the
        impact they represent.
      </p>
      <Portfolio items={items} />
    </main>
  );
}
