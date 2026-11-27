"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorNote } from "../../../components/ErrorNote";
import { ValidatorBar, useValidatorMe } from "../../../components/ValidatorBar";

type Line = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorWallet: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  before: unknown;
  after: unknown;
  note: string | null;
  result: string;
  error: string | null;
};
type Member = { id: string; name: string | null; wallet: string };

const ACTIONS = [
  "sign_in", "sign_in_refused", "sign_out", "proof_check", "set_proof_level", "set_esm", "approve", "reject", "request_info",
  "partner_create", "partner_pause", "partner_resume", "partner_detach", "validator_add", "validator_remove", "role_change", "first_admin",
];

export default function Log() {
  const me = useValidatorMe();
  const [rows, setRows] = useState<Line[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [status, setStatus] = useState<number | null>(null);
  const [person, setPerson] = useState("");
  const [action, setAction] = useState("");
  const [object, setObject] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const isAdmin = me.user?.role === "admin" || me.mode === "shared";

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (person) q.set("person", person);
    if (action) q.set("action", action);
    if (object.trim()) q.set("object", object.trim());
    if (from) q.set("from", new Date(from).toISOString());
    if (to) q.set("to", new Date(`${to}T23:59:59`).toISOString());
    const res = await fetch(`/api/action-log?${q}`);
    setStatus(res.status);
    setRows(res.ok ? await res.json() : []);
  }, [person, action, object, from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (me.user?.role !== "admin") return;
    fetch("/api/validators").then((r) => (r.ok ? r.json() : [])).then(setTeam).catch(() => {});
  }, [me.user?.role]);

  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Action log</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        {isAdmin ? "Every validator action, newest first." : "Your own actions, newest first."} Lines are only added, never edited. Decisions made before personal
        accounts were made with the shared code and have no named validator.
      </p>
      <ValidatorBar me={me} current="log" />
      {status === 401 ? (
        <p className="card mt-8 p-6 text-muted">Sign in to see the log.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {me.user?.role === "admin" && (
              <select className="field !w-auto" value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">All people</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.wallet}</option>
                ))}
              </select>
            )}
            <select className="field !w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input className="field !w-auto" placeholder="Impact / object id" value={object} onChange={(e) => setObject(e.target.value)} />
            <input className="field !w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input className="field !w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </div>
          {rows.length === 0 && status === 200 ? <ErrorNote text="No lines for these filters." className="mt-6 text-muted" /> : null}
          <div className="mt-6 grid gap-2">
            {rows.map((l) => (
              <div key={l.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <b>{l.action.replace(/_/g, " ")}</b>
                    {l.result === "failed" && <span className="ml-2 text-danger">failed: {l.error}</span>}
                    <span className="text-muted"> · {l.actorName ?? l.actorWallet ?? "unknown"}</span>
                  </div>
                  <time className="text-subtle">{new Date(l.createdAt).toLocaleString()}</time>
                </div>
                {l.objectId && <div className="mt-1 break-all font-mono text-xs text-subtle">{l.objectType} {l.objectId}</div>}
                {(l.before != null || l.after != null) && (
                  <div className="mt-1 break-all font-mono text-xs text-muted">
                    {l.before != null && <>before {JSON.stringify(l.before)} </>}
                    {l.after != null && <>after {JSON.stringify(l.after)}</>}
                  </div>
                )}
                {l.note && <div className="mt-1 text-muted">Note: {l.note}</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
