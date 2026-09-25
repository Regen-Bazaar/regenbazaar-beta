"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { NATIVE, enabledNetworks } from "../lib/networks";
import { setNetworkCookie, useNetwork } from "./NetworkProvider";

/** Network choice for the whole site. `compact` = inline list for the mobile menu. */
export function NetworkSwitcher({ compact = false }: { compact?: boolean }) {
  const current = useNetwork();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (key: (typeof current)["key"]) => {
    if (key === current.key) return;
    setNetworkCookie(key);
    start(() => router.refresh());
  };

  if (compact) {
    return (
      <div className="px-3 py-2 text-xs">
        <p className="mb-1 text-paper/50">Network</p>
        {enabledNetworks().map((n) => (
          <button
            key={n.key}
            onClick={() => pick(n.key)}
            className={`block w-full rounded px-2 py-1.5 text-left ${n.key === current.key ? "bg-ink text-gold" : "text-paper/75 hover:text-gold"}`}
          >
            {n.key === current.key ? "● " : "○ "}
            {n.chain.name} · {n.saleCurrency.symbol}
          </button>
        ))}
      </div>
    );
  }

  return (
    <details className="relative">
      <summary
        title="Choose network"
        className="cursor-pointer list-none whitespace-nowrap rounded-full border border-gold/40 px-2.5 py-1 text-xs text-paper/80 hover:border-gold"
      >
        {pending ? "Switching…" : `${current.chain.name} · ${current.saleCurrency.symbol}`} ▾
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-64 rounded-md border border-gold/20 bg-ink-soft p-2 text-xs shadow-lg">
        <p className="px-2 pb-1 text-paper/45">Choose network</p>
        {enabledNetworks().map((n) => (
          <button
            key={n.key}
            onClick={() => pick(n.key)}
            className={`block w-full rounded px-2 py-1.5 text-left hover:bg-ink ${n.key === current.key ? "text-gold" : "text-paper/80"}`}
          >
            {n.key === current.key ? "● " : "○ "}
            {n.chain.name}
            <span className="block pl-4 text-paper/45">
              pay in {n.saleCurrency.symbol}
              {n.saleCurrency.address === NATIVE
                ? " (native, Celo faucet)"
                : n.saleCurrency.testMint
                  ? " (one-click test tokens)"
                  : " (Paxos test faucet)"}
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}
