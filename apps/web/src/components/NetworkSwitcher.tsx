"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { NATIVE, enabledNetworks } from "../lib/networks";
import { setNetworkCookie, useNetwork } from "./NetworkProvider";
import { Icon } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";

/** Network choice for the whole site: a chip in the app bar that names the (test) network and opens the list. */
export function NetworkSwitcher() {
  const current = useNetwork();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const pick = (key: (typeof current)["key"]) => {
    setOpen(false);
    // Ask the wallet to follow (adds the network if it is missing); declining keeps the site choice.
    const target = enabledNetworks().find((n) => n.key === key)!.chain.id;
    if (isConnected && chainId !== target) switchChain({ chainId: target });
    if (key === current.key) return;
    setNetworkCookie(key);
    start(() => router.refresh());
  };
  // Wallet on another network: on a narrow phone the "Switch network" button takes the chip's place.
  const wrong = isConnected && chainId !== current.chain.id;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Test network, no real money. Choose network"
        aria-haspopup="dialog"
        className={`netchip min-w-0 ${wrong ? "max-sm:hidden" : ""}`}
      >
        <span className="truncate">{pending ? "Switching…" : current.chain.name}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Network" menu>
        <p className="-mt-2 text-label text-subtle">Each impact lives on one network. The list shows the one you choose.</p>
        {enabledNetworks().map((n) => {
          const on = n.key === current.key;
          return (
            <button key={n.key} type="button" onClick={() => pick(n.key)} aria-current={on ? "true" : undefined} className="opt">
              <span className="icbox">
                <Icon name="globe" />
              </span>
              <span>
                <b>{n.chain.name}</b>
                <span className="label">
                  pay in {n.saleCurrency.symbol}
                  {n.saleCurrency.address === NATIVE
                    ? " (native, Celo faucet)"
                    : n.saleCurrency.testMint
                      ? " (one-click test tokens)"
                      : " (Paxos test faucet)"}
                </span>
              </span>
              {on && <Icon name="check" title="Chosen" />}
            </button>
          );
        })}
      </Sheet>
    </>
  );
}
