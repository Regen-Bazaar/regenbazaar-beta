"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState } from "react";
import Link from "next/link";
import { hasInjectedWallet, NO_WALLET_HINT } from "../lib/wallet";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [hint, setHint] = useState(false);

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-md border border-gold/30 px-3 py-1.5 text-sm text-paper/80 transition-colors hover:border-gold hover:text-gold"
        title="Disconnect"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => (hasInjectedWallet() ? connect({ connector: injected() }) : setHint((h) => !h))}
        disabled={isPending}
        className="whitespace-nowrap rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {hint && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-md border border-gold/30 bg-ink-soft p-3 text-xs text-paper/80 shadow-lg">
          {NO_WALLET_HINT}{" "}
          <Link href="/guide" className="text-gold underline" onClick={() => setHint(false)}>
            Step-by-step guide
          </Link>
        </div>
      )}
    </div>
  );
}
