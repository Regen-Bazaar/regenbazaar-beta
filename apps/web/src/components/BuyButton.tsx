"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { NO_WALLET_HINT } from "../lib/wallet";
import { NATIVE, erc20Abi, feeOverrides, redeemAbiV1, redeemAbiV2 } from "../lib/chain";
import { useNetwork } from "./NetworkProvider";
import { useConnectWallet } from "./useConnectWallet";
import { ErrorNote } from "./ErrorNote";

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
  feeBps: string;
  partner: `0x${string}`;
  partnerFeeBps: string;
  nonce: string;
  deadline: string;
};

/** Connect → fetch a platform-signed voucher → (approve ERC-20 if needed) → redeem (pay + lazily mint 1 edition). */
export function BuyButton({ listingId }: { listingId: string }) {
  const net = useNetwork();
  const chain = net.chain;
  const PRIMARY_SALE = net.primarySale;
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: chain.id });
  const { connectAny } = useConnectWallet();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");

  async function buy() {
    if (!isConnected) {
      if (!connectAny()) setMsg(NO_WALLET_HINT);
      return;
    }
    setState("busy");
    setMsg("");
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      const res = await fetch(`/api/listings/${listingId}/voucher`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "voucher unavailable");
      const { voucher, signature, version } = (await res.json()) as {
        voucher: VoucherJson;
        signature: `0x${string}`;
        version: 1 | 2;
      };

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
        feeBps: BigInt(voucher.feeBps),
        nonce: BigInt(voucher.nonce),
        deadline: BigInt(voucher.deadline),
      };
      const partner = { partner: voucher.partner, partnerFeeBps: BigInt(voucher.partnerFeeBps) };
      const amount = 1n;
      const total = v.pricePerEdition * amount;
      if (v.currency !== NATIVE) {
        if (!address || !publicClient) throw new Error("wallet not ready");
        const allowance = await publicClient.readContract({
          address: v.currency,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, PRIMARY_SALE],
        });
        if (allowance < total) {
          setMsg("Approve the payment token in your wallet…");
          const approveHash = await writeContractAsync({
            address: v.currency,
            abi: erc20Abi,
            functionName: "approve",
            args: [PRIMARY_SALE, total],
            chainId: chain.id,
            ...(await feeOverrides(publicClient)),
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          setMsg("");
        }
      }
      const common = {
        address: PRIMARY_SALE,
        functionName: "redeem",
        value: v.currency === NATIVE ? total : 0n,
        chainId: chain.id,
        ...(await feeOverrides(publicClient)),
      } as const;
      // The server signs for the contract version deployed on this network; send the matching tuple.
      const hash =
        version === 2
          ? await writeContractAsync({ ...common, abi: redeemAbiV2, args: [{ ...v, ...partner }, amount, signature] })
          : await writeContractAsync({ ...common, abi: redeemAbiV1, args: [v, amount, signature] });
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
        href={`${chain.blockExplorers?.default.url}/tx/${tx}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm mt-4 w-full border-ok/40 bg-ok-tint text-ok"
      >
        Bought ✓ · view tx
      </a>
    );
  }
  return (
    <div className="mt-4">
      <button
        onClick={buy}
        disabled={state === "busy"}
        className="btn btn-primary w-full"
      >
        {state === "busy" ? "Confirm in wallet…" : isConnected ? "Buy this impact" : "Connect to buy"}
      </button>
      {msg && <ErrorNote text={msg} className={`mt-2 text-xs ${state === "error" ? "text-danger" : "text-subtle"}`} />}
    </div>
  );
}
