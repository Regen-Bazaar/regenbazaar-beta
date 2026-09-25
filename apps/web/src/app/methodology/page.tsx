import type { Metadata } from "next";
import {
  ACTION_WEIGHTS,
  SCOPE_TIERS,
  ESM_BY_REGION,
  PIM_BY_DENSITY,
  ACDM_SCALES,
  MAX_ACTION_QUANTITY,
  TABLES_VERSION,
  type ImpactDomain,
} from "@rb/impact-engine";

export const metadata: Metadata = {
  title: "Impact Value methodology",
  description:
    "How Regen Bazaar computes Impact Value: a transparent, deterministic, versioned formula. The LLM only extracts; it never scores.",
};

const DOMAIN_LABEL: Record<ImpactDomain, string> = {
  environment: "Environment",
  animal_welfare: "Animal welfare",
  education: "Education",
  poverty: "Poverty & livelihoods",
  social: "Social",
  health: "Health",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-10">
      <h2 className="text-[1.75rem]">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

const TOC: [string, string][] = [
  ["extraction", "Extraction vs scoring"],
  ["aw", "AW: Action Weight"],
  ["sm", "SM: Scope"],
  ["tbv", "TBV: Time"],
  ["esm", "ESM: Environment"],
  ["pim", "PIM: Population"],
  ["acdm", "ACDM: Complexity"],
  ["integrity", "Anti-gaming"],
  ["disclaimer", "Status & honesty"],
];

export default function Methodology() {
  const byDomain = Object.entries(ACTION_WEIGHTS).reduce<Record<string, [string, (typeof ACTION_WEIGHTS)[string]][]>>(
    (acc, [k, v]) => {
      (acc[v.domain] ??= []).push([k, v]);
      return acc;
    },
    {},
  );

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
      <div className="mb-8 rounded-2xl border border-line-strong bg-accent-tint p-5 text-muted">
        <b className="text-accent">Status: {TABLES_VERSION}, beta.</b> Impact Value is a <b>relative score</b> for
        comparing reports, not a carbon, monetary or certified measure. The formula, versioning and per-factor
        breakdown are final in design; the <b>weights and multipliers are seed values</b> set by the platform and are
        not yet calibrated against external standards. Calibration with domain experts, and mapping selected
        actions to physical units (for example tCO₂e), is the next milestone (see the{" "}
        <a href="/roadmap" className="link">roadmap</a>). Prices derived from IV are equally provisional.
      </div>
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Impact Value methodology</h1>
      <p className="mt-3 text-lg text-muted">
        How we turn an NGO&apos;s report into a single, comparable Impact Value (IV). The method is
        deterministic, auditable, and versioned: the same input and table version always produce the
        same score.
      </p>
      <div className="mt-5 inline-block rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted">
        Active table version: <span className="text-accent">{TABLES_VERSION}</span>
      </div>

      <div className="card mt-8 p-6 text-center">
        <div className="label-mono">Per action</div>
        <div className="mt-3 break-words font-mono text-base text-fg sm:text-xl">
          IV = Σ ( AW × SM × TBV × ESM × PIM × ACDM )
        </div>
      </div>

      <div className="mt-12 space-y-10">
        <Section id="extraction" title="0. Extraction (LLM) vs scoring (deterministic)">
          <p>
            A language model reads the free-text report and extracts a structured list of actions
            (type, quantity, unit). That is <b>all</b> the model does. It never assigns value. The
            score below is a pure function of the extracted numbers and the published tables, so it is
            reproducible and cannot be talked up by clever wording. If the model is unavailable, a
            deterministic keyword parser is used instead.
          </p>
        </Section>

        <Section id="aw" title="AW: Action Weight">
          <p>
            Each recognised action maps to a base weight and a set of framework tags (UN SDGs, plus the
            Ecological Benefits Framework for environmental actions). Unknown actions score zero until
            added to the table. Current seed table:
          </p>
          {Object.entries(byDomain).map(([domain, rows]) => (
            <div key={domain} className="mt-4">
              <div className="label-mono mb-2 !text-accent">
                {DOMAIN_LABEL[domain as ImpactDomain] ?? domain}
              </div>
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(([key, w]) => (
                      <tr key={key} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 capitalize text-fg">{key.replace(/_/g, " ")}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-subtle">per {w.unit}</td>
                        <td className="px-4 py-2 text-right font-mono text-accent">{w.aw}</td>
                        <td className="px-4 py-2 text-right text-subtle">
                          {[...w.sdg, ...(w.ebf?.map((e) => `EBF:${e}`) ?? [])].join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Section>

        <Section id="sm" title="SM: Scope Multiplier">
          <p>Rewards reach. Applied per action by its quantity:</p>
          <ul className="ml-4 list-disc space-y-1">
            {SCOPE_TIERS.map((t) => (
              <li key={t.min}>
                quantity ≥ {t.min.toLocaleString()} → <span className="text-accent">×{t.multiplier}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="tbv" title="TBV: Time-Based Value">
          <p>
            Longer, sustained programmes count for more: <span className="font-mono">1 + 0.1 × years</span>,
            capped at <span className="text-accent">×2.0</span>. With no reporting period given, TBV = 1.0.
          </p>
        </Section>

        <Section id="esm" title="ESM: Environmental Sensitivity Multiplier">
          <p>
            Applied to <b>environmental</b> actions only, by where the work happened (sensitive
            ecosystems weigh more). Beta uses a rule-based region table; later releases will use geospatial
            datasets (WDPA / Aqueduct). Default 1.0.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESM_BY_REGION).map(([region, m]) => (
              <span key={region} className="tag">
                {region.replace(/_/g, " ")} <span className="text-accent">×{m}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section id="pim" title="PIM: Population Impact Multiplier">
          <p>How many people the work reaches, by population density of the area:</p>
          <ul className="ml-4 list-disc space-y-1">
            {Object.entries(PIM_BY_DENSITY).map(([d, m]) => (
              <li key={d}>
                {d.replace(/_/g, " ")} → <span className="text-accent">×{m}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="acdm" title="ACDM: Action Complexity & Difficulty">
          <p>
            The average of five self-reported answers (each mapped to a multiplier). Harder, more
            regulated, larger-scale work scores higher:
          </p>
          <div className="space-y-3">
            {Object.entries(ACDM_SCALES).map(([q, scale]) => (
              <div key={q}>
                <div className="font-semibold capitalize text-fg">{q.replace(/([A-Z])/g, " $1").toLowerCase()}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-subtle">
                  {Object.entries(scale).map(([level, m]) => (
                    <span key={level} className="tag">
                      {level} <span className="text-accent">×{m}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="integrity" title="Anti-gaming & integrity">
          <ul className="ml-4 list-disc space-y-1">
            <li>Each action quantity is clamped to {MAX_ACTION_QUANTITY.toLocaleString()} before scoring.</li>
            <li>Tables are versioned; a score is always stamped with the version that produced it.</li>
            <li>The LLM extracts but never scores; its output is validated before it reaches the formula.</li>
            <li>Every IV ships with a full per-factor breakdown (see any submission&apos;s detail page).</li>
            <li>Human verification is required before an impact is tokenised; the score only assists.</li>
          </ul>
        </Section>

        <Section id="disclaimer" title="Status & honesty">
          <p>
            These weights and multipliers are <b>seed values</b> ({TABLES_VERSION}) spanning the full
            impact spectrum. They are <b>platform-assessed and not third-party certified</b>. They are
            meant to be calibrated with domain experts and published openly. Impact Value is a
            transparency and comparison signal, not a financial valuation; price is set by the creator.
          </p>
        </Section>
      </div>
      </div>
      </div>
    </main>
  );
}
