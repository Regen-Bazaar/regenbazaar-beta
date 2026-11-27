"use client";

import { useCallback, useEffect, useState } from "react";
import { isAddress } from "viem";
import { ErrorNote } from "../../../components/ErrorNote";
import { ValidatorBar, sharedHeaders, useValidatorMe } from "../../../components/ValidatorBar";

type Member = { id: string; wallet: string; name: string | null; role: "validator" | "admin"; active: boolean; removedAt: string | null; createdAt: string };

const roleLabel = (r: string) => (r === "admin" ? "admin" : "reviewer");

export default function Team() {
  const me = useValidatorMe();
  const [rows, setRows] = useState<Member[]>([]);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"validator" | "admin">("validator");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/validators", { headers: sharedHeaders() });
      setStatus(res.status);
      setRows(res.ok ? await res.json() : []);
    } catch {
      setError("Could not load the team. Check the connection and reload.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function call(key: string, url: string, method: string, body: unknown) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json", ...sharedHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "failed");
    } catch {
      setError("Request failed. Check the connection and try again.");
    } finally {
      setBusy("");
    }
    await load();
  }

  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Team</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Admins add and remove validators. A reviewer can review reports and attach an existing partner; only an admin creates, pauses or detaches partners
        and manages this list. Removing someone ends their access on their next click.
      </p>
      <ValidatorBar me={me} current="team" />
      {error && <ErrorNote text={error} className="mt-4 text-danger" />}
      {status === 401 || status === 403 ? (
        <p className="card mt-8 p-6 text-muted">Admins only.</p>
      ) : (
        <>
          <form
            className="card mt-8 grid max-w-[760px] gap-3 p-5 sm:grid-cols-[1fr_1fr_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isAddress(wallet.trim())) return setError("Enter a full 0x wallet address.");
              void call("add", "/api/validators", "POST", { wallet: wallet.trim(), name, role }).then(() => (setWallet(""), setName("")));
            }}
          >
            <input className="field" placeholder="Wallet 0x…" value={wallet} onChange={(e) => setWallet(e.target.value)} />
            <input className="field" placeholder="Name (team only)" value={name} onChange={(e) => setName(e.target.value)} />
            <select className="field" value={role} onChange={(e) => setRole(e.target.value as "validator" | "admin")}>
              <option value="validator">reviewer</option>
              <option value="admin">admin</option>
            </select>
            <button className="btn btn-primary btn-sm" disabled={busy === "add"}>
              Add
            </button>
          </form>
          <div className="mt-8 grid gap-3">
            {rows.map((m) => (
              <div key={m.id} className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${m.active ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <div className="font-semibold">
                    {m.name ?? "unnamed"} <span className="text-sm font-normal text-subtle">· {roleLabel(m.role)}{m.active ? "" : " · removed"}</span>
                  </div>
                  <div className="break-all font-mono text-xs text-subtle">{m.wallet}</div>
                </div>
                {m.active && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!!busy}
                      onClick={() => call(`r${m.id}`, `/api/validators/${m.id}`, "PATCH", { role: m.role === "admin" ? "validator" : "admin" })}
                    >
                      Make {m.role === "admin" ? "reviewer" : "admin"}
                    </button>
                    <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => call(`s${m.id}`, `/api/validators/${m.id}`, "PATCH", { endSessions: true })}>
                      End sessions
                    </button>
                    <button
                      className="btn btn-sm border-danger/40 text-danger hover:border-danger"
                      disabled={!!busy}
                      onClick={() => confirm(`Remove ${m.name ?? m.wallet}?`) && call(`x${m.id}`, `/api/validators/${m.id}`, "PATCH", { remove: true })}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
