"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { wagmiConfig } from "../lib/wagmi";
import { NetworkProvider } from "./NetworkProvider";
import type { NetworkKey } from "../lib/networks";

export function Providers({ networkKey, children }: { networkKey: NetworkKey; children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider networkKey={networkKey}>{children}</NetworkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
