// Loads open map layer extracts (GeoJSON, clipped to pilot regions) for ESM suggestions. SERVER-ONLY.
// Layers live outside the image (large files): ESM_LAYERS_DIR holds layers.json (the manifest) and the
// GeoJSON files it names. Without it there are no suggestions and the validator decides by hand.
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { suggestEsm, type EsmLayer, type EsmLayerMeta, type EsmSuggestion } from "@rb/impact-engine";

type ManifestEntry = EsmLayerMeta & { file: string };
const MAX_LAYER_BYTES = 50_000_000;
let cache: Promise<EsmLayer[]> | null = null;

async function load(): Promise<EsmLayer[]> {
  const dir = process.env.ESM_LAYERS_DIR;
  if (!dir) return [];
  try {
    const manifest = JSON.parse(await readFile(join(dir, "layers.json"), "utf8")) as ManifestEntry[];
    const layers: EsmLayer[] = [];
    for (const m of Array.isArray(manifest) ? manifest : []) {
      if (!m || typeof m.file !== "string" || typeof m.esm !== "number") continue;
      const buf = await readFile(join(dir, basename(m.file))); // basename: no paths outside the layer dir
      if (buf.length > MAX_LAYER_BYTES) continue;
      layers.push({
        meta: { id: String(m.id), name: String(m.name), licence: m.licence, attribution: String(m.attribution), esm: m.esm },
        data: JSON.parse(buf.toString("utf8")),
      });
    }
    return layers;
  } catch {
    return [];
  }
}

export async function esmSuggestionFor(location: unknown): Promise<EsmSuggestion | null> {
  const l = location as { lat?: unknown; lon?: unknown } | null;
  if (!l || typeof l.lat !== "number" || typeof l.lon !== "number") return null;
  cache ??= load();
  const layers = await cache;
  if (!layers.length) return null;
  return suggestEsm(l.lat, l.lon, layers);
}
