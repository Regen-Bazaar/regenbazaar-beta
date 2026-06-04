import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { celoSepolia, RPC } from "./chain";

export const wagmiConfig = createConfig({
  chains: [celoSepolia],
  connectors: [injected()],
  transports: { [celoSepolia.id]: http(RPC) },
  ssr: true,
});
