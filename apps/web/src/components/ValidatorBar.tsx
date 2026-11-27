"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { NONCE_TTL_MS, SIGN_IN_STATEMENT } from "../lib/validator-constants";
import { useConnectWallet } from "./useConnectWallet";
import { ErrorNote } from "./ErrorNote";

export type Me = {
  ready: boolean;
  mode: "shared" | "personal";
  user: { id: string; wallet: string; name: string | null; role: "validator" | "admin" } | null;
};

/** Which sign-in the site uses and who is signed in. Until it answers, mode is "shared" (the old code form). */
export function useValidatorMe(): Me {
  const [me, setMe] = useState<Me>({ ready: false, mode: "shared", user: null });
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((b) => setMe({ ready: true, mode: b.mode === "personal" ? "personal" : "shared", user: b.user ?? null }))
      .catch(() => setMe((m) => ({ ...m, ready: true })));
  }, []);
  return me;
}

const roleLabel = (r: string) => (r === "admin" ? "admin" : "reviewer");

/** Personal mode only: sign-in with a wallet signature, or who is signed in with links to team and log. Nothing in shared mode. */
export function ValidatorBar({ me, current }: { me: Me; current?: "queue" | "partners" | "team" | "log" }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connectAny, isPending } = useConnectWallet();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wantSign, setWantSign] = useState(false);

  const signIn = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const n = await fetch("/api/auth/nonce", { method: "POST" });
      if (!n.ok) throw new Error("could not start sign-in");
      const { nonce } = (await n.json()) as { nonce: string };
      const now = new Date();
      const message = createSiweMessage({
        address,
        chainId: chainId ?? 1,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: SIGN_IN_STATEMENT,
        issuedAt: now,
        expirationTime: new Date(now.getTime() + NONCE_TTL_MS),
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "too many attempts, try again later" : "This wallet is not on the validator team.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
    } finally {
      setBusy(false);
      setWantSign(false);
    }
  }, [address, chainId, signMessageAsync]);

  useEffect(() => {
    if (wantSign && isConnected && address && !busy) void signIn();
  }, [wantSign, isConnected, address, busy, signIn]);

  if (!me.ready || me.mode !== "personal") return null;

  if (me.user) {
    const tab = (key: string, href: string, label: string) => (
      <Link href={href} className={`btn btn-sm ${current === key ? "btn-primary" : "btn-secondary"}`}>
        {label}
      </Link>
    );
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">
          Signed in as <b>{me.user.name ?? me.user.wallet.slice(0, 8)}</b> ({roleLabel(me.user.role)})
        </span>
        {tab("queue", "/verify", "Queue")}
        {tab("partners", "/verify/partners", "Partners")}
        {me.user.role === "admin" && tab("team", "/verify/team", "Team")}
        {tab("log", "/verify/log", "Log")}
        <button
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            await fetch("/api/auth/sign-out", { method: "POST" });
            window.location.href = "/verify";
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-[560px]">
      <p className="text-muted">
        Sign in with your validator wallet. You sign a short message; nothing goes on-chain and it costs nothing. Check that the message names{" "}
        <b>{typeof window === "undefined" ? "this site" : window.location.host}</b>.
      </p>
      <button
        className="btn btn-primary btn-sm mt-3"
        disabled={busy || isPending}
        onClick={() => {
          setError("");
          if (isConnected) void signIn();
          else if (connectAny()) setWantSign(true);
          else setError("No wallet found. Install a browser wallet or use a phone wallet.");
        }}
      >
        {busy ? "Confirm in your wallet…" : isConnected ? "Sign in" : "Connect wallet and sign in"}
      </button>
      {error && <ErrorNote text={error} className="mt-3 text-danger" />}
    </div>
  );
}
