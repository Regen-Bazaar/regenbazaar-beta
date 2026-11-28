"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEFAULT_NETWORK_KEY, getNetwork, networkByChainId } from "../../lib/networks";
import { ErrorNote } from "../../components/ErrorNote";
import { ValidatorBar, sharedHeaders, useValidatorMe } from "../../components/ValidatorBar";
import { headline, impactView, fmt } from "../../lib/impact-view";
import { historyText, usd, type CreatorHistorySummary, type Mark } from "../../lib/review-marks";
import { actionTitle } from "../../lib/log-format";

type Row = {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  chainId: number | null;
  domain: string | null;
  methodologyVersion: string | null;
  domainScores: unknown;
  ivValue: string | null;
  tablesVersion: string | null;
  proofLevel: string | null;
  org: { name: string; wallet: string; verified: boolean } | null;
  history: CreatorHistorySummary;
  marks: Mark[];
  priceFromUsd: number | null;
  priceToUsd: number | null;
  openedBy: string | null;
  openedAt: string | null;
  proofStatus: string;
  decision: { decision: string; at: string; by: string | null } | null;
};

type Tab = "waiting" | "decided";
type Sort = "oldest" | "newest" | "value";

const netName = (chainId: number | null) => (chainId == null ? getNetwork(DEFAULT_NETWORK_KEY) : networkByChainId(chainId))?.chain.name ?? `chain ${chainId}`;
function ageText(iso: string, now = Date.now()): string {
  const h = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000));
  if (h < 1) return "under an hour";
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Verify() {
  const me = useValidatorMe();
  const [tab, setTab] = useState<Tab>("waiting");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [sort, setSort] = useState<Sort>("oldest");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [unlockTick, setUnlockTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/review/queue?tab=${tab}&scope=${scope}`, { headers: sharedHeaders() });
      setStatus(res.status);
      if (res.ok) setRows(((await res.json()) as { rows: Row[] }).rows);
      else setRows([]);
    } catch {
      setError("Could not load the list.");
    }
    setLoading(false);
  }, [tab, scope, unlockTick]);
  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const r = [...rows];
    if (tab === "decided") return r;
    if (sort === "newest") r.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else if (sort === "value") r.sort((a, b) => Number(b.ivValue ?? 0) - Number(a.ivValue ?? 0));
    else r.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return r;
  }, [rows, sort, tab]);

  const denied = status === 401;
  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Verification queue</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Validator review by the Regen Bazaar team. Open an impact to read the claim, the creator, the proof and what to look at. Approving attests the claim
        on-chain and lists it in the Marketplace of the one network it was submitted on.
      </p>

      <ValidatorBar me={me} current="queue" />
      {denied && me.ready && me.mode === "shared" && (
        <form
          className="mt-8 flex max-w-[560px] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = (new FormData(e.currentTarget).get("token") as string) ?? "";
            try {
              sessionStorage.setItem("rb_admin_token", t);
            } catch {}
            setUnlockTick((n) => n + 1);
          }}
        >
          <input name="token" type="password" placeholder="Validator access code" className="field min-w-0 flex-1" />
          <button className="btn btn-secondary btn-sm">Unlock</button>
        </form>
      )}
      {error && <ErrorNote text={error} className="mt-4 text-danger" />}

      {!denied && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
            <button className={`btn btn-sm ${tab === "waiting" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("waiting")}>
              Waiting{tab === "waiting" && !loading ? ` (${rows.length})` : ""}
            </button>
            <button className={`btn btn-sm ${tab === "decided" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("decided")}>
              Decided{tab === "decided" && !loading ? ` (${rows.length})` : ""}
            </button>
            {tab === "decided" && (
              <select className="field !w-auto" value={scope} onChange={(e) => setScope(e.target.value as "all" | "mine")} aria-label="Whose decisions">
                <option value="all">All decisions</option>
                <option value="mine">My decisions</option>
              </select>
            )}
            {tab === "waiting" && (
              <select className="field !w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
                <option value="value">Largest first</option>
              </select>
            )}
          </div>

          {loading ? (
            <p className="mt-8 text-muted">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="card mt-8 p-8 text-muted">{tab === "waiting" ? "Nothing waiting. New impacts appear here when a creator submits them." : "No decisions in this list yet."}</p>
          ) : (
            <ul className="mt-6 grid gap-3">
              {sorted.map((r) => {
                const v = impactView(r);
                const h = headline(v);
                return (
                  <li key={r.id}>
                    <Link href={`/verify/${r.id}`} className="card block p-5 hover:border-line-strong">
                      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                        <div className="min-w-0 flex-1 basis-[22rem]">
                          <div className="text-lg font-semibold leading-snug">{r.title}</div>
                          <div className="mt-1 text-sm text-muted">
                            {r.org?.name ?? "unknown creator"}
                            {r.org && !r.org.verified ? " (not verified)" : ""} · {historyText(r.history)}
                          </div>
                          <div className="mt-1 text-xs text-subtle">
                            {netName(r.chainId)}
                            {r.domain ? ` · ${r.domain.replace(/_/g, " ")}` : ""} · submitted {date(r.createdAt)}
                            {tab === "waiting" ? ` (${ageText(r.createdAt)} ago)` : ""}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="label-mono">{h.label}</div>
                          <div className="font-display text-2xl text-accent">{h.value}</div>
                          {r.priceFromUsd !== null && r.priceToUsd !== null && (
                            <div className="text-xs text-subtle">
                              price {usd(r.priceFromUsd)} to {usd(r.priceToUsd)} (P1 to P4)
                            </div>
                          )}
                          {v.version === "v0.1" && <div className="text-xs text-subtle">methodology v0.1</div>}
                        </div>
                      </div>
                      {tab === "waiting" ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                          {r.marks.length === 0 ? <span className="text-subtle">Nothing flagged by the rules</span> : null}
                          {r.marks.map((m) => (
                            <span key={m.code} className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-muted">
                              {m.text}
                            </span>
                          ))}
                          <span className="ml-auto text-subtle">
                            {r.openedBy ? `Opened by ${r.openedBy}${r.openedAt ? `, ${ageText(r.openedAt)} ago` : ""}` : "Not opened yet"}
                            {r.proofStatus === "running" ? " · checks running" : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted">
                          <b>{r.decision ? actionTitle(r.decision.decision) : r.status.replace(/_/g, " ")}</b>
                          {r.decision?.by ? ` by ${r.decision.by}` : " by the shared access code"}
                          {r.decision ? ` · ${date(r.decision.at)}` : ""}
                          {r.proofLevel ? ` · proof ${r.proofLevel}` : ""} · {fmt(Number(r.ivValue ?? 0))} IV · status {r.status.replace(/_/g, " ")}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
