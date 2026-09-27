"use client";

import { useState } from "react";

// Wallet/viem errors are long dumps (request body, calldata); the first line is the readable part.
const FRIENDLY: [RegExp, string][] = [
  [/user (rejected|denied)/i, "You cancelled the request in your wallet."],
  [/insufficient funds/i, "Not enough funds in the wallet for this payment and the network fee."],
];

function summarize(text: string): string {
  for (const [re, msg] of FRIENDLY) if (re.test(text)) return msg;
  const first = text.split("\n")[0].trim();
  return first.length > 160 ? `${first.slice(0, 157)}…` : first;
}

/** One short line; the full text stays available under "Details" with a copy button. */
export function ErrorNote({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const summary = summarize(text);
  if (summary === text.trim()) return <p className={`break-words ${className}`}>{text}</p>;
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="break-words">{summary}</p>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-subtle hover:text-accent">Details</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-line bg-surface p-2 font-mono text-[11px] text-muted">
          {text}
        </pre>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="mt-1 rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
        >
          {copied ? "copied ✓" : "copy error"}
        </button>
      </details>
    </div>
  );
}
