"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_NETWORK_KEY, getNetwork, networkByChainId } from "../../lib/networks";

type Submission = {
  id: string;
  title: string;
  description: string;
  domain: string | null;
  ivValue: string | null;
  chainId: number | null;
  frameworkTags: { sdg: string[]; ebf: string[] } | null;
  extractedActions: { actionType: string; quantity: number; unit: string }[] | null;
  possibleDuplicates?: { id: string; title: string; status: string; reason: string }[];
};

export default function Verify() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [token, setToken] = useState("");
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem("rb_admin_token") ?? "");
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/submissions?status=pending_verification", { headers: { "x-admin-token": token } });
    setDenied(res.status === 401);
    setSubs(res.ok ? await res.json() : []);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    setError("");
    const res = await fetch("/api/verifications", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ submissionId: id, decision, note: notes[id]?.trim() || undefined }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "failed");
    setBusy(null);
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold">Verification queue</h1>
      <p className="mt-2 text-muted">
        Validator review by the Regen Bazaar team. Approving attests the claim on-chain and lists it in the
        Marketplace of the one network it was submitted on. Submitted a report? It will appear in the Marketplace once reviewed.
      </p>

      {denied && (
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = (new FormData(e.currentTarget).get("token") as string) ?? "";
            try {
              sessionStorage.setItem("rb_admin_token", t);
            } catch {}
            setToken(t);
          }}
        >
          <input
            name="token"
            type="password"
            placeholder="Validator access code"
            className="flex-1 field"
          />
          <button className="rounded-md border border-line-strong px-4 text-sm hover:border-accent hover:text-accent">Unlock</button>
        </form>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {denied ? null : loading ? (
        <p className="mt-10 text-subtle">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="mt-10 text-subtle">Nothing pending. Submit one from the tokenize wizard.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {subs.map((s) => (
            <div key={s.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-0.5 text-xs text-accent">
                    Lists on {(s.chainId == null ? getNetwork(DEFAULT_NETWORK_KEY) : networkByChainId(s.chainId))?.chain.name ?? `chain ${s.chainId}`}
                  </div>
                  <div className="mt-1 text-sm text-subtle">{s.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {s.frameworkTags?.sdg.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                    {s.frameworkTags?.ebf.map((t) => (
                      <span key={t} className="rounded-full border border-line-strong px-2 py-0.5 text-accent">EBF {t}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-subtle">
                    {(s.extractedActions ?? []).map((a) => `${a.quantity} ${a.unit}`).join(" · ")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-subtle">Impact Value</div>
                  <div className="text-xl font-bold text-accent">{Number(s.ivValue ?? 0).toLocaleString()}</div>
                </div>
              </div>
              {(s.possibleDuplicates ?? []).length > 0 && (
                <div className="mt-3 rounded-md border border-line-strong bg-accent-tint p-3 text-xs text-muted">
                  <b className="text-accent">Possible duplicate: check before approving.</b>
                  <ul className="mt-1 space-y-0.5">
                    {s.possibleDuplicates!.map((d) => (
                      <li key={d.id}>
                        <a href={`/submission/${d.id}`} target="_blank" rel="noopener noreferrer" className="underline">
                          {d.title}
                        </a>{" "}
                        ({d.status.replace(/_/g, " ")}): {d.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                rows={2}
                placeholder="Optional note / reason (required-by-convention for rejections)"
                className="mt-4 w-full field"
              />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => decide(s.id, "approve")}
                  disabled={busy === s.id}
                  className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-fg hover:bg-green-soft disabled:opacity-50"
                >
                  Approve & attest
                </button>
                <button
                  onClick={() => decide(s.id, "reject")}
                  disabled={busy === s.id}
                  className="rounded-md border border-danger/40 px-4 py-2 text-sm text-danger hover:border-danger disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
