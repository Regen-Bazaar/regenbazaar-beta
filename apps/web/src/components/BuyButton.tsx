"use client";

import { useState } from "react";
import { useAccount, useConnect, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { hasInjectedWallet, NO_WALLET_HINT } from "../lib/wallet";
import { parseUnits } from "viem";
import { NATIVE, erc20Abi, redeemAbi } from "../lib/chain";
import { useNetwork } from "./NetworkProvider";

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
  nonce: string;
  deadline: string;
};

/** Connect → fetch a platform-signed voucher → (approve ERC-20 if needed) → redeem (pay + lazily mint 1 edition). */
export function BuyButton({ listingId }: { listingId: string }) {
  const net = useNetwork();
  const chain = net.chain;
  const PRIMARY_SALE = net.primarySale;
  const SALE_CURRENCY = net.saleCurrency;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: chain.id });
  const { connect } = useConnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");

  async function buy() {
    if (!isConnected) {
      if (!hasInjectedWallet()) {
        setMsg(NO_WALLET_HINT);
        return;
      }
      connect({ connector: injected() });
      return;
    }
    setState("busy");
    setMsg("");
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
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
        feeBps: BigInt(voucher.feeBps),
        nonce: BigInt(voucher.nonce),
        deadline: BigInt(voucher.deadline),
      };
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
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          setMsg("");
        }
      }
      const hash = await writeContractAsync({
        address: PRIMARY_SALE,
        abi: redeemAbi,
        functionName: "redeem",
        args: [v, amount, signature],
        value: v.currency === NATIVE ? total : 0n,
        chainId: chain.id,
      });
      setTx(hash);
      setState("done");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }

  // Testnet stand-in token only: let a demo buyer mint themselves enough to try a purchase.
  async function getTestTokens() {
    if (!isConnected || !address) {
      if (!hasInjectedWallet()) {
        setMsg(NO_WALLET_HINT);
        return;
      }
      connect({ connector: injected() });
      return;
    }
    setMsg("");
    try {
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });
      const hash = await writeContractAsync({
        address: SALE_CURRENCY.address,
        abi: erc20Abi,
        functionName: "mint",
        args: [address, parseUnits("100", SALE_CURRENCY.decimals)],
        chainId: chain.id,
      });
      setMsg(`Minting 100 ${SALE_CURRENCY.symbol}…`);
      await publicClient?.waitForTransactionReceipt({ hash });
      setMsg(`100 ${SALE_CURRENCY.symbol} received`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "mint failed");
    }
  }

  if (state === "done") {
    return (
      <a
        href={`${chain.blockExplorers?.default.url}/tx/${tx}`}
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
      {SALE_CURRENCY.testMint && (
        <button onClick={getTestTokens} className="mt-1 w-full text-xs text-paper/60 underline hover:text-gold">
          Get 100 test {SALE_CURRENCY.symbol} (testnet stand-in, not Paxos)
        </button>
      )}
      {msg && <p className={`mt-1 text-xs ${state === "error" ? "text-red-300" : "text-paper/60"}`}>{msg}</p>}
    </div>
  );
}
