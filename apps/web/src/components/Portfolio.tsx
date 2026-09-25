"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useConnect, useChainId, useReadContracts, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasInjectedWallet, NO_WALLET_HINT } from "../lib/wallet";
import { TRWI, chain, trwiAbi } from "../lib/chain";

export type PortfolioItem = {
  tokenId: string;
  maxEditions: number;
  easUid: string;
  metadataUri: string;
  submissionId: string;
  title: string;
  domain: string | null;
  totalIV: number;
};

const EXPLORER = chain.blockExplorers?.default.url ?? "";

export function Portfolio({ items }: { items: PortfolioItem[] }) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: chain.id });
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const { data, refetch, isLoading } = useReadContracts({
    contracts: items.map((i) => ({
      address: TRWI,
      abi: trwiAbi,
      functionName: "balanceOf" as const,
      args: [address ?? "0x0000000000000000000000000000000000000000", BigInt(i.tokenId)] as const,
      chainId: chain.id,
    })),
    query: { enabled: !!address && items.length > 0 },
  });

  if (!isConnected) {
    return (
      <div className="mt-8">
        <button
          onClick={() => (hasInjectedWallet() ? connect({ connector: injected() }) : setMsg(NO_WALLET_HINT))}
          className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-soft"
        >
          Connect wallet to see your tRWI
        </button>
        {msg && <p className="mt-2 text-xs text-paper/60">{msg}</p>}
      </div>
    );
  }

  const held = items
    .map((i, idx) => ({ ...i, balance: (data?.[idx]?.result as bigint | undefined) ?? 0n }))
    .filter((i) => i.balance > 0n);
  // IV carried by the held editions = totalIV * balance / maxEditions (same formula as TRWI.impactValueOf).
  const ivOf = (i: (typeof held)[number]) => (i.totalIV * Number(i.balance)) / i.maxEditions;
  const totalIV = held.reduce((s, i) => s + ivOf(i), 0);

  async function retire(tokenId: string, amount: bigint) {
    setBusy(tokenId);
    setMsg("");
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      const hash = await writeContractAsync({
        address: TRWI,
        abi: trwiAbi,
        functionName: "retire",
        args: [BigInt(tokenId), amount],
        chainId: chain.id,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      setMsg(`Retired ${amount} edition(s). Tx: ${hash}`);
      await refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "retire failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Collections held" value={String(held.length)} />
        <Stat label="Editions held" value={held.reduce((s, i) => s + i.balance, 0n).toString()} />
        <Stat label="Impact Value funded" value={totalIV.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>

      {isLoading ? (
        <p className="mt-8 text-paper/60">Reading your balances…</p>
      ) : held.length === 0 ? (
        <p className="mt-8 text-paper/60">
          No tRWI on {chain.name} for {address?.slice(0, 6)}…{address?.slice(-4)} yet.{" "}
          <Link href="/marketplace" className="text-gold underline">
            Fund an impact
          </Link>
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {held.map((i) => (
            <li key={i.tokenId} className="rounded-xl border border-gold/15 bg-ink-soft/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                <img src={`/api/submissions/${i.submissionId}/image`} alt="" className="h-20 w-20 rounded-md border border-gold/15" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-paper/45">{i.domain?.replace(/_/g, " ")}</p>
                  <Link href={`/submission/${i.submissionId}`} className="text-lg font-semibold hover:text-gold">
                    {i.title}
                  </Link>
                  <p className="mt-1 text-sm text-paper/70">
                    {i.balance.toString()} of {i.maxEditions} editions · Impact Value{" "}
                    {ivOf(i).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 break-all text-xs text-paper/45">
                    tRWI #{i.tokenId} · EAS attestation {i.easUid.slice(0, 10)}…{i.easUid.slice(-6)} ·{" "}
                    <a
                      href={`${EXPLORER}/token/${TRWI}/instance/${i.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gold"
                    >
                      view on explorer
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => retire(i.tokenId, 1n)}
                  disabled={busy === i.tokenId}
                  className="rounded-md border border-gold/40 px-3 py-1.5 text-xs hover:border-gold hover:text-gold disabled:opacity-50"
                  title="Burn one edition to permanently claim its share of the impact"
                >
                  {busy === i.tokenId ? "Confirm in wallet…" : "Retire 1 edition"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-4 break-all text-xs text-paper/60">{msg}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold/15 bg-ink-soft/30 p-4">
      <p className="text-xs uppercase tracking-wide text-paper/45">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
