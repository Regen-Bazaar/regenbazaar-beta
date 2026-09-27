"use client";

import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { useState } from "react";
import Link from "next/link";
import { hasInjectedWallet, NO_WALLET_HINT, WALLET_TIP } from "../lib/wallet";
import { useNetwork } from "./NetworkProvider";
import { useConnectWallet } from "./useConnectWallet";

export function ConnectButton() {
  const net = useNetwork();
  const { address, isConnected, chainId } = useAccount();
  const { connectBrowser, connectQr, hasQr, isPending } = useConnectWallet();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const [menu, setMenu] = useState(false);

  if (isConnected && address) {
    // Wallet on another chain: one click switches, and adds the network to the wallet if it is missing.
    if (chainId !== net.chain.id) {
      return (
        <button
          onClick={() => switchChain({ chainId: net.chain.id })}
          disabled={switching}
          className="btn btn-primary btn-sm"
          title={`Your wallet is on another network. Switch it to ${net.chain.name}.`}
        >
          {switching ? "Confirm in wallet…" : `Switch to ${net.chain.name}`}
        </button>
      );
    }
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
        // Extension only and no QR option: connect straight away, as before.
        onClick={() => (hasInjectedWallet() && !hasQr ? connectBrowser() : setMenu((m) => !m))}
        disabled={isPending}
        className="btn btn-primary btn-sm"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {menu && (
        <div className="card absolute right-0 z-50 mt-3 w-72 whitespace-normal p-2 text-sm shadow-xl">
          {hasInjectedWallet() ? (
            <button
              onClick={() => (setMenu(false), connectBrowser())}
              className="block w-full rounded-lg px-2 py-2 text-left hover:bg-raised"
            >
              Browser wallet
              <span className="block text-xs text-subtle">MetaMask, Rabby or another extension</span>
            </button>
          ) : (
            <p className="px-2 py-2 text-muted">{NO_WALLET_HINT}</p>
          )}
          {hasQr && (
            <button
              onClick={() => (setMenu(false), connectQr())}
              className="block w-full rounded-lg px-2 py-2 text-left hover:bg-raised"
            >
              WalletConnect
              <span className="block text-xs text-subtle">Scan a QR code with a phone wallet</span>
            </button>
          )}
          <p className="px-2 pb-1 pt-2 text-xs text-subtle">
            {WALLET_TIP}{" "}
            <Link href="/guide" className="link" onClick={() => setMenu(false)}>
              Step-by-step guide
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
