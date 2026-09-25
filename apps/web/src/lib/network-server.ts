// Server-side: the visitor's selected network (cookie), for server components and route handlers.
import { cookies } from "next/headers";
import { getNetwork, NETWORK_COOKIE, type Network } from "./networks";

export async function currentNetwork(): Promise<Network> {
  return getNetwork((await cookies()).get(NETWORK_COOKIE)?.value);
}
