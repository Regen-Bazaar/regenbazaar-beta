// ESM suggestion from open map layers (methodology v0.2). Pure: the caller loads GeoJSON extracts
// (clipped to pilot regions) and passes them in. The result is a SUGGESTION for the validator, who
// confirms the ESM; the submitter never sets it.
//
// Allowed sources (commercial use with attribution): Global Mangrove Watch, Allen Coral Atlas, RESOLVE
// Ecoregions 2017, Hansen GFC, ESA WorldCover, WRI Aqueduct, WorldPop (CC BY 4.0), OpenStreetMap own
// extract (ODbL). Not used: WDPA / Protected Planet, IUCN Red List, KBA, IBAT (commercial use forbidden).

import { ESM_MAX, ESM_MIN } from "./tables-v02.ts";

export interface EsmLayerMeta {
  id: string; // e.g. "gmw-2020"
  name: string;
  licence: "CC BY 4.0" | "ODbL";
  attribution: string;
  esm: number; // suggested ESM when the site falls inside this layer
}

type Ring = [number, number][]; // [lon, lat]
type Polygon = Ring[]; // outer ring first, then holes
export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] } | null }[];
}

export interface EsmLayer {
  meta: EsmLayerMeta;
  data: GeoJsonFeatureCollection;
}

export interface EsmSuggestion {
  esm: number;
  matches: { id: string; name: string; esm: number; attribution: string }[];
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, poly: Polygon): boolean {
  if (!poly.length || !inRing(lon, lat, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(lon, lat, poly[h])) return false;
  return true;
}

export function pointInLayer(lat: number, lon: number, data: GeoJsonFeatureCollection): boolean {
  for (const f of data?.features ?? []) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "Polygon" && inPolygon(lon, lat, g.coordinates)) return true;
    if (g.type === "MultiPolygon" && g.coordinates.some((p) => inPolygon(lon, lat, p))) return true;
  }
  return false;
}

/** Highest ESM among the layers containing the point, clamped to 1.0..1.3; 1.0 when none match. */
export function suggestEsm(lat: number, lon: number, layers: EsmLayer[]): EsmSuggestion {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { esm: ESM_MIN, matches: [] };
  const matches = layers
    .filter((l) => pointInLayer(lat, lon, l.data))
    .map((l) => ({ id: l.meta.id, name: l.meta.name, esm: Math.min(Math.max(l.meta.esm, ESM_MIN), ESM_MAX), attribution: l.meta.attribution }));
  const esm = matches.reduce((m, x) => Math.max(m, x.esm), ESM_MIN);
  return { esm, matches };
}
