"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  ACTION_WEIGHTS_V02,
  GRID_FACTORS,
  computeImpactValueV02,
  ruleBasedExtract,
  type ComplexityAnswers,
  type Ecosystem,
  type ExtractedActionV02,
} from "@rb/impact-engine";
import { useNetwork } from "../../components/NetworkProvider";
import { FrameworkTag } from "../../components/FrameworkTag";
import { ErrorNote } from "../../components/ErrorNote";
import { DomainScores } from "../../components/ImpactBadges";
import { DOMAIN_KEYS, DOMAIN_LABEL, fmt } from "../../lib/impact-view";

const STEPS = ["What you did", "Check actions", "Where", "Proof", "Complexity", "Review"] as const;
const ECOSYSTEMS: Ecosystem[] = ["mangrove", "forest", "coral_reef", "seagrass", "grassland", "coast", "urban", "other"];
const REGISTRIES = [
  ["none", "Not registered anywhere else"],
  ["verra", "Verra"],
  ["gold_standard", "Gold Standard"],
  ["plan_vivo", "Plan Vivo"],
  ["hypercerts", "Hypercerts"],
  ["other", "Other"],
] as const;
const COMPLEXITY: { key: keyof ComplexityAnswers; label: string; options: string[] }[] = [
  { key: "technicalExpertise", label: "Technical expertise", options: ["low", "medium", "high"] },
  { key: "resourceIntensity", label: "Resource intensity", options: ["low", "medium", "high"] },
  { key: "projectScale", label: "Project scale", options: ["local", "city", "regional"] },
  { key: "regulatory", label: "Permits and regulation", options: ["low", "medium", "high"] },
  { key: "environmentalConditions", label: "Working conditions", options: ["easy", "moderate", "challenging"] },
];
const AREA_ACTIONS = ["trees_planted", "mangroves_planted"];
const SURVIVAL_ACTIONS = ["trees_planted", "mangroves_planted", "coral_planted"];

const EXAMPLE = {
  title: "Mangrove planting and beach cleanup, Koh Phangan",
  description:
    "In March 2026 our volunteers planted 3000 mangroves on 1.2 hectares at Thong Nai Pan and collected 380 kg of plastic waste from the beach. We taught 30 students about coastal ecosystems.",
  country: "TH",
  ecosystem: "mangrove" as Ecosystem,
  lat: "9.7870",
  lon: "100.0580",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
  proofText: "https://www.facebook.com/example/posts/1\nhttps://www.instagram.com/p/example",
};

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-muted">
      {children}
    </label>
  );
}

function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | readonly [string, string])[];
  placeholder?: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="field">
      <option value="" className="bg-surface">
        {placeholder}
      </option>
      {options.map((o) => {
        const [v, l] = typeof o === "string" ? [o, o.replace(/_/g, " ")] : o;
        return (
          <option key={v} value={v} className="bg-surface">
            {l}
          </option>
        );
      })}
    </select>
  );
}

function num(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

type ComplexityDraft = Partial<Record<keyof ComplexityAnswers, string>>;

export default function Tokenize() {
  const NETWORK = useNetwork();
  const { address } = useAccount();
  const [step, setStep] = useState(0);

  // 1. what
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [orgName, setOrgName] = useState("");
  const [payoutWallet, setPayoutWallet] = useState("");
  // 2. actions (seeded from the text, then edited by the submitter)
  const [actions, setActions] = useState<ExtractedActionV02[]>([]);
  const [actionsFromText, setActionsFromText] = useState("");
  // 3. where
  const [country, setCountry] = useState("");
  const [ecosystem, setEcosystem] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [adjacent, setAdjacent] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  // 4. proof
  const [proofText, setProofText] = useState("");
  const [mediaText, setMediaText] = useState("");
  const [registry, setRegistry] = useState("");
  const [serial, setSerial] = useState("");
  // 5. complexity (price only)
  const [complexity, setComplexity] = useState<ComplexityDraft>({});

  const lines = (t: string) => t.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const proofLinks = lines(proofText);
  const mediaUris = lines(mediaText);

  // Re-read the text when it changes, unless the submitter has already edited the list for this text.
  useEffect(() => {
    if (step === 1 && description !== actionsFromText) {
      setActions(ruleBasedExtract(description));
      setActionsFromText(description);
    }
  }, [step, description, actionsFromText]);

  const ctx = useMemo(
    () => ({
      country: country || undefined,
      ecosystem: (ecosystem || undefined) as Ecosystem | undefined,
      adjacentToHabitat: adjacent || undefined,
      registry: registry && registry !== "none" ? { standard: registry, serial: serial || undefined } : undefined,
    }),
    [country, ecosystem, adjacent, registry, serial],
  );
  const scored = actionsFromText === description ? actions : ruleBasedExtract(description);
  const iv = useMemo(() => computeImpactValueV02(scored, ctx), [scored, ctx]);

  const complexityCount = Object.values(complexity).filter(Boolean).length;
  const expectedP = proofLinks.length + mediaUris.length >= 2 ? "P2" : proofLinks.length >= 1 ? "P1" : "P0";

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title (step 1).");
  if (!description.trim()) problems.push("Describe what you did (step 1).");
  if ((lat || lon) && (num(lat) === undefined || num(lon) === undefined)) problems.push("Give both latitude and longitude as numbers (step 3).");
  if (periodStart && periodEnd && periodEnd < periodStart) problems.push("The end date is before the start date (step 3).");
  if (!proofLinks.length) problems.push("Add at least one public link as proof (step 4). Reports without proof (P0) are not listed.");
  if (proofLinks.some((u) => !u.startsWith("https://"))) problems.push("Proof links must start with https:// (step 4).");
  if (complexityCount > 0 && complexityCount < COMPLEXITY.length) problems.push("Answer all five complexity questions or none (step 5).");

  function fillExample() {
    setTitle(EXAMPLE.title);
    setDescription(EXAMPLE.description);
    setDomain("environment");
    setActions([
      { actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.2 },
      { actionType: "waste_collected_kg", quantity: 380, unit: "kg" },
      { actionType: "students_taught", quantity: 30, unit: "students" },
    ]);
    setActionsFromText(EXAMPLE.description);
    setCountry(EXAMPLE.country);
    setEcosystem(EXAMPLE.ecosystem);
    setLat(EXAMPLE.lat);
    setLon(EXAMPLE.lon);
    setPeriodStart(EXAMPLE.periodStart);
    setPeriodEnd(EXAMPLE.periodEnd);
    setProofText(EXAMPLE.proofText);
    setRegistry("none");
  }

  const updateAction = (i: number, patch: Partial<ExtractedActionV02>) =>
    setActions((xs) => xs.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; status: string; impactValue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (problems.length) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const la = num(lat);
      const lo = num(lon);
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          domain: domain || undefined,
          mediaUris,
          proofLinks,
          orgName: orgName || undefined,
          payoutWallet: payoutWallet || undefined,
          actions: actionsFromText === description ? actions : undefined,
          location: la !== undefined && lo !== undefined ? { lat: la, lon: lo, ecosystem: ecosystem || undefined } : undefined,
          registry: registry ? { standard: registry, serial: serial || undefined } : undefined,
          context: {
            country: country || undefined,
            ecosystem: ecosystem || undefined,
            adjacentToHabitat: adjacent || undefined,
            periodStart: periodStart || undefined,
            periodEnd: periodEnd || undefined,
            complexity: complexityCount === COMPLEXITY.length ? complexity : undefined,
          },
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

  const flags = iv.flags.filter((f) => ["needs_area", "unit_mismatch", "needs_country", "registry_required", "double_count"].includes(f.code));

  return (
    <main className="page-wrap py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Tokenize impact</h1>
          <p className="mt-3 max-w-[70ch] text-lg text-muted">
            Tell us what you did, check the actions we found, add where and the proof. A validator reviews every report
            before it is listed.
          </p>
        </div>
        <button type="button" onClick={fillExample} className="btn">
          Fill example
        </button>
      </div>

      <ol className="mt-8 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm ${i === step ? "border-accent text-accent" : "border-line text-muted hover:text-fg"}`}
            >
              {i + 1} {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-16">
        <div className="max-w-[820px] space-y-8">
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="title">Title *</Label>
                <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Beach cleanup, Haad Rin" className="field" />
              </div>
              <div>
                <Label htmlFor="desc">What did you do? *</Label>
                <textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="What, how many, where, when. For planting, say the area or planting density."
                  className="field"
                />
                <p className="mt-2 text-sm text-subtle">
                  Our AI only reads the text and lists the actions it states; it never sets the score.
                </p>
              </div>
              <div>
                <Label htmlFor="domain">Main area (optional)</Label>
                <Select
                  id="domain"
                  value={domain}
                  onChange={setDomain}
                  options={DOMAIN_KEYS.map((d) => [d, DOMAIN_LABEL[d]] as const)}
                  placeholder="Detected from the actions"
                />
              </div>
              <fieldset className="card p-5 md:p-6">
                <legend className="sr-only">Your organisation</legend>
                <h2 className="mb-4 text-2xl">Your organisation</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="org">Organisation name</Label>
                    <input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Green Coast Community" className="field" />
                  </div>
                  <div>
                    <Label htmlFor="wallet">Payout wallet (receives {NETWORK.saleCurrency.symbol})</Label>
                    <input id="wallet" value={payoutWallet} onChange={(e) => setPayoutWallet(e.target.value)} placeholder="0x…" className="w-full field font-mono" />
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
            </>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-subtle">
                Actions found in your text. Correct numbers and units if needed; for planting, add the planted area or
                density so carbon can be counted. Your corrections are shown to the validator next to the AI reading.
              </p>
              {actions.length === 0 && <p className="text-muted">No actions recognised yet. Add numbers to your text in step 1.</p>}
              {actions.map((a, i) => {
                const w = ACTION_WEIGHTS_V02[a.actionType];
                return (
                  <div key={`${a.actionType}-${i}`} className="card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold capitalize">{a.actionType.replace(/_/g, " ")}</span>
                      <button type="button" className="link text-sm" onClick={() => setActions((xs) => xs.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label>Quantity</Label>
                        <input
                          inputMode="decimal"
                          value={String(a.quantity)}
                          onChange={(e) => updateAction(i, { quantity: Number(e.target.value) || 0 })}
                          className="field"
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <input value={a.unit} onChange={(e) => updateAction(i, { unit: e.target.value.slice(0, 30) })} className="field" />
                        {w && <p className="mt-1 text-xs text-subtle">counted in {w.inputUnit}</p>}
                      </div>
                      {AREA_ACTIONS.includes(a.actionType) && (
                        <div>
                          <Label>Planted area, ha</Label>
                          <input
                            inputMode="decimal"
                            value={a.areaHa ?? ""}
                            onChange={(e) => updateAction(i, { areaHa: num(e.target.value) })}
                            placeholder="e.g. 1.2"
                            className="field"
                          />
                        </div>
                      )}
                      {SURVIVAL_ACTIONS.includes(a.actionType) && (
                        <div>
                          <Label>Survived, % (if measured)</Label>
                          <input
                            inputMode="decimal"
                            value={a.survivalRate !== undefined ? String(Math.round(a.survivalRate * 100)) : ""}
                            onChange={(e) => {
                              const p = num(e.target.value);
                              updateAction(i, { survivalRate: p !== undefined ? Math.min(Math.max(p, 0), 100) / 100 : undefined });
                            }}
                            className="field"
                          />
                        </div>
                      )}
                      {a.actionType === "mangroves_planted" && (
                        <div>
                          <Label>Mangrove form</Label>
                          <Select value={a.mangroveForm ?? ""} onChange={(v) => updateAction(i, { mangroveForm: (v || undefined) as "tree" | "shrub" | undefined })} options={["tree", "shrub"]} placeholder="Tree (default)" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  id="country"
                  value={country}
                  onChange={setCountry}
                  options={Object.keys(GRID_FACTORS)}
                  placeholder="Other or not listed"
                />
              </div>
              <div>
                <Label htmlFor="eco">Ecosystem</Label>
                <Select id="eco" value={ecosystem} onChange={setEcosystem} options={ECOSYSTEMS} />
              </div>
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 9.7870" className="field" />
              </div>
              <div>
                <Label htmlFor="lon">Longitude</Label>
                <input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="e.g. 100.0580" className="field" />
              </div>
              <div>
                <Label htmlFor="from">From</Label>
                <input id="from" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="field" />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <input id="to" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="field" />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                <input type="checkbox" checked={adjacent} onChange={(e) => setAdjacent(e.target.checked)} />
                The site joins existing forest, mangrove or reef (no small-patch discount)
              </label>
              <p className="text-sm text-subtle sm:col-span-2">
                Coordinates let a validator check the site against open maps (mangroves, reefs, forest). Environmental
                sensitivity (1.0 to 1.3) is set only after that check. Exact coordinates are never put in token metadata.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="proof">Public links: posts, website, report (one per line, up to 10) *</Label>
                <textarea id="proof" value={proofText} onChange={(e) => setProofText(e.target.value)} rows={3} placeholder="https://…" className="field" />
                <p className="mt-2 text-sm text-subtle">
                  We save a copy (hash and date) and check dates, numbers and place. If a page needs a login, add a
                  screenshot link below.
                </p>
              </div>
              <div>
                <Label htmlFor="media">Photos, videos or screenshots (links, one per line)</Label>
                <textarea id="media" value={mediaText} onChange={(e) => setMediaText(e.target.value)} rows={2} placeholder="https://…/photo1.jpg" className="field" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="registry">Is this work registered anywhere else?</Label>
                  <Select id="registry" value={registry} onChange={setRegistry} options={REGISTRIES} />
                </div>
                {registry && registry !== "none" && (
                  <div>
                    <Label htmlFor="serial">Registry serial number</Label>
                    <input id="serial" value={serial} onChange={(e) => setSerial(e.target.value.slice(0, 100))} className="field font-mono" />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-raised p-4 text-sm text-muted">
                <b>Proof levels.</b> P1 one public link · P2 photos with date and place, or two independent posts · P3 a
                partner, authority or community validator confirms · P4 measurement or registry. The validator sets the level.
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-4 text-sm text-subtle">
                Optional. Complexity does not change the impact score; it is used for the price, because harder work costs
                more. Answer all five or leave all empty.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {COMPLEXITY.map((q) => (
                  <div key={q.key}>
                    <Label htmlFor={q.key}>{q.label}</Label>
                    <Select id={q.key} value={complexity[q.key] ?? ""} onChange={(v) => setComplexity((c) => ({ ...c, [q.key]: v || undefined }))} options={q.options} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
                <dt className="text-subtle">Title</dt>
                <dd>{title || "not given"}</dd>
                <dt className="text-subtle">Actions</dt>
                <dd>{scored.map((a) => `${fmt(a.quantity)} ${a.unit} ${a.actionType.replace(/_/g, " ")}`).join(", ") || "not given"}</dd>
                <dt className="text-subtle">Where</dt>
                <dd>{[country, ecosystem.replace(/_/g, " "), lat && lon ? `${lat}, ${lon}` : ""].filter(Boolean).join(" · ") || "not given"}</dd>
                <dt className="text-subtle">Period</dt>
                <dd>{[periodStart, periodEnd].filter(Boolean).join(" to ") || "not given"}</dd>
                <dt className="text-subtle">Proof</dt>
                <dd>{proofLinks.length} link(s), {mediaUris.length} media</dd>
              </dl>
              {problems.length > 0 && (
                <ul className="list-disc space-y-1 rounded-xl border border-danger/40 bg-danger-tint px-8 py-3 text-sm text-danger">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-subtle">
                This report will be listed on <b>{NETWORK.chain.name}</b> only (switch networks in the header before
                submitting). One report is never listed on several networks.
              </p>
              <button onClick={submit} disabled={submitting || problems.length > 0} className="btn btn-primary">
                {submitting ? "Submitting…" : "Submit for verification"}
              </button>
              {result && (
                <div className="rounded-xl border border-ok/40 bg-ok-tint px-4 py-3">
                  Submitted ✓ Status <b>{result.status.replace(/_/g, " ")}</b>. Next: a validator checks the proof and sets
                  its level. Once approved, it is attested on-chain and appears in the{" "}
                  <a href="/marketplace" className="link">Marketplace</a> on {NETWORK.chain.name} only.{" "}
                  <a href={`/submission/${result.id}`} className="link">Open the report</a>
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-danger/40 bg-danger-tint px-4 py-3 text-danger">
                  <ErrorNote text={`Error: ${error}`} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button type="button" className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                Next: {STEPS[step + 1]}
              </button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="card p-6">
            <div className="label-mono">Preview · methodology v0.2</div>
            <div className="mt-3">
              <DomainScores scores={iv.domainScores} />
            </div>
            {flags.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-muted">
                {flags.map((f, i) => (
                  <li key={i}>⚠ {f.actionType ? `${f.actionType.replace(/_/g, " ")}: ` : ""}{f.detail}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-raised p-4">
                <div className="label-mono">Proof</div>
                <div className="mt-1 text-xl font-semibold">expected {expectedP}</div>
                <div className="text-xs text-subtle">set by a validator</div>
              </div>
              <div className="rounded-xl bg-raised p-4">
                <div className="label-mono">Price</div>
                <div className="mt-1 text-xl font-semibold">after review</div>
                <div className="text-xs text-subtle">from IV and proof level</div>
              </div>
            </div>
            <div className="mt-5 text-sm text-subtle">
              Impact Value (all areas): <b className="text-fg">{fmt(iv.impactValue)}</b> · Regen Bazaar&apos;s own relative
              index, not a certification ·{" "}
              <a href="/methodology" className="underline underline-offset-4 hover:text-accent">
                how it is scored
              </a>
            </div>
            {(iv.frameworkTags.sdg.length > 0 || iv.frameworkTags.ebf.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {iv.frameworkTags.sdg.map((s) => (
                  <FrameworkTag key={s} kind="sdg" value={s} />
                ))}
                {iv.frameworkTags.ebf.map((e) => (
                  <FrameworkTag key={e} kind="ebf" value={e} />
                ))}
              </div>
            )}
            {iv.breakdown.length > 0 && (
              <div className="mt-5 space-y-2">
                <div className="label-mono">Breakdown</div>
                {iv.breakdown.map((b) => (
                  <div key={b.actionType} className="rounded-xl bg-raised px-4 py-3">
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold capitalize">{b.actionType.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-accent">{fmt(b.raw, 2)}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-subtle">
                      {fmt(b.units, 2)} {b.scoredUnit} × AW {b.aw} · SM {b.sm} · ESM {b.esm} · S {b.s}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
