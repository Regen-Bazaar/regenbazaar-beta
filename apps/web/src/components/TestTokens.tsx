"use client";

import { useState } from "react";
import { useAccount, useChainId, useConnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits } from "viem";
import { erc20Abi } from "../lib/chain";
import { hasInjectedWallet, NO_WALLET_HINT } from "../lib/wallet";
import { useNetwork } from "./NetworkProvider";

/** Testnet stand-in token only: one banner that lets a demo buyer mint themselves enough to try a purchase. */
export function TestTokens() {
  const net = useNetwork();
  const chain = net.chain;
  const SALE_CURRENCY = net.saleCurrency;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: chain.id });
  const { connect } = useConnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!SALE_CURRENCY.testMint) return null;

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
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line-strong bg-accent-tint px-5 py-4">
      <p className="text-muted">
        <b className="text-fg">Need test {SALE_CURRENCY.symbol}?</b> Mint 100 to your wallet in one click. It is a
        testnet stand-in for Paxos USDG, with no monetary value.
      </p>
      <button onClick={getTestTokens} disabled={busy} className="btn btn-secondary btn-sm">
        {busy ? "Confirm in wallet…" : `Get 100 test ${SALE_CURRENCY.symbol}`}
      </button>
      {msg && <p className="w-full break-words text-sm text-muted">{msg}</p>}
    </div>
  );
}
