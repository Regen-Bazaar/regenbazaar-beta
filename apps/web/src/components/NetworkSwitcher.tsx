"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { NATIVE, enabledNetworks } from "../lib/networks";
import { setNetworkCookie, useNetwork } from "./NetworkProvider";

/** Network choice for the whole site. `compact` = inline list for the mobile menu. */
export function NetworkSwitcher({ compact = false }: { compact?: boolean }) {
  const current = useNetwork();
  const router = useRouter();
  const [pending, start] = useTransition();
  const menu = useRef<HTMLDetailsElement>(null);
  const pick = (key: (typeof current)["key"]) => {
    if (menu.current) menu.current.open = false;
    if (key === current.key) return;
    setNetworkCookie(key);
    start(() => router.refresh());
  };

  if (compact) {
    return (
      <div className="px-1 py-2">
        <p className="label-mono mb-1 px-2">Network</p>
        {enabledNetworks().map((n) => (
          <button
            key={n.key}
            onClick={() => pick(n.key)}
            className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${n.key === current.key ? "bg-raised text-accent" : "text-fg hover:bg-raised"}`}
          >
            {n.key === current.key ? "● " : "○ "}
            {n.chain.name} · {n.saleCurrency.symbol}
          </button>
        ))}
      </div>
    );
  }

  return (
    <details ref={menu} className="relative">
      <summary
        title="Choose network"
        className="flex cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs text-fg hover:border-accent"
      >
        <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
        {pending ? "Switching…" : current.chain.name} ▾
      </summary>
      <div className="card absolute right-0 z-50 mt-3 w-72 p-2 shadow-xl">
        <p className="label-mono px-2 pb-1">Choose network</p>
        {enabledNetworks().map((n) => (
          <button
            key={n.key}
            onClick={() => pick(n.key)}
            className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-raised ${n.key === current.key ? "text-accent" : "text-fg"}`}
          >
            {n.key === current.key ? "● " : "○ "}
            {n.chain.name}
            <span className="block pl-4 text-xs text-subtle">
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
