"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { ruleBasedExtract, computeImpactValue, computePrice } from "@rb/impact-engine";
import { useNetwork } from "../../components/NetworkProvider";
import type { ComplexityAnswers, PopulationDensity } from "@rb/impact-engine";
import { FrameworkTag } from "../../components/FrameworkTag";

const DOMAINS = ["environment", "animal_welfare", "education", "poverty", "social", "health"];
const REGIONS = ["temperate", "urban", "southeast_asia", "amazon", "congo_basin", "coral_reef", "protected_area"];
const DENSITY: PopulationDensity[] = ["low", "medium", "high", "very_high"];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-muted">{children}</label>;
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
      className="field"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-surface">
          {o.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

export default function Tokenize() {
  const NETWORK = useNetwork();
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
  const [orgName, setOrgName] = useState("");
  const [payoutWallet, setPayoutWallet] = useState("");
  const { address } = useAccount();
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

  const price = useMemo(() => computePrice(iv.impactValue, 100), [iv.impactValue]);

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
          orgName: orgName || undefined,
          payoutWallet: payoutWallet || undefined,
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
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Tokenize impact</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Describe the real-world impact you delivered. The Impact Value updates live as you go.
      </p>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-16">
        {/* form */}
        <div className="max-w-[820px] space-y-8">
          <div>
            <Label>Title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <Label>What did you do? (free text)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="field"
            />
            <p className="mt-2 text-sm text-subtle">
              Write it as you would to a funder: what, how many, where. The live preview uses quick keyword
              matching; on submit our AI extractor re-reads the report, so the final Impact Value can differ slightly.
            </p>
          </div>
          <fieldset className="card p-5 md:p-6">
            <legend className="sr-only">Your organisation</legend>
            <h2 className="mb-4 text-2xl">Your organisation</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Organisation name</Label>
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Green Coast Community"
                  className="field"
                />
              </div>
              <div>
                <Label>Payout wallet (receives {NETWORK.saleCurrency.symbol})</Label>
                <input
                  value={payoutWallet}
                  onChange={(e) => setPayoutWallet(e.target.value)}
                  placeholder="0x…"
                  className="w-full field font-mono"
                />
                {address && payoutWallet !== address && (
                  <button type="button" onClick={() => setPayoutWallet(address)} className="link mt-2 text-sm">
                    Use my connected wallet
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-subtle">
              Every sale pays this wallet directly, in the same transaction. Use a regular wallet (e.g. MetaMask), not a
              multisig. Leave both empty to submit as the demo organisation (sample data).
            </p>
          </fieldset>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <Label>To</Label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="field"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl">How hard was it? (complexity)</h2>
            <p className="mb-4 mt-1 text-sm text-subtle">Harder conditions raise the Impact Value slightly (ACDM factor).</p>
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
            <Label>Media (optional): photo/video URLs, one per line</Label>
            <textarea
              value={mediaText}
              onChange={(e) => setMediaText(e.target.value)}
              rows={2}
              placeholder="https://…/photo1.jpg"
              className="field"
            />
            {mediaUris.length > 0 && (
              <p className="mt-2 text-sm text-subtle">{mediaUris.length} link(s) attached</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-subtle">
              This report will be listed on <b>{NETWORK.chain.name}</b> only (switch networks in the header before
              submitting). One report is never listed on several networks.
            </p>
            <button
              onClick={submit}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? "Submitting…" : "Submit for verification"}
            </button>
            {result && (
              <div className="rounded-xl border border-ok/40 bg-ok-tint px-4 py-3">
                Submitted ✓ Status <b>{result.status.replace(/_/g, " ")}</b>, Impact Value{" "}
                <b className="text-accent">{result.impactValue.toLocaleString()}</b>. Next: the Regen Bazaar team reviews it. Once approved, it is attested on-chain and appears in the{" "}
                <a href="/marketplace" className="link">Marketplace</a> on {NETWORK.chain.name} only.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-danger/40 bg-danger-tint px-4 py-3 text-danger">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* live IV preview */}
        <aside className="lg:sticky lg:top-24">
          <div className="card p-6">
            <div className="label-mono">Impact Value (live preview)</div>
            <div className="mt-1 font-display text-6xl text-accent">{iv.impactValue.toLocaleString()}</div>
            <div className="mt-2 text-sm text-subtle">
              platform-assessed (beta) · not third-party certified ·{" "}
              <a href="/methodology" className="underline underline-offset-4 hover:text-accent">{iv.tablesVersion}</a>
            </div>

            <div className="mt-5 rounded-xl bg-raised p-4">
              <div className="label-mono">Suggested price (formula)</div>
              <div className="mt-1 text-2xl font-semibold text-fg">
                {price.totalPrice.toLocaleString()} {NETWORK.saleCurrency.symbol}{" "}
                <span className="text-sm text-subtle">total</span>
              </div>
              <div className="mt-1 text-sm text-subtle">
                ≈ {price.pricePerEdition.toLocaleString()} {NETWORK.saleCurrency.symbol} per edition × 100 editions · IV ×{" "}
                {price.rate} · {price.modelVersion}
              </div>
            </div>

            <div className="mt-5">
              <div className="label-mono mb-2">Frameworks</div>
              <div className="flex flex-wrap gap-1.5">
                {iv.frameworkTags.sdg.map((s) => (
                  <FrameworkTag key={s} kind="sdg" value={s} />
                ))}
                {iv.frameworkTags.ebf.map((e) => (
                  <FrameworkTag key={e} kind="ebf" value={e} />
                ))}
                {iv.breakdown.length === 0 && <span className="text-sm text-subtle">No recognised actions yet.</span>}
              </div>
            </div>

            <div className="mt-5">
              <div className="label-mono mb-1">Breakdown</div>
              <p className="mb-3 text-sm text-subtle">
                AW action weight · SM scope · TBV time · ESM environmental sensitivity · PIM population · ACDM complexity.{" "}
                <a href="/methodology" className="underline underline-offset-4 hover:text-accent">Methodology</a>
              </p>
              <div className="space-y-2">
                {iv.breakdown.map((b) => (
                  <div key={b.actionType} className="rounded-xl bg-raised px-4 py-3">
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold capitalize">{b.actionType.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-accent">{b.raw.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 font-mono text-sm text-subtle">
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
