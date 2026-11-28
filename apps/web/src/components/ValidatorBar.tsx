"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { stringToHex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { NONCE_TTL_MS, SIGN_IN_STATEMENT } from "../lib/validator-constants";
import { useConnectWallet } from "./useConnectWallet";
import { ErrorNote } from "./ErrorNote";

/** Shared mode only: the access code the old /verify form keeps for this tab. */
export function sharedHeaders(): Record<string, string> {
  try {
    const t = sessionStorage.getItem("rb_admin_token");
    return t ? { "x-admin-token": t } : {};
  } catch {
    return {};
  }
}

export type Me = {
  ready: boolean;
  mode: "shared" | "personal";
  user: { id: string; wallet: string; name: string | null; role: "validator" | "admin" } | null;
};

/** Which sign-in the site uses and who is signed in. Until it answers, mode is "shared" (the old code form). */
export function useValidatorMe(): Me {
  const [me, setMe] = useState<Me>({ ready: false, mode: "shared", user: null });
  useEffect(() => {
    // A failed lookup is not "shared mode": keep waiting and retry, so personal sign-in never silently shows the old code form.
    let stop = false;
    const ask = (left: number) =>
      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("me failed"))))
        .then((b) => !stop && setMe({ ready: true, mode: b.mode === "personal" ? "personal" : "shared", user: b.user ?? null }))
        .catch(() => {
          if (!stop && left > 0) setTimeout(() => ask(left - 1), 2000);
        });
    void ask(5);
    return () => {
      stop = true;
    };
  }, []);
  return me;
}

const roleLabel = (r: string) => (r === "admin" ? "admin" : "reviewer");

/** Personal mode only: sign-in with a wallet signature, or who is signed in with links to team and log. Nothing in shared mode. */
export function ValidatorBar({ me, current }: { me: Me; current?: "queue" | "partners" | "team" | "log" }) {
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectAny, isPending } = useConnectWallet();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wantSign, setWantSign] = useState(false);

  const signIn = useCallback(async () => {
    if (!address || !connector) return;
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
      // Ask the wallet directly. A sign-in signature is valid on any network, while wagmi's signMessage makes a
      // WalletConnect wallet "switch" to the network it is already on, which fails when that is not one of ours
      // (a phone wallet left on Ethereum mainnet: "Chain not configured").
      const provider = (await connector.getProvider()) as {
        request(args: { method: string; params: unknown[] }): Promise<unknown>;
      };
      const signature = (await provider.request({
        method: "personal_sign",
        params: [stringToHex(message), address],
      })) as string;
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
  }, [address, chainId, connector]);

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
            const res = await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
            if (res?.ok) window.location.href = "/verify";
            else setError("Could not sign out. Try again.");
          }}
        >
          Sign out
        </button>
        {error && <span className="text-danger">{error}</span>}
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
