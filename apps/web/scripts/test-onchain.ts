// Live chain-side validation of the W5 path against the deployed Celo Sepolia contracts.
//   OPERATOR_PRIVATE_KEY=0x.. CELO_SEPOLIA_RPC_URL=.. node --import tsx scripts/test-onchain.ts
// Uses a placeholder metadataURI (real IPFS pinning is wired in the route via kubo).
import { attestImpact, mintImpact } from "../src/lib/onchain.ts";

const ngo = "0x303265Ac916CcD8844E2BD2a61c6522b19f19EcB"; // stand-in NGO (the operator) for the test

const { uid, txHash: aTx } = await attestImpact(ngo, "515.2583", "ipfs://test-placeholder");
console.log("attested:", uid, "tx:", aTx);

const { tokenId, txHash: mTx } = await mintImpact(uid as `0x${string}`, ngo, 100n, 500);
console.log("minted tokenId:", tokenId.toString(), "tx:", mTx);
