"use client";

import { useMemo, useState } from "react";
import { ruleBasedExtract, computeImpactValue } from "@rb/impact-engine";
import type { ComplexityAnswers, PopulationDensity } from "@rb/impact-engine";

const DOMAINS = ["environment", "animal_welfare", "education", "poverty", "social", "health"];
const REGIONS = ["temperate", "urban", "southeast_asia", "amazon", "congo_basin", "coral_reef", "protected_area"];
const DENSITY: PopulationDensity[] = ["low", "medium", "high", "very_high"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs uppercase tracking-wide text-paper/55">{children}</label>;
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm text-paper outline-none focus:border-gold"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-ink-soft">
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export default function Tokenize() {
  const [title, setTitle] = useState("Beach reforestation & cleanup — Koh Phangan");
  const [description, setDescription] = useState(
    "1000 trees planted and 5 workshops held. Collected 1500 kg of plastic from the coastline.",
  );
  const [domain, setDomain] = useState("environment");
  const [regionCode, setRegionCode] = useState("southeast_asia");
  const [density, setDensity] = useState<PopulationDensity>("medium");
  const [periodStart, setPeriodStart] = useState("2024-01-01");
  const [periodEnd, setPeriodEnd] = useState("2025-01-01");
  const [complexity, setComplexity] = useState<ComplexityAnswers>({
    technicalExpertise: "medium",
    resourceIntensity: "medium",
    projectScale: "city",
    regulatory: "low",
    environmentalConditions: "challenging",
  });
  const [mediaText, setMediaText] = useState("");
  const mediaUris = mediaText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const iv = useMemo(
    () =>
      computeImpactValue(ruleBasedExtract(description), {
        regionCode,
        populationDensity: density,
        complexity,
        periodStart,
        periodEnd,
      }),
    [description, regionCode, density, complexity, periodStart, periodEnd],
  );

  const setC = (k: keyof ComplexityAnswers) => (v: string) =>
    setComplexity((c) => ({ ...c, [k]: v }) as ComplexityAnswers);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string; impactValue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          domain,
          mediaUris,
          context: { regionCode, populationDensity: density, complexity, periodStart, periodEnd },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Tokenize impact</h1>
      <p className="mt-2 text-paper/70">
        Describe the real-world impact you delivered. The Impact Value updates live as you go.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* form */}
        <div className="space-y-6">
          <div>
            <Label>Title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <Label>What did you do? (free text)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <p className="mt-1 text-xs text-paper/45">
              Beta uses keyword parsing; the live app uses an LLM extractor server-side.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Domain</Label>
              <Select value={domain} onChange={setDomain} options={DOMAINS} />
            </div>
            <div>
              <Label>Region</Label>
              <Select value={regionCode} onChange={setRegionCode} options={REGIONS} />
            </div>
            <div>
              <Label>Population density</Label>
              <Select value={density} onChange={(v) => setDensity(v as PopulationDensity)} options={DENSITY} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>From</Label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
              <div>
                <Label>To</Label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm text-gold">Complexity (ACDM)</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Technical expertise</Label>
                <Select value={complexity.technicalExpertise} onChange={setC("technicalExpertise")} options={["low", "medium", "high"]} />
              </div>
              <div>
                <Label>Resource intensity</Label>
                <Select value={complexity.resourceIntensity} onChange={setC("resourceIntensity")} options={["low", "medium", "high"]} />
              </div>
              <div>
                <Label>Project scale</Label>
                <Select value={complexity.projectScale} onChange={setC("projectScale")} options={["local", "city", "regional"]} />
              </div>
              <div>
                <Label>Regulatory</Label>
                <Select value={complexity.regulatory} onChange={setC("regulatory")} options={["low", "medium", "high"]} />
              </div>
              <div>
                <Label>Environmental conditions</Label>
                <Select value={complexity.environmentalConditions} onChange={setC("environmentalConditions")} options={["easy", "moderate", "challenging"]} />
              </div>
            </div>
          </div>

          <div>
            <Label>Media (optional) — photo/video URLs, one per line</Label>
            <textarea
              value={mediaText}
              onChange={(e) => setMediaText(e.target.value)}
              rows={2}
              placeholder="https://…/photo1.jpg"
              className="w-full rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
            />
            {mediaUris.length > 0 && (
              <p className="mt-1 text-xs text-paper/45">{mediaUris.length} link(s) attached</p>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-md bg-gold px-5 py-3 font-semibold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit for verification"}
            </button>
            {result && (
              <div className="rounded-md border border-green/40 bg-green/15 px-4 py-3 text-sm">
                Submitted ✓ — status <b>{result.status.replace(/_/g, " ")}</b>, Impact Value{" "}
                <b className="text-gold">{result.impactValue.toLocaleString()}</b>. Now in the{" "}
                <a href="/verify" className="underline">verification queue</a>.
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* live IV preview */}
        <aside className="h-fit lg:sticky lg:top-6">
          <div className="rounded-xl border border-gold/25 bg-ink-soft/60 p-6">
            <div className="text-xs uppercase tracking-wide text-paper/55">Impact Value (live)</div>
            <div className="mt-1 text-5xl font-bold text-gold">{iv.impactValue.toLocaleString()}</div>
            <div className="mt-1 text-[11px] text-paper/45">
              platform-assessed (beta) · not third-party certified ·{" "}
              <a href="/methodology" className="underline hover:text-gold">{iv.tablesVersion}</a>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-paper/55">Frameworks</div>
              <div className="flex flex-wrap gap-1.5">
                {iv.frameworkTags.sdg.map((s) => (
                  <span key={s} className="rounded-full bg-green/30 px-2.5 py-1 text-xs text-paper">{s}</span>
                ))}
                {iv.frameworkTags.ebf.map((e) => (
                  <span key={e} className="rounded-full border border-gold/40 px-2.5 py-1 text-xs text-gold">EBF: {e}</span>
                ))}
                {iv.breakdown.length === 0 && <span className="text-xs text-paper/40">No recognised actions yet.</span>}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-paper/55">Breakdown</div>
              <div className="space-y-2">
                {iv.breakdown.map((b) => (
                  <div key={b.actionType} className="rounded-md bg-ink/60 px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-paper/85">{b.actionType.replace(/_/g, " ")}</span>
                      <span className="text-gold">{b.raw.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-paper/45">
                      {b.quantity} × AW {b.aw} · SM {b.sm} · TBV {b.tbv.toFixed(2)} · ESM {b.esm} · PIM {b.pim} · ACDM {b.acdm.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
