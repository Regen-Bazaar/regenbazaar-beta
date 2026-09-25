"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getNetwork, NETWORK_COOKIE, type Network, type NetworkKey } from "../lib/networks";

const Ctx = createContext<NetworkKey>("arbitrum-sepolia");

export function NetworkProvider({ networkKey, children }: { networkKey: NetworkKey; children: ReactNode }) {
  return <Ctx.Provider value={networkKey}>{children}</Ctx.Provider>;
}

export function useNetwork(): Network {
  return getNetwork(useContext(Ctx));
}

/** Persist the choice; callers refresh the route so server components re-render for the new network. */
export function setNetworkCookie(key: NetworkKey) {
  document.cookie = `${NETWORK_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
