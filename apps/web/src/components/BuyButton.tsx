"use client";

import { useState } from "react";
import { useAccount, useConnect, useChainId, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { PRIMARY_SALE, NATIVE, celoSepolia, redeemAbi } from "../lib/chain";

type VoucherJson = {
  tokenId: string;
  creator: `0x${string}`;
  totalIV: string;
  maxEditions: string;
  pricePerEdition: string;
  currency: `0x${string}`;
  beneficiary: `0x${string}`;
  easUID: `0x${string}`;
  metadataURI: string;
  royaltyBps: string;
  nonce: string;
  deadline: string;
};

/** Connect → fetch a platform-signed voucher → redeem (pay + lazily mint 1 edition to the buyer). */
export function BuyButton({ listingId }: { listingId: string }) {
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");

  async function buy() {
    if (!isConnected) {
      connect({ connector: injected() });
      return;
    }
    setState("busy");
    setMsg("");
    try {
      if (chainId !== celoSepolia.id) await switchChainAsync({ chainId: celoSepolia.id });
      const res = await fetch(`/api/listings/${listingId}/voucher`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "voucher unavailable");
      const { voucher, signature } = (await res.json()) as { voucher: VoucherJson; signature: `0x${string}` };

      const v = {
        tokenId: BigInt(voucher.tokenId),
        creator: voucher.creator,
        totalIV: BigInt(voucher.totalIV),
        maxEditions: BigInt(voucher.maxEditions),
        pricePerEdition: BigInt(voucher.pricePerEdition),
        currency: voucher.currency,
        beneficiary: voucher.beneficiary,
        easUID: voucher.easUID,
        metadataURI: voucher.metadataURI,
        royaltyBps: BigInt(voucher.royaltyBps),
        nonce: BigInt(voucher.nonce),
        deadline: BigInt(voucher.deadline),
      };
      const amount = 1n;
      const hash = await writeContractAsync({
        address: PRIMARY_SALE,
        abi: redeemAbi,
        functionName: "redeem",
        args: [v, amount, signature],
        value: v.currency === NATIVE ? v.pricePerEdition * amount : 0n,
        chainId: celoSepolia.id,
      });
      setTx(hash);
      setState("done");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }

  if (state === "done") {
    return (
      <a
        href={`${celoSepolia.blockExplorers.default.url}/tx/${tx}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-md border border-green/50 py-2 text-center text-sm text-green-soft"
      >
        Funded ✓ — view tx
      </a>
    );
  }
  return (
    <div className="mt-4">
      <button
        onClick={buy}
        disabled={state === "busy"}
        className="w-full rounded-md bg-gold py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
      >
        {state === "busy" ? "Confirm in wallet…" : isConnected ? "Fund this impact" : "Connect to fund"}
      </button>
      {state === "error" && <p className="mt-1 text-xs text-red-300">{msg}</p>}
    </div>
  );
}
