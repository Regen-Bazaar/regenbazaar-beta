"use client";

import { useConnect } from "wagmi";
import { hasInjectedWallet } from "../lib/wallet";
import { useNetwork } from "./NetworkProvider";

/** Browser extension first; WalletConnect (QR / mobile) when there is none or the user picks it. */
export function useConnectWallet() {
  const { chain } = useNetwork();
  const { connect, connectors, isPending } = useConnect();
  const browser = connectors.find((c) => c.id === "injected");
  const qr = connectors.find((c) => c.id === "walletConnect");

  const connectBrowser = () => browser && connect({ connector: browser, chainId: chain.id });
  const connectQr = () => qr && connect({ connector: qr, chainId: chain.id });
  /** Returns false when no way to connect exists, so the caller shows the install hint. */
  const connectAny = () => {
    if (hasInjectedWallet()) connectBrowser();
    else if (qr) connectQr();
    else return false;
    return true;
  };

  return { connectBrowser, connectQr, connectAny, hasQr: !!qr, isPending };
}
