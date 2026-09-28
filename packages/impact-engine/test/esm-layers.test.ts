import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pointInLayer, suggestEsm, type EsmLayer } from "../src/esm-layers.ts";

// Synthetic test polygons (not real map data): a square "mangrove" patch with a hole, and a "reef".
const mangrove: EsmLayer = {
  meta: { id: "gmw-test", name: "Mangrove extent (test)", licence: "CC BY 4.0", attribution: "test", esm: 1.3 },
  data: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [[100.0, 9.7], [100.1, 9.7], [100.1, 9.8], [100.0, 9.8], [100.0, 9.7]],
            [[100.04, 9.74], [100.06, 9.74], [100.06, 9.76], [100.04, 9.76], [100.04, 9.74]],
          ],
        },
      },
    ],
  },
};
const forest: EsmLayer = {
  meta: { id: "forest-test", name: "Forest (test)", licence: "CC BY 4.0", attribution: "test", esm: 1.2 },
  data: {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "MultiPolygon", coordinates: [[[[99.9, 9.6], [100.2, 9.6], [100.2, 9.9], [99.9, 9.9], [99.9, 9.6]]]] } }],
  },
};

test("a point inside the mangrove layer suggests ESM 1.3", () => {
  const s = suggestEsm(9.72, 100.02, [mangrove, forest]);
  assert.equal(s.esm, 1.3);
  assert.deepEqual(s.matches.map((m) => m.id).sort(), ["forest-test", "gmw-test"]);
});

test("holes and outside points do not match; no match suggests 1.0", () => {
  assert.equal(pointInLayer(9.75, 100.05, mangrove.data), false); // inside the hole
  assert.equal(suggestEsm(9.75, 100.05, [mangrove]).esm, 1.0);
  assert.equal(suggestEsm(13.75, 100.5, [mangrove, forest]).esm, 1.0);
  assert.equal(suggestEsm(9.75, 100.05, [mangrove, forest]).esm, 1.2); // forest only
});

test("layer ESM is clamped to 1.0–1.3 and bad input is safe", () => {
  const loud: EsmLayer = { ...mangrove, meta: { ...mangrove.meta, esm: 5 } };
  assert.equal(suggestEsm(9.72, 100.02, [loud]).esm, 1.3);
  assert.equal(suggestEsm(NaN, 100, [mangrove]).esm, 1.0);
  assert.equal(pointInLayer(9.72, 100.02, { type: "FeatureCollection", features: [{ type: "Feature", geometry: null }] }), false);
});

test("no code queries WDPA / Protected Planet, IUCN Red List, KBA or IBAT", () => {
  const root = join(import.meta.dirname, "../../..");
  const banned = /protectedplanet\.net|api\.iucnredlist\.org|iucnredlist\.org\/api|keybiodiversityareas\.org\/api|ibat-alliance\.org\/api/i;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", "dist", ".git", "out", "cache"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|mjs)$/.test(name) && banned.test(readFileSync(p, "utf8"))) hits.push(p);
    }
  };
  for (const d of ["apps/web/src", "packages/impact-engine/src", "packages/pipeline/src", "packages/db/src", "apps/indexer"]) {
    try {
      walk(join(root, d));
    } catch {
      // directory absent
    }
  }
  assert.deepEqual(hits, []);
});
