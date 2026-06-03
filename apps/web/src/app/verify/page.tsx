"use client";

import { useCallback, useEffect, useState } from "react";

type Submission = {
  id: string;
  title: string;
  description: string;
  domain: string | null;
  ivValue: string | null;
  frameworkTags: { sdg: string[]; ebf: string[] } | null;
  extractedActions: { actionType: string; quantity: number; unit: string }[] | null;
};

export default function Verify() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/submissions?status=pending_verification");
    setSubs(res.ok ? await res.json() : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    await fetch("/api/verifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ submissionId: id, decision }),
    });
    setBusy(null);
    await load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold">Verification queue</h1>
      <p className="mt-2 text-paper/70">
        Validator review (beta: trusted admin). Approving attests the claim and unlocks tokenization.
      </p>

      {loading ? (
        <p className="mt-10 text-paper/50">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="mt-10 text-paper/50">Nothing pending. Submit one from the tokenize wizard.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {subs.map((s) => (
            <div key={s.id} className="rounded-xl border border-gold/15 bg-ink-soft/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{s.title}</div>
                  <div className="mt-1 text-sm text-paper/60">{s.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {s.frameworkTags?.sdg.map((t) => (
                      <span key={t} className="rounded-full bg-green/25 px-2 py-0.5 text-paper/80">{t}</span>
                    ))}
                    {s.frameworkTags?.ebf.map((t) => (
                      <span key={t} className="rounded-full border border-gold/40 px-2 py-0.5 text-gold">EBF {t}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-paper/45">
                    {(s.extractedActions ?? []).map((a) => `${a.quantity} ${a.unit}`).join(" · ")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-paper/45">Impact Value</div>
                  <div className="text-xl font-bold text-gold">{Number(s.ivValue ?? 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => decide(s.id, "approve")}
                  disabled={busy === s.id}
                  className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-paper hover:bg-green-soft disabled:opacity-50"
                >
                  Approve & attest
                </button>
                <button
                  onClick={() => decide(s.id, "reject")}
                  disabled={busy === s.id}
                  className="rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:border-red-500 disabled:opacity-50"
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
