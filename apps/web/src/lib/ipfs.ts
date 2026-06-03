// Pin JSON to a self-hosted kubo (IPFS) node and return an ipfs:// URI. SERVER-SIDE ONLY.
// IPFS_API_URL = kubo RPC (e.g. http://ipfs:5001 inside the compose network) — must NOT be public.
// IPFS_GATEWAY_URL = a read gateway we expose (e.g. https://ipfs.regenbazaar.com) for resolving CIDs.

const API_URL = process.env.IPFS_API_URL ?? "http://127.0.0.1:5001";
const GATEWAY_URL = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080";

/** Add + pin a JSON object; returns `ipfs://<cid>`. Throws on failure (caller falls back / surfaces error). */
export async function pinJson(data: unknown): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify(data)], { type: "application/json" }), "metadata.json");

  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/v0/add?pin=true&cid-version=1`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ipfs add failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  // kubo streams NDJSON; for a single file the CID is in the last non-empty line.
  const text = (await res.text()).trim();
  const last = text.split("\n").filter(Boolean).pop() ?? "{}";
  const hash = (JSON.parse(last) as { Hash?: string }).Hash;
  if (!hash) throw new Error("ipfs add: no CID in response");
  return `ipfs://${hash}`;
}

/** Resolve an ipfs:// URI to our read gateway (for display / wallets that need https). */
export function ipfsToGateway(uri: string): string {
  const cid = uri.replace(/^ipfs:\/\//, "");
  return `${GATEWAY_URL.replace(/\/$/, "")}/ipfs/${cid}`;
}
