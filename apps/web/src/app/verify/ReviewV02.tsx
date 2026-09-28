"use client";

import { useState } from "react";
import type { IVResultV02, ProofFlag, ProofLevel } from "@rb/impact-engine";
import { COST_CATEGORIES, PROOF_REQUIREMENTS, costToUsd, labourCheck, type CostDeclaration } from "@rb/impact-engine";
import { DomainScores } from "../../components/ImpactBadges";
import { fmt } from "../../lib/impact-view";

type Action = { actionType: string; quantity: number; unit: string; areaHa?: number; survivalRate?: number };
export type ProofCheck = { url: string; checkedAt: string; sha256?: string; flags: ProofFlag[]; error?: string };

export type SubmissionV02 = {
  id: string;
  ivResult: IVResultV02 | null;
  extractedActions: Action[] | null;
  context: {
    country?: string;
    ecosystem?: string;
    adjacentToHabitat?: boolean;
    esm?: number;
    periodStart?: string;
    periodEnd?: string;
    aiActions?: Action[];
    submitterEdited?: boolean;
    cost?: CostDeclaration;
  } | null;
  location: { lat: number; lon: number; ecosystem?: string } | null;
  proofLinks: string[] | null;
  proofChecks: ProofCheck[] | null;
  proofLevel: string | null;
  registryDeclaration: { standard: string; serial?: string } | null;
  esmSuggestion?: { esm: number; matches: { id: string; name: string; esm: number; attribution: string }[] } | null;
};

export interface ReviewChoice {
  proofLevel: ProofLevel | "";
  esm: string;
}

const LEVELS: ProofLevel[] = ["P0", "P1", "P2", "P3", "P4"];
const ESM_OPTIONS = ["1.0", "1.1", "1.2", "1.3"];
const SEVERITY: Record<string, string> = { ok: "text-ok", warn: "text-accent", fail: "text-danger" };
const actionText = (a: Action) =>
  `${fmt(a.quantity, 2)} ${a.unit} ${a.actionType.replace(/_/g, " ")}${a.areaHa ? ` on ${a.areaHa} ha` : ""}${a.survivalRate !== undefined ? `, ${Math.round(a.survivalRate * 100)}% survived` : ""}`;

export function ReviewV02({
  s,
  token,
  choice,
  onChoice,
}: {
  s: SubmissionV02;
  token: string;
  choice: ReviewChoice;
  onChoice: (c: ReviewChoice) => void;
}) {
  const [checks, setChecks] = useState<ProofCheck[] | null>(s.proofChecks);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const iv = s.ivResult;
  const c = s.context ?? {};
  const links = s.proofLinks ?? [];
  const environment = iv?.domainScores.some((d) => d.domain === "environment");

  async function runCheck() {
    setChecking(true);
    setCheckError("");
    const res = await fetch(`/api/submissions/${s.id}/proof`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setChecks(body.proofChecks ?? []);
    else setCheckError(body.error ?? "check failed");
    setChecking(false);
  }

  return (
    <div className="mt-5 space-y-5 border-t border-line pt-5">
      {iv && <DomainScores scores={iv.domainScores} />}

      {iv && iv.breakdown.length > 0 && (
        <div>
          <div className="label-mono mb-2">What changes IV</div>
          <div className="space-y-1.5">
            {iv.breakdown.map((b) => (
              <div key={b.actionType} className="rounded-lg bg-raised px-3 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <a href={`/methodology/cards/${b.actionType}`} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-accent">
                    {b.actionType.replace(/_/g, " ")} ({b.lines} line{b.lines > 1 ? "s" : ""})
                  </a>
                  <b className="text-accent">{fmt(b.raw, 2)}</b>
                </div>
                <div className="font-mono text-xs text-subtle">
                  {fmt(b.units, 2)} {b.scoredUnit} × AW {b.aw} ({b.awStatus}) · SM {b.sm} · ESM {b.esm} · S {b.s}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {iv && iv.flags.length > 0 && (
        <div>
          <div className="label-mono mb-2">Engine flags</div>
          <ul className="space-y-0.5 text-sm text-muted">
            {iv.flags.map((f, i) => (
              <li key={i}>
                <span className="font-mono text-xs">{f.code}</span> {f.actionType ? `${f.actionType.replace(/_/g, " ")}: ` : ""}
                {f.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.aiActions && (
        <div className={`rounded-xl p-4 text-sm ${c.submitterEdited ? "border border-line-strong bg-accent-tint" : "bg-raised"}`}>
          <b>{c.submitterEdited ? "The organisation corrected the AI reading" : "The organisation confirmed the AI reading"}</b>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <div>
              <div className="label-mono">AI read</div>
              {c.aiActions.map((a, i) => (
                <div key={i}>{actionText(a)}</div>
              ))}
            </div>
            <div>
              <div className="label-mono">Scored (organisation)</div>
              {(s.extractedActions ?? []).map((a, i) => (
                <div key={i}>{actionText(a)}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline text-subtle">Country: </dt>
          <dd className="inline">{c.country ?? "not given"}</dd>
        </div>
        <div>
          <dt className="inline text-subtle">Ecosystem: </dt>
          <dd className="inline">{(c.ecosystem ?? s.location?.ecosystem ?? "not given").replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="inline text-subtle">Site: </dt>
          <dd className="inline">
            {s.location ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${s.location.lat}&mlon=${s.location.lon}#map=15/${s.location.lat}/${s.location.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                {s.location.lat.toFixed(4)}, {s.location.lon.toFixed(4)}
              </a>
            ) : (
              "no coordinates"
            )}
            {c.adjacentToHabitat ? " · joins existing habitat" : ""}
            {s.location && (
              <span className="block text-xs">
                Check on:{" "}
                <a
                  href={`https://www.google.com/maps/@?api=1&map_action=map&center=${s.location.lat},${s.location.lon}&zoom=16&basemap=satellite`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  satellite
                </a>
                {" · "}
                <a href="https://www.globalmangrovewatch.org/" target="_blank" rel="noopener noreferrer" className="link">
                  Global Mangrove Watch
                </a>
                {" · "}
                <a href="https://allencoralatlas.org/atlas/" target="_blank" rel="noopener noreferrer" className="link">
                  Allen Coral Atlas
                </a>{" "}
                (paste the coordinates)
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="inline text-subtle">Registered elsewhere: </dt>
          <dd className="inline">
            {s.registryDeclaration ? `${s.registryDeclaration.standard.replace(/_/g, " ")}${s.registryDeclaration.serial ? ` #${s.registryDeclaration.serial}` : ""}` : "not stated"}
          </dd>
        </div>
      </dl>

      <CostPanel cost={c.cost} country={c.country} />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="label-mono">Proof links and AI flags</div>
          {links.length > 0 && (
            <button type="button" onClick={runCheck} disabled={checking} className="btn btn-secondary btn-sm">
              {checking ? "Checking…" : checks ? "Check again" : "Check links"}
            </button>
          )}
        </div>
        {links.length === 0 && <p className="text-sm text-danger">No proof links: P0, cannot be listed.</p>}
        {checkError && <p className="text-sm text-danger">{checkError}</p>}
        <ul className="mt-2 space-y-2 text-sm">
          {links.map((u) => {
            const r = checks?.find((x) => x.url === u);
            return (
              <li key={u} className="break-all">
                <a href={u} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">
                  {u}
                </a>
                {r && (
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {r.flags.length === 0 && <li className="text-subtle">saved (no text to compare)</li>}
                    {r.flags.map((f, i) => (
                      <li key={i} className={SEVERITY[f.severity]}>
                        {f.severity}: {f.detail}
                      </li>
                    ))}
                    {r.sha256 && <li className="font-mono text-xs text-subtle">snapshot {r.sha256.slice(0, 16)}… · {r.checkedAt.slice(0, 16)}</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-subtle">Flags inform you; they never set the level or the score.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`p-${s.id}`}>
            Proof level (you decide)
          </label>
          <select
            id={`p-${s.id}`}
            className="field"
            value={choice.proofLevel || s.proofLevel || ""}
            onChange={(e) => onChoice({ ...choice, proofLevel: e.target.value as ProofLevel | "" })}
          >
            <option value="">Choose…</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}: {PROOF_REQUIREMENTS[l]}
              </option>
            ))}
          </select>
        </div>
        {environment && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted" htmlFor={`e-${s.id}`}>
              Environmental sensitivity (confirm)
            </label>
            <select
              id={`e-${s.id}`}
              className="field"
              value={choice.esm || (c.esm ? c.esm.toFixed(1) : "")}
              onChange={(e) => onChoice({ ...choice, esm: e.target.value })}
            >
              <option value="">1.0 (not confirmed)</option>
              {ESM_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            {s.esmSuggestion ? (
              <p className="mt-1 text-xs text-subtle">
                Suggested {s.esmSuggestion.esm.toFixed(1)}
                {s.esmSuggestion.matches.length
                  ? `: site inside ${s.esmSuggestion.matches.map((m) => `${m.name} (${m.attribution})`).join(", ")}`
                  : ": no sensitive layer at this point"}
                . Check the map before confirming.
              </p>
            ) : (
              <p className="mt-1 text-xs text-subtle">
                No map suggestion (no coordinates or no layer data). 1.3 when the site is inside mangrove, reef or intact forest.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CostPanel({ cost, country }: { cost?: CostDeclaration; country?: string }) {
  if (!cost) return <p className="text-sm text-subtle">No cost declared: priced by the IV rule.</p>;
  const usd = costToUsd(cost);
  const check = labourCheck(cost, country);
  const warn = check.ratio !== null && (check.ratio > 3 || check.ratio < 1);
  return (
    <div className="rounded-xl bg-raised p-4 text-sm">
      <div className="label-mono mb-2">What it took (sets the price)</div>
      <div>
        {fmt(cost.volunteerHours, 1)} volunteer hours × {fmt(cost.hourlyValue, 2)} {cost.currency}
        {usd ? ` = $${fmt(usd.labourUsd, 2)}` : ""}
      </div>
      <div className={`mt-1 ${warn ? "text-accent" : "text-subtle"}`}>
        {check.reference
          ? `Minimum wage in ${country}: ${fmt(check.reference.hourly, 2)} ${check.reference.currency}/h${check.ratio !== null ? `; declared ${check.ratio}× (${check.note})` : ` (${check.note})`}`
          : `No minimum wage reference (${check.note})`}
      </div>
      <div className="mt-2">
        {COST_CATEGORIES.filter((k) => cost.spent[k]).map((k) => `${k} ${fmt(cost.spent[k]!, 2)}`).join(" · ") || "no money spent"}{" "}
        {cost.currency}
        {usd ? ` = $${fmt(usd.spentUsd, 2)}` : ""}
      </div>
      <div className="mt-2 font-semibold">{usd ? `Total ≈ $${fmt(usd.totalUsd, 2)}; price = total × proof level` : `No exchange rate for ${cost.currency}`}</div>
      <p className="mt-1 text-xs text-subtle">The minimum wage is a reference, not a limit. Ask the group if something looks off.</p>
    </div>
  );
}
