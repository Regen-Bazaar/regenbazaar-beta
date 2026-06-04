// Export contract ABIs from Foundry `out/` to `abis/` so the web app + indexer consume one source.
// Run after `forge build`:  node scripts/export-abis.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");
const destDir = join(root, "abis");
mkdirSync(destDir, { recursive: true });

// Our contracts (required) + EAS pieces (best-effort; needed for attestation calls).
const required = ["TRWI", "REBAZ", "TRWIStaking", "AuthorizedAttesterResolver", "RegenMarketplace", "RegenPrimarySale"];
const optional = ["EAS", "SchemaRegistry"];

function exportAbi(name, required) {
  const p = join(outDir, `${name}.sol`, `${name}.json`);
  if (!existsSync(p)) {
    if (required) {
      console.error(`missing ${p} — run \`forge build\` first`);
      process.exit(1);
    }
    console.warn(`skip ${name} (artifact not found)`);
    return;
  }
  const abi = JSON.parse(readFileSync(p, "utf8")).abi;
  writeFileSync(join(destDir, `${name}.json`), JSON.stringify(abi, null, 2) + "\n");
  console.log(`exported ${name} (${abi.length} ABI entries)`);
}

for (const c of required) exportAbi(c, true);
for (const c of optional) exportAbi(c, false);
console.log(`ABIs written to ${destDir}`);
