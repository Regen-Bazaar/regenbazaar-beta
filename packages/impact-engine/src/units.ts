// v0.2 unit normalisation: bring an extracted quantity to the action's canonical input unit before
// scoring (t → kg, m² → ha, MWh → kWh...). A unit that cannot be converted scores 0 and is flagged,
// so "1 tonne" can no longer score as "1 kg".

// Factor to multiply the quantity by to reach the canonical unit.
const FAMILIES: Record<string, Record<string, number>> = {
  kg: { kg: 1, kgs: 1, kilogram: 1, kilograms: 1, g: 0.001, gram: 0.001, grams: 0.001, t: 1000, ton: 1000, tons: 1000, tonne: 1000, tonnes: 1000, lb: 0.45359237, lbs: 0.45359237 },
  ha: { ha: 1, hectare: 1, hectares: 1, m2: 0.0001, "m²": 0.0001, sqm: 0.0001, km2: 100, "km²": 100, acre: 0.40468564, acres: 0.40468564, rai: 0.16 },
  m2: { m2: 1, "m²": 1, sqm: 1, ha: 10_000, hectare: 10_000, hectares: 10_000 },
  liters: { l: 1, liter: 1, liters: 1, litre: 1, litres: 1, m3: 1000, "m³": 1000, gallon: 3.785411784, gallons: 3.785411784 },
  kWh: { kwh: 1, mwh: 1000, gwh: 1_000_000, wh: 0.001 },
  tCO2e: { tco2e: 1, tco2: 1, t: 1, ton: 1, tons: 1, tonne: 1, tonnes: 1, kgco2e: 0.001, kg: 0.001 },
};

// Count units accept their own name, singular form and a few synonyms.
const COUNT_SYNONYMS: Record<string, string[]> = {
  trees: ["tree", "saplings", "sapling", "seedlings", "seedling", "mangroves", "mangrove"],
  fragments: ["fragment", "corals", "coral", "colonies", "colony"],
  animals: ["animal", "dogs", "dog", "cats", "cat", "strays", "pets"],
  students: ["student", "children", "kids", "pupils", "pupil"],
  workshops: ["workshop", "sessions"],
  scholarships: ["scholarship"],
  teachers: ["teacher"],
  books: ["book", "textbooks", "textbook"],
  meals: ["meal"],
  people: ["person", "persons", "individuals", "individual"],
  loans: ["loan", "microloans", "microloan"],
  jobs: ["job", "fte"],
  families: ["family", "households", "household"],
  volunteers: ["volunteer"],
  women: ["woman"],
  events: ["event"],
  patients: ["patient"],
  vaccinations: ["vaccination", "vaccines", "vaccine", "doses", "dose"],
  kits: ["kit"],
  sessions: ["session"],
};

function key(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Convert `quantity` in `unit` to `canonical`. Returns null when the unit does not belong to the
 * canonical unit's family (for example "schools" when the action is scored in m²).
 */
export function normaliseQuantity(quantity: number, unit: string, canonical: string): number | null {
  const u = key(unit ?? "");
  const family = FAMILIES[canonical];
  if (family) {
    const f = family[u];
    return f === undefined ? null : quantity * f;
  }
  if (u === "" || u === canonical.toLowerCase()) return quantity;
  const syn = COUNT_SYNONYMS[canonical];
  return syn && syn.includes(u) ? quantity : null;
}
