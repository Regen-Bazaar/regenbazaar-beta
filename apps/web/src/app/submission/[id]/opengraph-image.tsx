import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { impactSubmissions, organizations } from "@rb/db/schema";
import { getDb } from "../../../lib/db";
import { GOLD, MUTED, OG_SIZE, OgFrame, PAPER, ogFonts } from "../../../lib/og";

export const alt = "tRWI impact report on Regen Bazaar";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [row] = /^[0-9a-f-]{36}$/i.test(id)
    ? await db
        .select({ s: impactSubmissions, orgName: organizations.name })
        .from(impactSubmissions)
        .innerJoin(organizations, eq(impactSubmissions.orgId, organizations.id))
        .where(eq(impactSubmissions.id, id))
        .limit(1)
    : [];
  const fonts = await ogFonts();
  // Unapproved reports stay private: they get the generic brand card.
  if (!row || !["verified", "tokenized"].includes(row.s.status)) {
    return new ImageResponse(
      (
        <OgFrame>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "Acma", fontSize: 72 }}>Impact report</div>
        </OgFrame>
      ),
      { ...size, fonts },
    );
  }
  const iv = Number(row.s.ivValue ?? 0);
  const sdgs = ((row.s.frameworkTags as { sdg?: string[] } | null)?.sdg ?? []).slice(0, 5);
  const title = row.s.title.length > 90 ? `${row.s.title.slice(0, 88)}…` : row.s.title;

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 64, width: "100%" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 330,
              height: 330,
              borderRadius: 999,
              border: `10px solid ${GOLD}`,
              backgroundColor: "rgba(63,108,59,0.35)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", fontFamily: "Acma", fontSize: iv >= 1000 ? 78 : 92, color: PAPER }}>
              {iv.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </div>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: GOLD }}>IMPACT VALUE</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: GOLD }}>
              {(row.s.domain ?? "impact").replace(/_/g, " ").toUpperCase()} · tRWI
            </div>
            <div style={{ display: "flex", marginTop: 14, fontFamily: "Acma", fontSize: 58, lineHeight: 1.08 }}>{title}</div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: MUTED }}>by {row.orgName}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
              {sdgs.map((t) => (
                <div
                  key={t}
                  style={{ display: "flex", fontSize: 24, padding: "4px 14px", borderRadius: 8, backgroundColor: "rgba(247,243,228,0.12)" }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
