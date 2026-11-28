"use client";

import { useEffect, useState } from "react";
import type { ProofFlag } from "@rb/impact-engine";
import { sharedHeaders } from "../../components/ValidatorBar";
import { safeHref } from "../../lib/safe-link";
import type { ProofCheck } from "./ReviewV02";

export type StoredPage = {
  kind: "proof" | "photo";
  url: string;
  fetchedAt: string;
  httpStatus: number | null;
  contentType: string | null;
  sha256: string | null;
  bytes: number | null;
  truncated: boolean;
  reader: "ai" | "pattern" | "none";
  error: string | null;
  text: string | null; // untrusted page text: shown as text only
};

const SEVERITY: Record<string, string> = { ok: "text-ok", warn: "text-accent", fail: "text-danger" };

function readerText(p: StoredPage | undefined): string {
  if (!p) return "not fetched yet";
  if (p.error) return "could not be opened";
  if (p.reader === "ai") return "text read by the AI page reader";
  if (p.reader === "pattern") return "text read by pattern matching only (the AI page reader did not answer)";
  return "fingerprint only (an image, a file, or no readable text)";
}

/** Proof links and photo links with the automatic checks, the stored page text and the place names field. */
export function Evidence({
  id,
  proofLinks,
  photoLinks,
  checks,
  pages,
  placeNames,
  proofStatus,
  onChanged,
}: {
  id: string;
  proofLinks: string[];
  photoLinks: string[];
  checks: ProofCheck[] | null;
  pages: StoredPage[];
  placeNames: string[];
  proofStatus: string;
  onChanged: () => void;
}) {
  const [places, setPlaces] = useState(placeNames.join(", "));
  const [busy, setBusy] = useState<"" | "check" | "places">("");
  const [error, setError] = useState("");
  // Reset only when the saved names really change; a reload that returns the same names must not wipe what is being typed.
  const savedKey = placeNames.join(", ");
  useEffect(() => setPlaces(savedKey), [savedKey]);
  const all = [...proofLinks.map((u) => ({ u, kind: "proof" as const })), ...photoLinks.filter((u) => !proofLinks.includes(u)).map((u) => ({ u, kind: "photo" as const }))];
  const names = () => places.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 5);

  async function call(kind: "check" | "places") {
    setBusy(kind);
    setError("");
    const res =
      kind === "check"
        ? await fetch(`/api/submissions/${id}/proof`, { method: "POST", headers: { "content-type": "application/json", ...sharedHeaders() }, body: JSON.stringify({ placeNames: names() }) })
        : await fetch(`/api/review/${id}/places`, { method: "PUT", headers: { "content-type": "application/json", ...sharedHeaders() }, body: JSON.stringify({ placeNames: names() }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? "failed");
    setBusy("");
    onChanged();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="label-mono">Proof and photo links · automatic checks</div>
        {all.length > 0 && (
          <button type="button" onClick={() => call("check")} disabled={busy !== "" || proofStatus === "running"} className="btn btn-secondary btn-sm">
            {busy === "check" || proofStatus === "running" ? "Checking…" : checks ? "Check again" : "Check links"}
          </button>
        )}
      </div>
      {all.length === 0 && <p className="text-sm text-danger">No proof links: P0, cannot be listed.</p>}
      {proofStatus === "running" && <p className="mt-1 text-sm text-muted">Checks running. You can read the claim meanwhile; this section updates by itself.</p>}
      {proofStatus === "none" && all.length > 0 && <p className="mt-1 text-sm text-muted">Not checked yet. They start by themselves when an impact is opened; press the button if the site limit postponed them.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="mt-2 space-y-3 text-sm">
        {all.map(({ u, kind }) => {
          const r = checks?.find((x) => x.url === u);
          const p = pages.find((x) => x.url === u);
          const href = safeHref(u);
          return (
            <li key={u} className="break-all">
              <span className="label-mono mr-2">{kind === "photo" ? "photo" : "proof"}</span>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">
                  {u}
                </a>
              ) : (
                <span>{u}</span>
              )}
              <div className="mt-0.5 text-xs text-subtle">{readerText(p)}{p?.truncated ? " · only the first 1 MB was fingerprinted" : ""}</div>
              {r && (
                <ul className="mt-1 space-y-0.5 pl-3">
                  {r.flags.length === 0 && !r.error && <li className="text-subtle">saved (no text to compare)</li>}
                  {r.flags.map((f: ProofFlag, i: number) => (
                    <li key={i} className={SEVERITY[f.severity]}>
                      {f.severity}: {f.detail}
                    </li>
                  ))}
                  {r.sha256 && <li className="font-mono text-xs text-subtle">fingerprint {r.sha256.slice(0, 16)}… · {r.checkedAt.slice(0, 16)}</li>}
                </ul>
              )}
              {p?.text && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-subtle">Stored page text ({p.text.length.toLocaleString("en-US")} characters, private)</summary>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-raised p-3 text-xs text-muted">{p.text}</pre>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {all.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm" htmlFor={`pl-${id}`}>
            <span className="text-subtle">Place names to look for on the pages (comma separated, up to 5), for example the beach and the island</span>
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input id={`pl-${id}`} value={places} onChange={(e) => setPlaces(e.target.value)} maxLength={400} placeholder="Haad Rin, Koh Phangan" className="field min-w-0 flex-1" />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== ""} onClick={() => call("places")}>
              {busy === "places" ? "Saving…" : "Save and compare"}
            </button>
          </div>
          <p className="mt-1 text-xs text-subtle">Saving compares the stored page text again. It opens no page and asks no AI.</p>
        </div>
      )}
      <p className="mt-2 text-xs text-subtle">Automatic checks are rules comparing the page with the claim. They inform you; they never set the level or the score.</p>
    </div>
  );
}
