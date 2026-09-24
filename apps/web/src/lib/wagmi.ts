import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { chain, RPC } from "./chain";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: http(RPC) },
  ssr: true,
});
