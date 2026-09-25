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
        className="btn btn-secondary btn-sm font-mono !text-[15px] !font-normal"
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
        className="btn btn-primary btn-sm"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {hint && (
        <div className="card absolute right-0 z-50 mt-3 w-72 whitespace-normal p-4 text-sm text-muted shadow-xl">
          {NO_WALLET_HINT}{" "}
          <Link href="/guide" className="link" onClick={() => setHint(false)}>
            Step-by-step guide
          </Link>
        </div>
      )}
    </div>
  );
}
