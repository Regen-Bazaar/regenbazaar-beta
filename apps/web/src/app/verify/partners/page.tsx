"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { DEFAULT_NETWORK_KEY, getNetwork, networkByChainId } from "../../../lib/networks";
import { MAX_PARTNER_FEE_BPS, bpsToPercent, saleSplitBps } from "../../../lib/partner-share";
import { ErrorNote } from "../../../components/ErrorNote";

type PartnerListing = { id: string; chainId: number; tokenId: string; active: boolean; submissionId: string; title: string };
type Partner = {
  id: string;
  name: string;
  payoutAddress: string;
  feeBps: number;
  active: boolean;
  createdAt: string;
  listings: PartnerListing[];
};

const explorer = getNetwork(DEFAULT_NETWORK_KEY).chain.blockExplorers?.default.url ?? "";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Share typed as a percent ("5", "2.5") -> basis points, or NaN. */
function percentToBps(v: string): number {
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v.trim())) return NaN;
  return Math.round(Number(v) * 100);
}

export default function Partners() {
  const [token, setToken] = useState("");
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [share, setShare] = useState("");

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem("rb_admin_token") ?? "");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/partners", { headers: { "x-admin-token": token } });
    setDenied(res.status === 401);
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError("");
    const res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", "x-admin-token": token },
    });
    const body = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(body.error ?? "failed");
      return false;
    }
    await load();
    return true;
  }

  const bps = percentToBps(share);
  const addrOk = isAddress(address.trim());
  const shareOk = Number.isInteger(bps) && bps > 0 && bps <= MAX_PARTNER_FEE_BPS;
  const formOk = name.trim().length >= 2 && addrOk && shareOk;
  const preview = shareOk ? saleSplitBps(bps) : null;

  return (
    <main className="page-wrap py-10 md:py-14">
      <Link href="/verify" className="link text-sm">
        ← Verification queue
      </Link>
      <h1 className="mt-3 text-[clamp(2.5rem,4vw,3.5rem)]">Partners</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        A partner brings impact to the platform and receives a share of each primary sale, paid by the sale
        contract in the same transaction. The share is fixed when the partner is created; for a different share,
        add a new partner. Attach a partner when approving a report.
      </p>

      {denied && (
        <form
          className="mt-8 flex max-w-[560px] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = (new FormData(e.currentTarget).get("token") as string) ?? "";
            try {
              sessionStorage.setItem("rb_admin_token", t);
            } catch {}
            setToken(t);
          }}
        >
          <input name="token" type="password" placeholder="Validator access code" className="field min-w-0 flex-1" />
          <button className="btn btn-secondary btn-sm">Unlock</button>
        </form>
      )}
      {denied && token && <p className="mt-2 text-sm text-danger">Wrong access code.</p>}
      {error && <ErrorNote text={error} className="mt-4 text-danger" />}

      {!denied && (
        <form
          className="card mt-8 max-w-[760px] p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!formOk) return;
            const ok = await call("new", "/api/partners", {
              method: "POST",
              body: JSON.stringify({ name: name.trim(), payoutAddress: address.trim(), feeBps: bps }),
            });
            if (ok) {
              setName("");
              setAddress("");
              setShare("");
            }
          }}
        >
          <div className="label-mono">Add partner</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
            <label className="text-sm">
              <span className="text-subtle">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="DeCleanup Network" className="field mt-1" />
            </label>
            <label className="text-sm">
              <span className="text-subtle">Payout wallet</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" className="field mt-1 font-mono" />
              {address && !addrOk && <span className="mt-1 block text-xs text-danger">Not a valid address.</span>}
            </label>
            <label className="text-sm">
              <span className="text-subtle">Share, %</span>
              <input value={share} onChange={(e) => setShare(e.target.value)} inputMode="decimal" placeholder="5" className="field mt-1" />
              {share && !shareOk && <span className="mt-1 block text-xs text-danger">0.01 to 10.</span>}
            </label>
          </div>
          <p className="mt-3 text-sm text-muted">
            {preview
              ? `Each payment: creator ${bpsToPercent(preview.creator)} · partner ${bpsToPercent(preview.partner)} · platform ${bpsToPercent(preview.platform)}.`
              : "Enter a share to see how each payment is split."}{" "}
            The share cannot be changed later.
          </p>
          <button disabled={!formOk || busy === "new"} className="btn btn-primary btn-sm mt-4 disabled:opacity-50">
            {busy === "new" ? "Adding…" : "Add partner"}
          </button>
        </form>
      )}

      {denied ? null : loading ? (
        <p className="mt-10 text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card mt-8 p-8 text-muted">No partners yet.</p>
      ) : (
        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {rows.map((p) => (
            <div key={p.id} className={`card p-6 ${p.active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-semibold leading-snug">{p.name}</div>
                  <a
                    href={`${explorer}/address/${p.payoutAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link font-mono text-sm"
                    title={p.payoutAddress}
                  >
                    {short(p.payoutAddress)}
                  </a>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-3xl text-accent">{bpsToPercent(p.feeBps)}</div>
                  <div className={`text-xs ${p.active ? "text-ok" : "text-danger"}`}>{p.active ? "active" : "paused"}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-subtle">
                {p.listings.length === 0 ? "No lots attached." : `${p.listings.length} lot${p.listings.length === 1 ? "" : "s"}:`}
              </div>
              {p.listings.length > 0 && (
                <ul className="mt-1 space-y-1 text-sm">
                  {p.listings.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">
                        <Link href={`/submission/${l.submissionId}`} className="link">
                          {l.title}
                        </Link>{" "}
                        <span className="text-subtle">
                          · {networkByChainId(l.chainId)?.chain.name ?? l.chainId} #{l.tokenId}
                          {!l.active && " · not active"}
                        </span>
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Detach ${p.name} from "${l.title}"? Later sales pay creator and platform only.`)) {
                            void call(l.id, `/api/listings/${l.id}/partner`, { method: "DELETE" });
                          }
                        }}
                        disabled={busy === l.id}
                        className="btn btn-sm border-danger/40 text-danger hover:border-danger"
                      >
                        Detach
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => void call(p.id, `/api/partners/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) })}
                disabled={busy === p.id}
                className="btn btn-secondary btn-sm mt-5"
              >
                {p.active ? "Pause" : "Resume"}
              </button>
              {p.active && p.listings.some((l) => l.active) && (
                <span className="ml-3 text-xs text-subtle">Pausing stops sales of its lots until resumed or detached.</span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
