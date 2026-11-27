// Site rules of contract revision 4 that do not depend on a database or a chain (unit-tested directly).
import { zeroAddress } from "viem";
import type { Network } from "./networks";
import type { Actor } from "./validator-auth";

type Hex = `0x${string}`;

/** Contract generation a network signs for: 4 = revision 4 (primarySaleVersion 3), else 3 (today's contracts). */
export function contractGenerationOf(net: Pick<Network, "primarySaleVersion">): 3 | 4 {
  return net.primarySaleVersion === 3 ? 4 : 3;
}

/**
 * Validator reference written into the ImpactClaim v2 attestation: the approving validator's sign-in wallet.
 * The shared access code identifies nobody, so it records the zero address.
 */
export function attestationValidator(actor: Pick<Actor, "via" | "wallet">): Hex {
  if (actor.via === "session" && actor.wallet && /^0x[0-9a-fA-F]{40}$/.test(actor.wallet)) return actor.wallet.toLowerCase() as Hex;
  return zeroAddress;
}
