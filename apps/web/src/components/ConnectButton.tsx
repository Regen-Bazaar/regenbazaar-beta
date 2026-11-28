"use client";

import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { useState } from "react";
import Link from "next/link";
import { hasInjectedWallet, NO_WALLET_HINT, WALLET_TIP } from "../lib/wallet";
import { useNetwork } from "./NetworkProvider";
import { useConnectWallet } from "./useConnectWallet";
import { Icon, type IconName } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";

const MENU: { href: string; label: string; note?: string; icon: IconName }[] = [
  { href: "/portfolio", label: "My impact", note: "The tRWI you hold", icon: "grid" },
  { href: "/dashboard", label: "Dashboard", note: "All tokenized impact", icon: "list" },
  { href: "/guide", label: "Guide", icon: "book" },
];

export function ConnectButton() {
  const net = useNetwork();
  const { address, isConnected, chainId } = useAccount();
  const { connectBrowser, connectQr, hasQr, isPending } = useConnectWallet();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isConnected && address) {
    const wrong = chainId !== net.chain.id;
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <>
        {/* Wallet on another chain: one click switches, and adds the network to the wallet if it is missing. */}
        {wrong && (
          <button
            onClick={() => switchChain({ chainId: net.chain.id })}
            disabled={switching}
            className="btn btn-sm border-gold bg-accent-tint text-fg"
            title={`Your wallet is on another network. Switch it to ${net.chain.name}.`}
          >
            <Icon name={switching ? "refresh" : "switch"} />
            {switching ? "Confirm in wallet…" : "Switch network"}
          </button>
        )}
        <button type="button" onClick={() => setMenu(true)} className="avatar" aria-haspopup="dialog" aria-label={`Wallet ${short}: open menu`} title={short}>
          <Icon name="user" />
        </button>
        <Sheet open={menu} onClose={() => setMenu(false)} title="Wallet" menu>
          <div className="card grid grid-cols-[48px_1fr_auto] items-center gap-3 p-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-on-primary">
              <Icon name="wallet" />
            </span>
            <span className="min-w-0">
              <b className="block font-semibold tabular-nums" title={address}>
                {short}
              </b>
              <span className="block text-label text-subtle">{wrong ? `Wallet is on another network, the site is on ${net.chain.name}` : net.chain.name}</span>
            </span>
            <button
              type="button"
              className="iconbtn"
              aria-label={copied ? "Address copied" : "Copy address"}
              title={copied ? "Copied" : "Copy address"}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {}
              }}
            >
              <Icon name={copied ? "check" : "copy"} />
            </button>
          </div>
          <div>
            {MENU.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenu(false)} className="opt opt-flat">
                <Icon name={l.icon} />
                <span>
                  <b>{l.label}</b>
                  {l.note && <span className="label">{l.note}</span>}
                </span>
                <Icon name="chev" />
              </Link>
            ))}
          </div>
          <button type="button" onClick={() => (setMenu(false), disconnect())} className="btn btn-secondary btn-sm btn-block">
            Disconnect
          </button>
        </Sheet>
      </>
    );
  }
  // Long network names leave no room for the word on a 375px phone; below 360px there is never room.
  const tight = net.chain.name.length > 18 ? "max-sm:sr-only" : "max-[359px]:sr-only";
  return (
    <>
      <button
        // Extension only and no QR option: connect straight away, as before.
        onClick={() => (hasInjectedWallet() && !hasQr ? connectBrowser() : setMenu(true))}
        disabled={isPending}
        className="btn btn-primary btn-sm"
        aria-haspopup="dialog"
      >
        <Icon name={isPending ? "refresh" : "wallet"} />
        <span className={tight}>{isPending ? "Connecting…" : "Connect"}</span>
      </button>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Connect a wallet" menu>
        {hasInjectedWallet() ? (
          <button type="button" onClick={() => (setMenu(false), connectBrowser())} className="opt">
            <span className="icbox">
              <Icon name="wallet" />
            </span>
            <span>
              <b>Browser wallet</b>
              <span className="label">MetaMask, Rabby or another extension</span>
            </span>
            <Icon name="chev" />
          </button>
        ) : (
          <p className="text-meta text-muted">{NO_WALLET_HINT}</p>
        )}
        {hasQr && (
          <button type="button" onClick={() => (setMenu(false), connectQr())} className="opt">
            <span className="icbox">
              <Icon name="qr" />
            </span>
            <span>
              <b>WalletConnect</b>
              <span className="label">Scan a QR code with a phone wallet</span>
            </span>
            <Icon name="chev" />
          </button>
        )}
        <p className="text-label text-subtle">
          {WALLET_TIP}{" "}
          <Link href="/guide" className="link" onClick={() => setMenu(false)}>
            Step-by-step guide
          </Link>
        </p>
      </Sheet>
    </>
  );
}
