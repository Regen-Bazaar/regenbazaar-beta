"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { actionPhrase } from "@rb/impact-engine";
import { DEFAULT_NETWORK_KEY, getNetwork, networkByChainId } from "../../../lib/networks";
import { FrameworkTag } from "../../../components/FrameworkTag";
import { ErrorNote } from "../../../components/ErrorNote";
import { ValidatorBar, sharedHeaders, useValidatorMe } from "../../../components/ValidatorBar";
import { fmt, headline, impactView } from "../../../lib/impact-view";
import { bpsToPercent } from "../../../lib/partner-share";
import { historyText, usd, type CreatorHistorySummary, type Mark, type PriceAtLevel } from "../../../lib/review-marks";
import { describeLine } from "../../../lib/log-format";
import { ReviewV02, type ReviewChoice, type SubmissionV02 } from "../ReviewV02";
import { Evidence, type StoredPage } from "../Evidence";

type Sub = SubmissionV02 & {
  title: string;
  description: string;
  status: string;
  domain: string | null;
  ivValue: string | null;
  chainId: number | null;
  createdAt: string;
  frameworkTags: { sdg: string[]; ebf: string[] } | null;
  mediaUris: string[] | null;
  methodologyVersion: string | null;
  domainScores: unknown;
  tablesVersion: string | null;
  org: { name: string; wallet: string; verified: boolean } | null;
  possibleDuplicates: { id: string; title: string; status: string; reason: string }[];
};
type Workspace = {
  submission: Sub;
  history: { items: { id: string; title: string; status: string; proofLevel: string | null; createdAt: string; withdrawn: boolean; decision: string | null }[]; summary: CreatorHistorySummary };
  marks: Mark[];
  state: { state: string; openedBy: string | null; openedAt: string | null; placeNames: string[]; proofStatus: string };
  proofPages: StoredPage[];
  notes: { id: string; at: string; by: string; body: string }[];
  timeline: ({ at: string; by: string | null } & (
    | { kind: "submitted"; title: string; detail: string }
    | { kind: "note"; title: string; detail: string }
    | { kind: "log"; line: { action: string; before: unknown; after: unknown; note: string | null; result: string; error: string | null } }
  ))[];
  consequence: PriceAtLevel[];
  aiRuns: { id: string; createdAt: string; job: string; provider: string; model: string; instructionVersion: string; inputTokens: number | null; outputTokens: number | null; durationMs: number; ok: boolean; error: string | null }[];
  decisions: { id: string; decision: string; note: string | null; at: string; by: string | null }[];
  role: string;
};
type PartnerOption = { id: string; name: string; feeBps: number; active: boolean };
type Approved = { tokenId?: string; easUid?: string; attestTx?: string; existing?: boolean };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const MIN_REASON = 5;

export default function ImpactPage() {
  const { id } = useParams<{ id: string }>();
  const me = useValidatorMe();
  const [w, setW] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<ReviewChoice>({ proofLevel: "", esm: "" });
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "reject" | "request_info" | "note">("");
  const [approved, setApproved] = useState<Approved | null>(null);
  const opened = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/review/${id}`, { headers: sharedHeaders() });
    setStatus(res.status);
    if (res.ok) setW((await res.json()) as Workspace);
  }, [id]);

  // First open: tell the server (who has it open, starts the automatic proof check once), then read the impact.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    (async () => {
      await fetch(`/api/review/${id}/open`, { method: "POST", headers: { "content-type": "application/json", ...sharedHeaders() }, body: "{}" }).catch(() => {});
      await load();
      const pr = await fetch("/api/partners", { headers: sharedHeaders() }).catch(() => null);
      if (pr?.ok) setPartners(((await pr.json()) as PartnerOption[]).filter((p) => p.active));
    })();
  }, [id, load]);

  // While the automatic check runs, look again every few seconds (at most two minutes).
  const running = w?.state.proofStatus === "running";
  useEffect(() => {
    if (!running) return;
    let n = 0;
    const t = setInterval(() => {
      if (++n > 40) clearInterval(t);
      else void load();
    }, 3000);
    return () => clearInterval(t);
  }, [running, load]);

  async function decide(decision: "approve" | "reject" | "request_info") {
    if ((decision === "reject" || decision === "request_info") && reason.trim().length < MIN_REASON) {
      setError("Write the public reason first: the creator and buyers will read it.");
      return;
    }
    setBusy(decision);
    setError("");
    const res = await fetch("/api/verifications", {
      method: "POST",
      headers: { "content-type": "application/json", ...sharedHeaders() },
      body: JSON.stringify({
        submissionId: id,
        decision,
        note: reason.trim() || undefined,
        proofLevel: choice.proofLevel || undefined,
        esm: choice.esm ? Number(choice.esm) : undefined,
        partnerId: decision === "approve" && partnerId ? partnerId : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? "failed");
    else {
      if (decision === "approve") {
        const l = body.listings?.[0] ?? {};
        setApproved({ tokenId: l.tokenId, easUid: l.easUid, attestTx: l.attestTx, existing: l.existing });
      }
      setReason("");
    }
    setBusy("");
    await load();
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy("note");
    setError("");
    const res = await fetch(`/api/review/${id}/notes`, { method: "POST", headers: { "content-type": "application/json", ...sharedHeaders() }, body: JSON.stringify({ body: note.trim() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? "failed");
    else setNote("");
    setBusy("");
    await load();
  }

  const s = w?.submission;
  const net = s ? (s.chainId == null ? getNetwork(DEFAULT_NETWORK_KEY) : networkByChainId(s.chainId)) : undefined;
  const explorer = net?.chain.blockExplorers?.default.url ?? "";
  const waiting = s?.status === "pending_verification";
  const v02 = s?.methodologyVersion === "v0.2";

  return (
    <main className="page-wrap py-10 md:py-14">
      <Link href="/verify" className="text-muted hover:text-accent">
        ← Queue
      </Link>
      <ValidatorBar me={me} current="queue" />
      {status === 401 && <p className="card mt-8 p-6 text-muted">Sign in to see this impact. {me.mode === "shared" ? "Open the queue and enter the access code first." : ""}</p>}
      {status === 404 && <p className="card mt-8 p-6 text-muted">This impact does not exist.</p>}
      {status !== null && status !== 401 && status !== 404 && status !== 200 && <ErrorNote text="Could not load the impact." className="mt-6 text-danger" />}
      {!w && status === null && <p className="mt-8 text-muted">Loading…</p>}

      {w && s && (
        <>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label-mono">
                {net?.chain.name ?? `chain ${s.chainId}`}
                {s.domain ? ` · ${s.domain.replace(/_/g, " ")}` : ""} · submitted {when(s.createdAt)}
              </div>
              <h1 className="mt-2 max-w-[28ch] text-[clamp(2rem,3.5vw,3rem)]">{s.title}</h1>
            </div>
            <div className="text-right">
              <span className="badge">{s.status.replace(/_/g, " ")}</span>
              {(() => {
                const h = headline(impactView(s));
                return (
                  <div className="mt-2">
                    <div className="label-mono">{h.label}</div>
                    <div className="font-display text-3xl text-accent">{h.value}</div>
                    <div className="text-xs text-subtle">{h.sub}</div>
                  </div>
                );
              })()}
            </div>
          </div>
          {w.state.openedBy && <p className="mt-2 text-sm text-subtle">Last opened by {w.state.openedBy}{w.state.openedAt ? `, ${when(w.state.openedAt)}` : ""}</p>}
          {error && <ErrorNote text={error} className="mt-4 text-danger" />}

          {approved && (
            <div className="card mt-6 border-ok/40 bg-ok-tint p-6">
              <div className="label-mono !text-ok">Approved{approved.existing ? " (already listed)" : ""}</div>
              <p className="mt-1 text-muted">
                Attested on-chain and listed on <b>{net?.chain.name ?? "its network"}</b>
                {approved.tokenId && <> as tRWI #{approved.tokenId}</>}, 100 editions.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/submission/${s.id}`} className="btn btn-primary btn-sm">
                  View listing
                </Link>
                {approved.attestTx && explorer && (
                  <a href={`${explorer}/tx/${approved.attestTx}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    Attestation transaction ↗
                  </a>
                )}
              </div>
              {approved.easUid && <div className="mt-3 break-all font-mono text-xs text-subtle">EAS UID {approved.easUid}</div>}
            </div>
          )}

          {/* 1. The claim */}
          <section className="card mt-6 p-6">
            <div className="label-mono">The claim · written by the creator, not checked</div>
            <p className="mt-2 whitespace-pre-wrap text-lg leading-relaxed">{s.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.frameworkTags?.sdg.map((t) => <FrameworkTag key={t} kind="sdg" value={t} />)}
              {s.frameworkTags?.ebf.map((t) => <FrameworkTag key={t} kind="ebf" value={t} />)}
            </div>
            <ul className="mt-3 space-y-0.5 font-mono text-sm text-subtle">
              {(s.extractedActions ?? []).map((a, i) => (
                <li key={i}>{actionPhrase(a, (n) => fmt(n, 2))}</li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="inline text-subtle">Period: </dt>
                <dd className="inline">{s.context?.periodStart ?? "?"} to {s.context?.periodEnd ?? "?"}</dd>
              </div>
              <div>
                <dt className="inline text-subtle">Region: </dt>
                <dd className="inline">{(s.context as { regionCode?: string } | null)?.regionCode?.replace(/_/g, " ") ?? s.context?.country ?? "not given"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm">
              <a href={`/submission/${s.id}`} target="_blank" rel="noopener noreferrer" className="link">
                Public page ↗
              </a>
            </p>
          </section>

          {/* 2. The creator and their history */}
          <section className="card mt-4 p-6">
            <div className="label-mono">The creator</div>
            <div className="mt-2 text-sm">
              <b>{s.org?.name ?? "unknown"}</b>
              {s.org && !s.org.verified && <span className="text-subtle"> (not verified)</span>}
              {" · payout wallet "}
              {s.org?.wallet ? (
                explorer ? (
                  <a href={`${explorer}/address/${s.org.wallet}`} target="_blank" rel="noopener noreferrer" className="link font-mono" title={s.org.wallet}>
                    {short(s.org.wallet)}
                  </a>
                ) : (
                  <span className="font-mono">{short(s.org.wallet)}</span>
                )
              ) : (
                "none"
              )}
            </div>
            <p className="mt-1 text-sm text-muted">History of this wallet: {historyText(w.history.summary)}. A new wallet carries no history; that says nothing about the person.</p>
            {w.history.items.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {w.history.items.map((h) => (
                  <li key={h.id}>
                    <Link href={`/verify/${h.id}`} className="link">
                      {h.title}
                    </Link>{" "}
                    <span className="text-subtle">
                      · {h.status.replace(/_/g, " ")}
                      {h.proofLevel ? ` · ${h.proofLevel}` : ""}
                      {h.withdrawn ? " · withdrawn" : ""} · {when(h.createdAt).slice(0, 12)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. What to look at */}
          <section className="card mt-4 p-6">
            <div className="label-mono">Things to look at · fixed rules, not a verdict</div>
            {w.marks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing flagged by the rules. Read the claim and the proof anyway.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-sm">
                {w.marks.map((m) => (
                  <li key={m.code} className="rounded-full border border-line bg-raised px-3 py-1 text-muted">
                    {m.text}
                  </li>
                ))}
              </ul>
            )}
            {s.possibleDuplicates.length > 0 && (
              <div className="mt-4 rounded-xl border border-line-strong bg-accent-tint p-4 text-sm text-muted">
                <b className="text-accent">Possible duplicate: check before approving.</b>
                <ul className="mt-1 space-y-0.5">
                  {s.possibleDuplicates.map((d) => (
                    <li key={d.id}>
                      <Link href={`/verify/${d.id}`} className="link">
                        {d.title}
                      </Link>{" "}
                      ({d.status.replace(/_/g, " ")}): {d.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 4. Review: scores, evidence, sensitivity, level, consequence */}
          <section className="card mt-4 p-6">
            {v02 ? (
              <ReviewV02
                s={s}
                choice={choice}
                onChoice={setChoice}
                evidence={
                  <Evidence
                    id={s.id}
                    proofLinks={Array.isArray(s.proofLinks) ? s.proofLinks : []}
                    photoLinks={s.mediaUris ?? []}
                    checks={s.proofChecks}
                    pages={w.proofPages}
                    placeNames={w.state.placeNames}
                    proofStatus={w.state.proofStatus}
                    onChanged={load}
                  />
                }
                consequence={
                  w.consequence.length > 0 ? (
                    <div className="rounded-xl bg-raised p-4 text-sm">
                      <div className="label-mono mb-1">What each level would make the price (plain information)</div>
                      <ul className="space-y-0.5">
                        {w.consequence.map((c) => (
                          <li key={c.level}>
                            <b>{c.level}</b> × {c.factor}: {usd(c.totalUsd)} in total, {usd(c.perEditionUsd)} per edition (100 editions)
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-subtle">Fixed formula: Impact Value × rate × proof factor × cost factor. Choose the level the evidence supports, not the price.</p>
                    </div>
                  ) : null
                }
              />
            ) : (
              <p className="text-sm text-muted">This report was scored with methodology v0.1: no proof level or price model applies. Approve or reject only.</p>
            )}
          </section>

          {/* 5. Decision */}
          {waiting && (
            <section className="card mt-4 p-6">
              {partners.length > 0 && (
                <label className="mb-5 block text-sm">
                  <span className="text-subtle">Partner (optional): receives its share of every sale of this lot</span>
                  <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="field mt-1">
                    <option value="">No partner</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {bpsToPercent(p.feeBps)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="rounded-xl border border-line-strong bg-accent-tint p-4">
                <label className="block text-sm font-semibold" htmlFor="public-reason">
                  Public reason: the creator and buyers will read this
                </label>
                <p className="text-xs text-subtle">Required to reject and to ask for more proof. Optional when approving. It appears on the public impact page.</p>
                <textarea id="public-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} className="field mt-2" placeholder="What the creator should know, in plain words" />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => decide("approve")} disabled={busy !== ""} className="btn btn-sm bg-green text-paper hover:bg-green-soft disabled:opacity-50">
                  {busy === "approve" ? "Attesting on-chain…" : "Approve & attest"}
                </button>
                {v02 && (
                  <button onClick={() => decide("request_info")} disabled={busy !== ""} className="btn btn-secondary btn-sm">
                    Request more proof
                  </button>
                )}
                <button onClick={() => decide("reject")} disabled={busy !== ""} className="btn btn-sm border-danger/40 text-danger hover:border-danger">
                  Reject
                </button>
              </div>
              <p className="mt-2 text-xs text-subtle">The creator is not notified automatically: a request is shown on the public page and in this workspace. Contact pilot creators directly as before.</p>
            </section>
          )}

          {/* 6. Internal notes */}
          <section className="card mt-4 p-6">
            <div className="label-mono">Internal notes · only validators see these, never public</div>
            {w.notes.length === 0 && <p className="mt-2 text-sm text-subtle">No notes yet.</p>}
            <ul className="mt-2 space-y-2 text-sm">
              {w.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-raised px-3 py-2">
                  <div className="text-xs text-subtle">{n.by} · {when(n.at)}</div>
                  <div className="whitespace-pre-wrap">{n.body}</div>
                </li>
              ))}
            </ul>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={4000} className="field mt-3" placeholder="A note for the other validators" aria-label="Internal note" />
            <button className="btn btn-secondary btn-sm mt-2" onClick={addNote} disabled={busy !== "" || !note.trim()}>
              {busy === "note" ? "Saving…" : "Add internal note"}
            </button>
            <p className="mt-1 text-xs text-subtle">Notes are only added, never edited.</p>
          </section>

          {/* 7. Timeline */}
          <section className="card mt-4 p-6">
            <div className="label-mono">Timeline</div>
            <ol className="mt-2 space-y-2 text-sm">
              {w.timeline.map((e, i) => {
                const text = e.kind === "log" ? describeLine(e.line) : { title: e.title, detail: e.detail };
                return (
                  <li key={i} className="border-l-2 border-line pl-3">
                    <div>
                      <b>{text.title}</b> <span className="text-subtle">· {e.by ?? "unknown"} · {when(e.at)}</span>
                    </div>
                    {text.detail && <div className="whitespace-pre-wrap break-words text-muted">{text.detail}</div>}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* 8. AI calls on this impact */}
          <section className="card mt-4 p-6">
            <div className="label-mono">AI calls on this impact</div>
            {w.aiRuns.length === 0 ? (
              <p className="mt-2 text-sm text-subtle">None recorded (calls made before 28 November 2026 were not logged).</p>
            ) : (
              <ul className="mt-2 space-y-0.5 text-sm text-muted">
                {w.aiRuns.map((r) => (
                  <li key={r.id}>
                    {r.job.replace(/_/g, " ")} · {r.provider}/{r.model} · {r.ok ? "answered" : `failed: ${r.error ?? "error"}`} · {r.durationMs} ms
                    {r.inputTokens !== null ? ` · ${r.inputTokens}/${r.outputTokens ?? 0} tokens` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
