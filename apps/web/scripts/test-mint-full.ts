// Full W5 path against real IPFS (kubo) + the live Celo Sepolia contracts:
// buildTokenMetadata -> pinJson(kubo) -> EAS attest -> mint tRWI.
//   IPFS_API_URL=http://127.0.0.1:5001 OPERATOR_PRIVATE_KEY=0x.. CELO_SEPOLIA_RPC_URL=.. \
//     node --import tsx scripts/test-mint-full.ts
import { buildTokenMetadata } from "@rb/pipeline";
import { pinJson } from "../src/lib/ipfs.ts";
import { attestImpact, mintImpact } from "../src/lib/onchain.ts";

const ngo = "0x303265Ac916CcD8844E2BD2a61c6522b19f19EcB";
const iv = "292.5";

const meta = buildTokenMetadata({
  title: "Beach reforestation & cleanup — Koh Phangan",
  domain: "environment",
  actions: [
    { actionType: "trees_planted", quantity: 1000, unit: "trees" },
    { actionType: "waste_collected_kg", quantity: 1500, unit: "kg" },
  ],
  frameworks: { sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"] },
  impactValue: Number(iv),
  editions: 100,
  regionCode: "southeast_asia",
  periodStart: "2024-01-01",
  periodEnd: "2025-01-01",
  tablesVersion: "v0.1-seed-2026-06",
  externalUrl: "https://app.regenbazaar.com/submission/demo",
});

const metadataURI = await pinJson(meta);
console.log("pinned metadata:", metadataURI);

const { uid } = await attestImpact(ngo, iv, metadataURI);
console.log("attested uid:", uid);

const { tokenId, txHash } = await mintImpact(uid as `0x${string}`, ngo, 100n, 500);
console.log("minted tokenId:", tokenId.toString(), "tx:", txHash);
console.log("CID:", metadataURI.replace("ipfs://", ""));
