"use client";

import { useState } from "react";

/** Long on-chain value (UID, CID) shown shortened, with a button that copies the full value. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const short = value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
  return (
    <span className="inline-flex items-center gap-2">
      <code className="font-mono text-[0.9375rem] text-fg" title={value}>
        {short}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        aria-label={`Copy ${label}`}
        className="rounded-md border border-line-strong px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </span>
  );
}
