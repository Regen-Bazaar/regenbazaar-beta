// Idempotent demo seed for the local dev DB (PGlite only — never runs against prod Postgres).
// Populates a handful of NGOs across the full impact spectrum with verified/tokenized submissions,
// scored through the real impact engine so the marketplace, dashboard and leaderboard look alive.

import * as schema from "@rb/db/schema";
import { and, eq } from "drizzle-orm";
import { computeImpactValue, ruleBasedExtract, type ImpactContext } from "@rb/impact-engine";
import type { DB } from "@rb/db";

type Domain = "environment" | "animal_welfare" | "education" | "poverty" | "social" | "health";
type Status = "verified" | "tokenized";

interface SeedSubmission {
  title: string;
  description: string;
  domain: Domain;
  status: Status;
  context: ImpactContext;
}

interface SeedOrg {
  wallet: string;
  name: string;
  slug: string;
  mission: string;
  country: string;
  region: string;
  verified: boolean;
  submissions: SeedSubmission[];
}

const addr = (suffix: string) => "0x" + suffix.padStart(40, "0");

const ORGS: SeedOrg[] = [
  {
    wallet: addr("d3m0"),
    name: "Clean Phangan",
    slug: "clean-phangan",
    mission: "Coastal reforestation and plastic cleanup on Koh Phangan.",
    country: "TH",
    region: "Koh Phangan",
    verified: true,
    submissions: [
      {
        title: "Beach reforestation & cleanup — Koh Phangan",
        description:
          "1000 trees planted and 5 workshops held. Collected 1500 kg of plastic from the coastline.",
        domain: "environment",
        status: "tokenized",
        context: { regionCode: "southeast_asia", populationDensity: "medium", periodStart: "2024-01-01", periodEnd: "2025-01-01" },
      },
      {
        title: "Mangrove restoration — Chaloklum bay",
        description: "Planted 800 mangroves and restored 6 hectares of degraded coastline.",
        domain: "environment",
        status: "verified",
        context: { regionCode: "coral_reef", populationDensity: "low", periodStart: "2024-06-01", periodEnd: "2025-03-01" },
      },
    ],
  },
  {
    wallet: addr("a011"),
    name: "Island Paws",
    slug: "island-paws",
    mission: "Street-animal rescue, sterilization and rehoming.",
    country: "TH",
    region: "Surat Thani",
    verified: true,
    submissions: [
      {
        title: "Spay, treat & rehome programme — Q1",
        description: "120 dogs rescued, 300 cats sterilized, 80 animals adopted and 200 animals treated.",
        domain: "animal_welfare",
        status: "verified",
        context: { populationDensity: "medium", periodStart: "2024-01-01", periodEnd: "2024-04-01" },
      },
    ],
  },
  {
    wallet: addr("a022"),
    name: "Bright Futures",
    slug: "bright-futures",
    mission: "Education access for rural and migrant children.",
    country: "TH",
    region: "Chiang Rai",
    verified: true,
    submissions: [
      {
        title: "Rural literacy programme — 2024",
        description: "450 students taught, 12 teachers trained, 2000 books distributed and 15 scholarships granted.",
        domain: "education",
        status: "tokenized",
        context: { populationDensity: "high", complexity: { technicalExpertise: "medium", resourceIntensity: "high", projectScale: "regional", regulatory: "medium", environmentalConditions: "moderate" }, periodStart: "2024-01-01", periodEnd: "2025-01-01" },
      },
    ],
  },
  {
    wallet: addr("a033"),
    name: "Open Table",
    slug: "open-table",
    mission: "Food security and shelter for vulnerable families.",
    country: "TH",
    region: "Bangkok",
    verified: false,
    submissions: [
      {
        title: "Community kitchen & shelter — winter",
        description: "12000 meals provided, 60 people housed and 40 jobs created.",
        domain: "poverty",
        status: "verified",
        context: { populationDensity: "very_high", periodStart: "2024-11-01", periodEnd: "2025-03-01" },
      },
    ],
  },
  {
    wallet: addr("a044"),
    name: "Village Health",
    slug: "village-health",
    mission: "Mobile clinics and preventive care for remote villages.",
    country: "TH",
    region: "Mae Hong Son",
    verified: true,
    submissions: [
      {
        title: "Mobile clinic outreach — 2024",
        description: "800 patients treated, 1500 vaccinations administered and 200 medical kits distributed.",
        domain: "health",
        status: "verified",
        context: { populationDensity: "low", complexity: { technicalExpertise: "high", resourceIntensity: "high", projectScale: "regional", regulatory: "high", environmentalConditions: "challenging" }, periodStart: "2024-01-01", periodEnd: "2025-01-01" },
      },
    ],
  },
];

export async function seedDev(db: DB): Promise<void> {
  for (const o of ORGS) {
    await db
      .insert(schema.organizations)
      .values({
        walletAddress: o.wallet,
        name: o.name,
        slug: o.slug,
        mission: o.mission,
        country: o.country,
        region: o.region,
        verified: o.verified,
      })
      .onConflictDoNothing();

    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, o.slug))
      .limit(1);
    if (!org) continue;

    for (const s of o.submissions) {
      const existing = await db
        .select({ id: schema.impactSubmissions.id })
        .from(schema.impactSubmissions)
        .where(and(eq(schema.impactSubmissions.orgId, org.id), eq(schema.impactSubmissions.title, s.title)))
        .limit(1);
      if (existing.length) continue;

      const actions = ruleBasedExtract(s.description);
      const iv = computeImpactValue(actions, s.context);
      await db.insert(schema.impactSubmissions).values({
        orgId: org.id,
        title: s.title,
        description: s.description,
        domain: s.domain,
        status: s.status,
        extractedActions: actions,
        context: s.context,
        ivResult: iv,
        ivValue: iv.impactValue.toFixed(4),
        tablesVersion: iv.tablesVersion,
        frameworkTags: iv.frameworkTags,
        mediaUris: [],
      });
    }
  }
}
