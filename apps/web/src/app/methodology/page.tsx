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
  title: "Methodology — Regen Bazaar",
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
    <section id={id} className="border-t border-gold/15 pt-8">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-paper/80">{children}</div>
    </section>
  );
}

export default function Methodology() {
  const byDomain = Object.entries(ACTION_WEIGHTS).reduce<Record<string, [string, (typeof ACTION_WEIGHTS)[string]][]>>(
    (acc, [k, v]) => {
      (acc[v.domain] ??= []).push([k, v]);
      return acc;
    },
    {},
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Impact Value methodology</h1>
      <p className="mt-2 text-paper/70">
        How we turn an NGO&apos;s report into a single, comparable Impact Value (IV). The method is
        deterministic, auditable, and versioned — the same input and table version always produce the
        same score.
      </p>
      <div className="mt-4 inline-block rounded-md border border-gold/30 bg-ink-soft/50 px-3 py-2 text-xs text-paper/70">
        Active table version: <span className="text-gold">{TABLES_VERSION}</span>
      </div>

      <div className="mt-6 rounded-lg border border-gold/25 bg-ink-soft/50 p-5 text-center">
        <div className="text-xs uppercase tracking-wide text-paper/55">Per action</div>
        <div className="mt-2 font-mono text-lg text-paper">
          IV = Σ ( AW × SM × TBV × ESM × PIM × ACDM )
        </div>
      </div>

      <div className="mt-10 space-y-8">
        <Section id="extraction" title="0. Extraction (LLM) vs scoring (deterministic)">
          <p>
            A language model reads the free-text report and extracts a structured list of actions
            (type, quantity, unit). That is <b>all</b> the model does. It never assigns value. The
            score below is a pure function of the extracted numbers and the published tables, so it is
            reproducible and cannot be talked up by clever wording. If the model is unavailable, a
            deterministic keyword parser is used instead.
          </p>
        </Section>

        <Section id="aw" title="AW — Action Weight">
          <p>
            Each recognised action maps to a base weight and a set of framework tags (UN SDGs, plus the
            Ecological Benefits Framework for environmental actions). Unknown actions score zero until
            added to the table. Current seed table:
          </p>
          {Object.entries(byDomain).map(([domain, rows]) => (
            <div key={domain} className="mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-gold/80">
                {DOMAIN_LABEL[domain as ImpactDomain] ?? domain}
              </div>
              <div className="overflow-hidden rounded-md border border-gold/15">
                <table className="w-full text-xs">
                  <tbody>
                    {rows.map(([key, w]) => (
                      <tr key={key} className="border-b border-gold/10 last:border-0">
                        <td className="px-3 py-1.5 text-paper/85">{key.replace(/_/g, " ")}</td>
                        <td className="px-3 py-1.5 text-paper/50">per {w.unit}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gold">{w.aw}</td>
                        <td className="px-3 py-1.5 text-right text-paper/45">
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

        <Section id="sm" title="SM — Scope Multiplier">
          <p>Rewards reach. Applied per action by its quantity:</p>
          <ul className="ml-4 list-disc space-y-1">
            {SCOPE_TIERS.map((t) => (
              <li key={t.min}>
                quantity ≥ {t.min.toLocaleString()} → <span className="text-gold">×{t.multiplier}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="tbv" title="TBV — Time-Based Value">
          <p>
            Longer, sustained programmes count for more: <span className="font-mono">1 + 0.1 × years</span>,
            capped at <span className="text-gold">×2.0</span>. With no reporting period given, TBV = 1.0.
          </p>
        </Section>

        <Section id="esm" title="ESM — Environmental Sensitivity Multiplier">
          <p>
            Applied to <b>environmental</b> actions only, by where the work happened (sensitive
            ecosystems weigh more). Beta uses a rule-based region table; later releases will use geospatial
            datasets (WDPA / Aqueduct). Default 1.0.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESM_BY_REGION).map(([region, m]) => (
              <span key={region} className="rounded-full border border-gold/25 px-2.5 py-1 text-xs">
                {region.replace(/_/g, " ")} <span className="text-gold">×{m}</span>
              </span>
            ))}
          </div>
        </Section>

        <Section id="pim" title="PIM — Population Impact Multiplier">
          <p>How many people the work reaches, by population density of the area:</p>
          <ul className="ml-4 list-disc space-y-1">
            {Object.entries(PIM_BY_DENSITY).map(([d, m]) => (
              <li key={d}>
                {d.replace(/_/g, " ")} → <span className="text-gold">×{m}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="acdm" title="ACDM — Action Complexity & Difficulty">
          <p>
            The average of five self-reported answers (each mapped to a multiplier). Harder, more
            regulated, larger-scale work scores higher:
          </p>
          <div className="space-y-3">
            {Object.entries(ACDM_SCALES).map(([q, scale]) => (
              <div key={q} className="text-xs">
                <div className="text-paper/85">{q.replace(/([A-Z])/g, " $1").toLowerCase()}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-paper/55">
                  {Object.entries(scale).map(([level, m]) => (
                    <span key={level} className="rounded border border-gold/15 px-2 py-0.5">
                      {level} <span className="text-gold">×{m}</span>
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
            <li>Human verification is required before an impact is tokenised — the score only assists.</li>
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
    </main>
  );
}
