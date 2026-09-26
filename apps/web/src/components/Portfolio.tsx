"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useConnect, useReadContracts, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasInjectedWallet, NO_WALLET_HINT } from "../lib/wallet";
import { trwiAbi } from "../lib/chain";
import { useNetwork } from "./NetworkProvider";

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

export function Portfolio({ items }: { items: PortfolioItem[] }) {
  const net = useNetwork();
  const chain = net.chain;
  const TRWI = net.trwi;
  const EXPLORER = chain.blockExplorers?.default.url ?? "";
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
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
      <div className="card mt-10 max-w-[640px] p-8">
        <p className="text-lg text-muted">Connect the wallet you funded with to see its tRWI and retire editions.</p>
        <button
          onClick={() => (hasInjectedWallet() ? connect({ connector: injected(), chainId: chain.id }) : setMsg(NO_WALLET_HINT))}
          className="btn btn-primary mt-5"
        >
          Connect wallet to see your tRWI
        </button>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
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
    <div className="mt-10">
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Collections held" value={String(held.length)} />
        <Stat label="Editions held" value={held.reduce((s, i) => s + i.balance, 0n).toString()} />
        <Stat label="Impact Value funded" value={totalIV.toLocaleString(undefined, { maximumFractionDigits: 2 })} />
      </div>

      {isLoading ? (
        <p className="mt-10 text-muted">Reading your balances…</p>
      ) : held.length === 0 ? (
        <p className="card mt-10 p-8 text-muted">
          No tRWI on {chain.name} for {address?.slice(0, 6)}…{address?.slice(-4)} yet.{" "}
          <Link href="/marketplace" className="link">
            Fund an impact
          </Link>
        </p>
      ) : (
        <ul className="mt-10 grid gap-5 xl:grid-cols-2">
          {held.map((i) => (
            <li key={i.tokenId} className="card p-5">
              <div className="flex flex-wrap items-start gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                <img src={`/api/submissions/${i.submissionId}/image`} alt="" className="h-28 w-28 shrink-0 rounded-xl border border-line" />
                <div className="min-w-0 flex-1">
                  <p className="label-mono">{i.domain?.replace(/_/g, " ")}</p>
                  <Link href={`/submission/${i.submissionId}`} className="mt-1 block text-xl font-semibold leading-snug hover:text-accent">
                    {i.title}
                  </Link>
                  <p className="mt-2 text-muted">
                    {i.balance.toString()} of {i.maxEditions} editions · Impact Value{" "}
                    {ivOf(i).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="mt-2 break-all text-sm text-subtle">
                    tRWI #{i.tokenId} · EAS attestation {i.easUid.slice(0, 10)}…{i.easUid.slice(-6)} ·{" "}
                    <a
                      href={`${EXPLORER}/token/${TRWI}/instance/${i.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-accent"
                    >
                      view on explorer
                    </a>
                  </p>
                </div>
                <button
                  onClick={() => retire(i.tokenId, 1n)}
                  disabled={busy === i.tokenId}
                  className="btn btn-secondary btn-sm w-full sm:w-auto"
                  title="Burn one edition to permanently claim its share of the impact"
                >
                  {busy === i.tokenId ? "Confirm in wallet…" : "Retire 1 edition"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-4 break-all text-sm text-muted">{msg}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-6">
      <p className="label-mono">{label}</p>
      <p className="mt-2 font-display text-5xl">{value}</p>
    </div>
  );
}
