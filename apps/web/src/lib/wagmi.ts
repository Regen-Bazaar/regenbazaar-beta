import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Chain } from "viem";
import { enabledNetworks } from "./networks";

const chains = enabledNetworks().map((n) => n.chain) as [Chain, ...Chain[]];

export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  transports: Object.fromEntries(chains.map((c) => [c.id, http(c.rpcUrls.default.http[0])])),
  ssr: true,
});
