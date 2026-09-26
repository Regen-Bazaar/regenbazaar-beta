import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem";
import { enabledNetworks } from "./networks";

const chains = enabledNetworks().map((n) => n.chain) as [Chain, ...Chain[]];

// Public Reown project id (inlined at build time); without it the QR / mobile option is hidden.
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    ...(WALLETCONNECT_PROJECT_ID
      ? [
          walletConnect({
            projectId: WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "Regen Bazaar",
              description: "Fund verified real-world impact",
              url: "https://app.regenbazaar.com",
              icons: ["https://app.regenbazaar.com/apple-icon.png"],
            },
          }),
        ]
      : []),
  ],
  transports: Object.fromEntries(chains.map((c) => [c.id, http(c.rpcUrls.default.http[0])])),
  ssr: true,
});
