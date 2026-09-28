import type { Metadata } from "next";
import {
  ACTION_WEIGHTS_V02,
  AREA_FACTOR_TIERS,
  DOMAIN_K,
  ESM_MAX,
  ESM_MIN,
  MAX_ACTION_QUANTITY_V02,
  MAX_CREDITED_YEARS,
  PRICE_RATE_PER_IV,
  PRICE_RATE_USD_PER_IV,
  PROOF_FACTORS,
  PROOF_REQUIREMENTS,
  TABLES_VERSION,
  TABLES_VERSION_V02,
  type ImpactDomain,
  type ProofLevel,
  type SourceStatus,
} from "@rb/impact-engine";
import { DOMAIN_KEYS, DOMAIN_LABEL } from "../../lib/impact-view";

export const metadata: Metadata = {
  title: "Impact Value methodology",
  description:
    "How Regen Bazaar scores impact (methodology v0.2, Community layer): physical units, domain scores, proof levels, sources for every weight. AI extracts; it never scores.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10">
      <h2 className="text-[1.75rem]">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

const STATUS_LABEL: Record<SourceStatus, string> = { sourced: "sourced", derived: "derived", assumption: "assumption" };
const STATUS_CLASS: Record<SourceStatus, string> = { sourced: "text-ok", derived: "text-accent", assumption: "text-subtle" };

const TOC: [string, string][] = [
  ["status", "Status"],
  ["how", "How it works"],
  ["extraction", "Extraction"],
  ["units", "Units"],
  ["aw", "Weights"],
  ["multipliers", "SM, ESM, S"],
  ["k", "Domain coefficients"],
  ["proof", "Proof levels"],
  ["price", "Price"],
  ["integrity", "Double counting"],
  ["alignment", "Alignment"],
  ["versions", "Versions"],
  ["sources", "Sources and data"],
];

const SOURCES: [string, string][] = [
  ["Bernal, Murray, Pearson 2018, Carbon Balance and Management: planted mangrove sequestration, Table 2", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6246754/"],
  ["IPCC 2019 Refinement, Vol. 4 Ch. 4 Forest Land, Table 4.10; IPCC 2006 Guidelines Table 4.3", "https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch04_Forest%20Land.pdf"],
  ["IPCC 2013 Wetlands Supplement, Ch. 4 Coastal Wetlands (cross-check)", "https://www.ipcc-nggip.iges.or.jp/public/wetlands/pdf/Wetlands_separate_files/WS_Chp4_Coastal_Wetlands.pdf"],
  ["US EPA WARM v16 (Dec 2023), plastics, Exhibit 5-3", "https://www.epa.gov/system/files/documents/2023-12/warm_containers_packaging_and_non-durable_goods_materials_v16_dec.pdf"],
  ["IFI Default Grid Factors v3.0 (UNFCCC, Dec 2021)", "https://unfccc.int/sites/default/files/resource/Harmonized_Grid_Emission_factor_data_set.xlsx"],
  ["Gold Standard Safe Drinking Water Supply methodology", "https://globalgoals.goldstandard.org/standards/429_V1.0_EE_SWS_Emission-reductions-from-Safe-Drinking-Water-Supply.pdf"],
  ["Boström-Einarsson et al. 2020, PLoS ONE: coral restoration survival", "https://doi.org/10.1371/journal.pone.0226631"],
  ["Bourgeois et al. 2024, Science Advances: planted mangrove biomass", "https://doi.org/10.1126/sciadv.adk5430"],
  ["Haddad et al. 2015, Science Advances: habitat fragmentation", "https://doi.org/10.1126/sciadv.1500052"],
  ["WOAH Terrestrial Code Ch. 7.7, dog population management", "https://www.woah.org/fileadmin/Home/eng/Health_standards/tahc/2023/chapitre_aw_stray_dog.pdf"],
  ["IUCN/SSC Guidelines for Reintroductions 2013", "https://portals.iucn.org/library/node/10386"],
  ["WHO/UNICEF JMP drinking water service ladder (SDG 6.1.1)", "https://washdata.org/monitoring/drinking-water"],
];

// Open data layers for the environmental sensitivity suggestion (commercial use allowed with attribution).
const DATA_LAYERS: [string, string, string][] = [
  ["Global Mangrove Watch", "CC BY 4.0", "https://www.globalmangrovewatch.org/"],
  ["Allen Coral Atlas", "CC BY 4.0", "https://allencoralatlas.org/"],
  ["RESOLVE Ecoregions 2017", "CC BY 4.0", "https://ecoregions.appspot.com/"],
  ["Hansen / UMD Global Forest Change", "CC BY 4.0", "https://glad.earthengine.app/view/global-forest-change"],
  ["ESA WorldCover", "CC BY 4.0", "https://esa-worldcover.org/"],
  ["WRI Aqueduct", "CC BY 4.0", "https://www.wri.org/aqueduct"],
  ["WorldPop", "CC BY 4.0", "https://www.worldpop.org/"],
  ["OpenStreetMap contributors (own extract)", "ODbL", "https://www.openstreetmap.org/copyright"],
];

export default function Methodology() {
  const byDomain = new Map<ImpactDomain, [string, (typeof ACTION_WEIGHTS_V02)[string]][]>();
  for (const [k, w] of Object.entries(ACTION_WEIGHTS_V02)) {
    if (!w.parked) byDomain.set(w.domain, [...(byDomain.get(w.domain) ?? []), [k, w]]);
  }
  const parked = Object.entries(ACTION_WEIGHTS_V02).filter(([, w]) => w.parked);

  return (
    <main className="page-wrap py-10 md:py-14">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-16">
        <nav aria-label="On this page" className="hidden lg:sticky lg:top-24 lg:block">
          <p className="label-mono mb-3">On this page</p>
          <ol className="space-y-2 border-l border-line">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="-ml-px block border-l-2 border-transparent pl-4 text-muted hover:border-accent hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 max-w-[80ch]">
          <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Impact Value methodology</h1>
          <p className="mt-3 text-lg text-muted">
            How Regen Bazaar turns a report into scores per impact area and one Impact Value. Deterministic and
            versioned: the same report and table version always give the same result, with a full breakdown.
          </p>
          <div className="mt-5 inline-block rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted">
            Methodology <span className="text-accent">v0.2, Community layer</span> · tables {TABLES_VERSION_V02}
          </div>

          <div className="mt-12 space-y-10">
            <Section id="status" title="Status: what this is and is not">
              <p>
                Impact Value is <b>Regen Bazaar&apos;s own relative index</b> for comparing reports from small NGOs and
                community groups. It is <b>not a certification</b>, not a carbon or biodiversity credit, and it does not
                let a buyer claim any emissions result. Weights marked &quot;assumption&quot; are platform judgement awaiting a
                cost survey with pilot groups and an expert review. Projects certified by a registry can declare their
                serial number, which prevents double claiming.
              </p>
            </Section>

            <Section id="how" title="How it works: two streams that meet only in the price">
              <ol className="ml-5 list-decimal space-y-1">
                <li>
                  <b>How much impact.</b> Report → AI lists the stated actions → quantities become physical units →
                  score per impact area → one Impact Value.
                </li>
                <li>
                  <b>How sure we are.</b> Proof links and media → automatic checks raise flags → a validator sets the
                  proof level P0 to P4.
                </li>
              </ol>
              <div className="card p-6 text-center">
                <div className="break-words font-mono text-base text-fg sm:text-lg">domain score = Σ units × AW × SM × ESM × S</div>
                <div className="mt-2 break-words font-mono text-base text-fg sm:text-lg">IV = Σ domain score × k</div>
              </div>
              <p>Screens lead with the domain score and physical units; the single IV is used for price, staking and the overall ranking.</p>
            </Section>

            <Section id="extraction" title="Extraction: the AI reads, it never scores">
              <p>
                A language model reads the report and lists actions (type, quantity, unit). The organisation checks and
                corrects that list; the validator sees both. The score is a pure function of the numbers and the
                published tables. Report text is treated as data, so instructions hidden in it are ignored.
              </p>
            </Section>

            <Section id="units" title="Units and conversions">
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Trees, mangroves", "hectares per monitored year, from the declared area or planting density; a count alone scores no carbon"],
                      ["Hectares restored", `hectares per monitored year (at most ${MAX_CREDITED_YEARS} years)`],
                      ["Tonnes, grams, pounds", "kg"],
                      ["m², acres, rai", "ha (1 rai = 0.16 ha)"],
                    ].map(([a, b]) => (
                      <tr key={a} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 text-fg">{a}</td>
                        <td className="px-4 py-2">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>A unit that cannot be converted (for example &quot;bags&quot; for kg) scores 0 and is flagged for the validator.</p>
            </Section>

            <Section id="aw" title="Weights (AW), each with a justification card">
              <p>
                Environment is counted in tCO₂e-equivalent points (1 point = 1 tCO₂e). Every weight has a card with its
                definition, anchor, calculation, sensitivity and open questions. Status:{" "}
                <span className="text-ok">sourced</span> (a cited table), <span className="text-accent">derived</span> (our
                arithmetic on a cited table), <span className="text-subtle">assumption</span> (needs checking).
              </p>
              {DOMAIN_KEYS.filter((d) => byDomain.has(d)).map((d) => (
                <div key={d} className="mt-4">
                  <div className="label-mono mb-2 !text-accent">{DOMAIN_LABEL[d]}</div>
                  <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                    <table className="w-full text-sm">
                      <tbody>
                        {(byDomain.get(d) ?? []).map(([key, w]) => (
                          <tr key={key} className="border-b border-line last:border-0">
                            <td className="px-4 py-2">
                              <a href={`/methodology/cards/${key}`} className="capitalize text-fg hover:text-accent">
                                {key.replace(/_/g, " ")}
                              </a>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-accent">{w.aw.value}</td>
                            <td className="whitespace-nowrap px-4 py-2 text-subtle">per {w.scoredUnit}</td>
                            <td className={`whitespace-nowrap px-4 py-2 text-right ${STATUS_CLASS[w.aw.status]}`}>{STATUS_LABEL[w.aw.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </Section>

            <details className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
              <summary className="cursor-pointer text-fg">Kept aside: actions outside the Community layer</summary>
              <p className="mt-2">
                These need capital, a licence or professionals, so volunteers cannot deliver them for free. They stay in
                the tables for a later layer and score 0 today.
              </p>
              <ul className="mt-2 ml-5 list-disc">
                {parked.map(([k, w]) => (
                  <li key={k}>
                    <span className="capitalize">{k.replace(/_/g, " ")}</span>: {w.parked}
                  </li>
                ))}
              </ul>
            </details>

            <Section id="multipliers" title="SM, ESM and S">
              <p>
                <b>SM, area factor</b> (area-based ecosystem actions only, on the report&apos;s total area for that action):{" "}
                {AREA_FACTOR_TIERS.map((t) => `from ${t.minHa} ha ×${t.factor.value}`).join(" · ")}; ×1.0 when the site
                joins existing habitat. Small isolated patches hold less biodiversity (Haddad et al. 2015); bigger sites
                get no bonus per hectare. All other actions: ×1.0.
              </p>
              <p>
                <b>ESM, environmental sensitivity</b> ({ESM_MIN} to {ESM_MAX}, environment only):
                a validator checks the site coordinates on open maps (mangroves, reefs, forest) and sets it. Until then, 1.0.
              </p>
              <p>
                <b>S, survival</b>: coral ×{ACTION_WEIGHTS_V02.coral_planted.s!.value} (Boström-Einarsson et al. 2020);
                mangroves by the measured surviving share, ×{ACTION_WEIGHTS_V02.mangroves_planted.s!.value} by default
                (proxy from Bourgeois et al. 2024).
              </p>
            </Section>

            <Section id="k" title="Domain coefficients (k)">
              <p>
                No public source can say how many kilograms of litter equal one student taught. That exchange rate is a
                value judgement, so it is explicit and small: six published numbers. Today all are{" "}
                {Object.values(DOMAIN_K)[0].value}, pending a cost survey with pilot groups and an expert review.
              </p>
            </Section>

            <Section id="proof" title="Proof levels (P0 to P4)">
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-sm">
                  <tbody>
                    {(Object.keys(PROOF_REQUIREMENTS) as ProofLevel[]).map((l) => (
                      <tr key={l} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 font-semibold text-fg">{l}</td>
                        <td className="px-4 py-2">{PROOF_REQUIREMENTS[l]}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-accent">
                          {l === "P0" ? "not listed" : `P ${PROOF_FACTORS[l]}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                The server saves a copy of each link (hash and date), and automatic checks compare dates, numbers and place
                with the report. They only raise flags. A person sets the level; it never changes the impact score. P
                factors are a pilot hypothesis.
              </p>
            </Section>

            <Section id="price" title="Price">
              <p>
                <span className="font-mono text-fg">price (USD) = IV × rate × P × C</span>, split across editions. The rate is
                ${PRICE_RATE_USD_PER_IV.value} per IV point for now, to be calibrated with a cost survey of pilot groups. P is
                the proof level factor; C is the complexity of the work (five questions, 1.0 to 1.4), moved here from the
                impact score because difficulty is a cost, not an outcome.
              </p>
              <p>
                First sales settle in a dollar stablecoin (USDG) at that price, so an organisation knows what it receives.
                Resale on the secondary market is free. On the Celo test network the price is paid in test CELO, counted as
                $1; a stablecoin replaces it before mainnet. Reports scored with v0.1 keep their v0.1 price (IV ×{" "}
                {PRICE_RATE_PER_IV} in the sale currency).
              </p>
            </Section>

            <Section id="integrity" title="Double counting and anti-gaming">
              <ul className="ml-4 list-disc space-y-1">
                <li>Lines of the same action are added up before scoring, so splitting a report changes nothing.</li>
                <li>Area and tree count of one planting: the area counts, the count is evidence.</li>
                <li>Work already registered with a carbon standard (declared serial number) scores no carbon here, so it is not claimed twice.</li>
                <li>Recycled plastic adds only its carbon benefit when collection is also reported.</li>
                <li>Workshops score 0 when participants are counted; meals and family support for the same families count once.</li>
                <li>Volunteers are an input and score 0. Wildlife releases need justification and monitoring (IUCN/SSC 2013).</li>
                <li>One action is capped at {MAX_ACTION_QUANTITY_V02.toLocaleString("en-US")} units; carbon at {MAX_CREDITED_YEARS} monitored years.</li>
                <li>Nothing the submitter types raises a multiplier: sensitivity and proof level are set by a validator.</li>
              </ul>
            </Section>

            <Section id="alignment" title="Alignment">
              <p>
                Unit definitions are mapped to IRIS+ metric IDs (IRIS+ by the GIIN, cited with attribution) and structured
                around the Five Dimensions of Impact. SDG tags mean &quot;contributes to&quot;; SDG indicators are
                country-level.
              </p>
            </Section>

            <Section id="versions" title="Versions">
              <p>
                Every score is stamped with the methodology that produced it and is never rescored. Reports scored before
                v0.2 keep their v0.1 value ({TABLES_VERSION}: IV = Σ AW × SM × TBV × ESM × PIM × ACDM, seed weights). The two
                scales differ, so v0.1 and v0.2 numbers should not be compared directly.
              </p>
              <p>
                What changed and why: TBV (time bonus) and PIM (population density) removed; ACDM moved to price; SM changed
                from a size bonus to a small-patch discount; weights moved to physical units with sources; proof levels and
                double-counting rules added.
              </p>
            </Section>

            <Section id="sources" title="Sources and data attribution">
              <ul className="ml-4 list-disc space-y-1">
                {SOURCES.map(([label, href]) => (
                  <li key={href}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
              <p>Open maps validators use to check the site (an automatic lookup is planned):</p>
              <ul className="ml-4 list-disc space-y-1">
                {DATA_LAYERS.map(([name, licence, href]) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
                      {name}
                    </a>{" "}
                    ({licence})
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                Protected-area and species databases whose terms forbid commercial use (WDPA, IUCN Red List, KBA, IBAT) are
                not queried.
              </p>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
