// Impact Value v0.2 scoring. Pure and deterministic like v0.1: same actions + context + tables version
// give the same result. The LLM only extracts actions; it never scores.
//
//   domain score = Σ units × AW × SM × ESM × S      IV = Σ domain score × k
//
// Lines of the same action are merged before scoring, so splitting a report into lines cannot change
// the score. Proof level (P) and complexity (C) do not enter IV; they only enter the price.

import type { ImpactDomain } from "./types.ts";
import type {
  ActionBreakdownV02,
  DomainScoreV02,
  ExtractedActionV02,
  ImpactContextV02,
  IVResultV02,
  ScoreFlag,
  SourceStatus,
} from "./types-v02.ts";
import {
  ACTION_WEIGHTS_V02,
  DOMAIN_K,
  GRID_FACTORS,
  GRID_FACTOR_FALLBACK,
  MANGROVE_RATE_SHRUB,
  MANGROVE_RATE_TREE,
  MAX_ACTION_QUANTITY_V02,
  MAX_CREDITED_YEARS,
  METHODOLOGY_VERSION_V02,
  TABLES_VERSION_V02,
  WATER_DEFAULT_DEDUCTION,
  WATER_LITERS_PER_PERSON_DAY,
  areaFactor,
  clampEsm,
  type ActionWeightV02,
} from "./tables-v02.ts";
import { normaliseQuantity } from "./units.ts";

const DOMAIN_ORDER: ImpactDomain[] = ["environment", "animal_welfare", "education", "poverty", "social", "health"];
const TREE_ROWS = ["trees_planted", "mangroves_planted"];

interface Row {
  actionType: string;
  w: ActionWeightV02;
  lines: number;
  quantity: number; // input unit
  units: number; // physical scored units
  sUnits: number; // Σ units × line survival
  ha: number; // declared area behind the units (area actions)
  aw: number;
  awStatus: SourceStatus;
  awSource: string;
  zeroed: boolean;
  shrub: boolean;
  measured: boolean; // every line gave a measured survival rate
}

function num(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

function creditedYears(a: ExtractedActionV02): number {
  const y = num(a.years);
  if (y === undefined || y < 1) return 1;
  return Math.min(Math.floor(y), MAX_CREDITED_YEARS);
}

function lineSurvival(a: ExtractedActionV02, w: ActionWeightV02): number {
  const measured = num(a.survivalRate);
  if (measured !== undefined && measured >= 0 && measured <= 1) return measured;
  return w.s?.value ?? 1.0;
}

export function computeImpactValueV02(
  actions: ExtractedActionV02[],
  ctx: ImpactContextV02 = {},
): IVResultV02 {
  const flags: ScoreFlag[] = [];
  const flag = (code: ScoreFlag["code"], detail: string, actionType?: string) =>
    flags.push(actionType ? { code, actionType, detail } : { code, detail });
  const rows = new Map<string, Row>();
  const unmeasuredSurvival = new Set<string>();
  let capped = false;

  // 1. validate, normalise units, convert to physical units, merge lines of the same action
  for (const a of Array.isArray(actions) ? actions : []) {
    const w = a && typeof a.actionType === "string" ? ACTION_WEIGHTS_V02[a.actionType] : undefined;
    if (!w) {
      flag("unknown_action", "action type is not in the v0.2 table; scores 0", String(a?.actionType ?? ""));
      continue;
    }
    const q = num(a.quantity);
    if (q === undefined || q < 0) {
      flag("invalid_quantity", "quantity is not a non-negative number; scores 0", a.actionType);
      continue;
    }
    const qty = normaliseQuantity(q, a.unit, w.inputUnit);
    if (qty === null) {
      if (w.conversion === "m2") flag("needs_area", `give classroom space in m² (got "${a.unit}")`, a.actionType);
      else flag("unit_mismatch", `unit "${a.unit}" cannot be converted to ${w.inputUnit}; scores 0`, a.actionType);
      continue;
    }

    let units = qty;
    let ha = 0;
    const years = creditedYears(a);
    if (w.conversion === "trees_to_ha") {
      const area = num(a.areaHa);
      const density = num(a.densityPerHa);
      if (area !== undefined && area > 0) ha = area;
      else if (density !== undefined && density > 0) ha = qty / density;
      else flag("needs_area", "tree count without planted area or density: carbon not scored", a.actionType);
      units = ha * years;
    } else if (w.conversion === "ha_year") {
      ha = qty;
      units = ha * years;
    } else if (w.conversion === "liters_to_person_days") {
      units = (qty / WATER_LITERS_PER_PERSON_DAY.value) * WATER_DEFAULT_DEDUCTION.value;
    } else if (w.conversion === "kwh_to_tco2e") {
      const c = (ctx.country ?? "").toUpperCase();
      const f = GRID_FACTORS[c];
      if (!f) flag("needs_country", `no grid factor for "${ctx.country ?? ""}"; used the lowest listed factor`, a.actionType);
      units = qty * (f?.value ?? GRID_FACTOR_FALLBACK);
    }
    if ((w.conversion === "trees_to_ha" || w.conversion === "ha_year") && years > 1) {
      flag("multi_year_claim", `${years} monitored years claimed; validator checks monitoring evidence`, a.actionType);
    }
    const s = lineSurvival(a, w);
    const measured = num(a.survivalRate) !== undefined;
    if (w.s && !measured) unmeasuredSurvival.add(a.actionType);

    const r = rows.get(a.actionType);
    if (r) {
      r.lines += 1;
      r.quantity += qty;
      r.units += units;
      r.sUnits += units * s;
      r.ha += ha;
      r.shrub ||= a.mangroveForm === "shrub";
      r.measured &&= measured;
    } else {
      rows.set(a.actionType, {
        actionType: a.actionType, w, lines: 1, quantity: qty, units, sUnits: units * s, ha,
        aw: w.aw.value, awStatus: w.aw.status, awSource: w.aw.source, zeroed: !!w.parked,
        shrub: a.mangroveForm === "shrub", measured,
      });
    }
  }
  for (const t of unmeasuredSurvival) flag("survival_not_measured", "default survival factor used", t);

  // 2. anti-gaming clamp on the merged quantity
  for (const r of rows.values()) {
    if (r.quantity > MAX_ACTION_QUANTITY_V02) {
      const k = MAX_ACTION_QUANTITY_V02 / r.quantity;
      r.quantity = MAX_ACTION_QUANTITY_V02;
      r.units *= k;
      r.sUnits *= k;
      r.ha *= k;
      capped = true;
      flag("clamped", `quantity clamped to ${MAX_ACTION_QUANTITY_V02}`, r.actionType);
    }
  }

  // 3. mangrove rate (form), double counting and dedup rules inside one report
  const has = (t: string) => rows.has(t) && !rows.get(t)!.zeroed;
  const zero = (t: string, detail: string) => {
    const r = rows.get(t);
    if (!r || r.zeroed) return;
    r.zeroed = true;
    flag("double_count", detail, t);
  };
  const mangroves = rows.get("mangroves_planted");
  if (mangroves?.shrub) {
    mangroves.aw = MANGROVE_RATE_SHRUB.value;
    mangroves.awSource = MANGROVE_RATE_SHRUB.source;
  }

  // Actions outside the Community layer (need capital, a licence or professionals) stay in the table but score 0.
  for (const r of rows.values()) {
    if (r.w.parked) flag("out_of_scope", `not scored in the Community layer: ${r.w.parked}`, r.actionType);
  }
  // Work already registered with a carbon standard: its carbon is claimed there, so here it is evidence only.
  if (ctx.registry?.serial) {
    for (const t of [...TREE_ROWS, "hectares_restored"]) {
      if (has(t)) {
        rows.get(t)!.zeroed = true;
        flag("registry_required", "carbon of registered work is claimed in that registry; this row is evidence only", t);
      }
    }
  }
  if (has("hectares_restored")) {
    const area = rows.get("hectares_restored")!;
    const mangroveSite = has("mangroves_planted") || ctx.ecosystem === "mangrove";
    if (mangroveSite) {
      const shrub = mangroves?.shrub ?? false;
      const rate = shrub ? MANGROVE_RATE_SHRUB : MANGROVE_RATE_TREE;
      area.aw = rate.value;
      area.awStatus = rate.status;
      area.awSource = rate.source;
      if (!area.measured) {
        area.sUnits = area.units * ACTION_WEIGHTS_V02.mangroves_planted.s!.value;
        flag("survival_not_measured", "mangrove site scored by area with the default survival factor", "hectares_restored");
      }
    }
    for (const t of TREE_ROWS) zero(t, "same planting counted as area; tree count is evidence only");
  }
  // Recycled plastic adds only its carbon co-benefit on top of a collection row; alone it also carries
  // the pollution part of collected waste.
  if (has("plastic_recycled_kg") && !has("waste_collected_kg")) {
    const r = rows.get("plastic_recycled_kg")!;
    const waste = ACTION_WEIGHTS_V02.waste_collected_kg.aw;
    r.aw += waste.value;
    r.awStatus = "assumption";
    r.awSource = `${r.awSource} + pollution part ${waste.value}/kg (no separate collection row)`;
  }
  if (["students_taught", "people_trained", "teachers_trained"].some(has)) {
    zero("workshops_held", "participants are counted; workshops score 0");
  }
  if (has("meals_provided") && has("families_supported")) {
    const m = rows.get("meals_provided")!;
    const f = rows.get("families_supported")!;
    const mRaw = m.sUnits * m.aw;
    const fRaw = f.sUnits * f.aw;
    zero(mRaw >= fRaw ? "families_supported" : "meals_provided", "meals and family support for the same families: higher one kept");
  }
  if (has("patients_treated") && (has("vaccinations_administered") || has("medical_kits_distributed"))) {
    flag("review_overlap", "patients and vaccinations/kits may be the same visits; validator decides", "patients_treated");
  }
  if (rows.has("volunteers_mobilized")) {
    flag("input_not_outcome", "volunteers are an input; shown as context, score 0", "volunteers_mobilized");
  }
  if (has("wildlife_released")) {
    flag("gate_iucn", "release needs justification and post-release monitoring (IUCN/SSC 2013)", "wildlife_released");
  }

  // 4. SM (area factor on the report's total area per action), ESM, S, raw
  const esmCtx = clampEsm(ctx.esm);
  const breakdown: ActionBreakdownV02[] = [];
  const sdg = new Set<string>();
  const ebf = new Set<string>();
  const iris = new Set<string>();
  const domainRaw = new Map<ImpactDomain, number>();
  const domainPhysical = new Map<ImpactDomain, Map<string, number>>();

  for (const r of rows.values()) {
    const w = r.w;
    const sm = w.areaFactor && r.ha > 0 ? areaFactor(r.ha, ctx.adjacentToHabitat === true) : 1.0;
    const esm = w.domain === "environment" ? esmCtx : 1.0;
    const s = r.units > 0 ? r.sUnits / r.units : (w.s?.value ?? 1.0);
    const raw = r.zeroed ? 0 : r.sUnits * r.aw * sm * esm;

    let physical: { amount: number; unit: string } | undefined;
    if (!r.zeroed) {
      physical = w.carbon && w.conversion !== "none"
        ? { amount: round(r.sUnits * r.aw), unit: w.conversion === "kwh_to_tco2e" ? "tCO2e" : "tCO2e/yr" }
        : w.carbon
          ? { amount: round(r.units), unit: "tCO2e" }
          : { amount: round(r.units), unit: w.scoredUnit };
      if (w.conversion === "trees_to_ha" || w.conversion === "ha_year") {
        addPhysical(domainPhysical, w.domain, "ha", r.ha);
      }
      if (physical.amount > 0) addPhysical(domainPhysical, w.domain, physical.unit, physical.amount);
    }

    domainRaw.set(w.domain, (domainRaw.get(w.domain) ?? 0) + raw);
    if (raw > 0) {
      for (const t of w.sdg) sdg.add(t);
      for (const t of w.ebf ?? []) ebf.add(t);
      for (const t of w.iris ?? []) iris.add(t);
    }
    breakdown.push({
      actionType: r.actionType,
      domain: w.domain,
      lines: r.lines,
      quantity: round(r.quantity),
      inputUnit: w.inputUnit,
      units: round(r.units),
      scoredUnit: w.scoredUnit,
      aw: r.aw,
      awStatus: r.awStatus,
      awSource: r.awSource,
      sm,
      esm,
      s: round(s),
      raw: round(raw),
      ...(physical ? { physical } : {}),
    });
  }

  const domainScores: DomainScoreV02[] = [];
  let total = 0;
  for (const d of DOMAIN_ORDER) {
    if (!domainRaw.has(d)) continue;
    const score = domainRaw.get(d)!;
    const k = DOMAIN_K[d].value;
    total += score * k;
    const phys = domainPhysical.get(d);
    domainScores.push({
      domain: d,
      score: round(score),
      k,
      weighted: round(score * k),
      physical: phys ? [...phys].map(([unit, amount]) => ({ amount: round(amount), unit })) : [],
    });
  }
  let primaryDomain: ImpactDomain | null = null;
  for (const d of domainScores) {
    if (d.weighted > 0 && (!primaryDomain || d.weighted > domainScores.find((x) => x.domain === primaryDomain)!.weighted)) {
      primaryDomain = d.domain;
    }
  }

  return {
    methodologyVersion: METHODOLOGY_VERSION_V02,
    tablesVersion: TABLES_VERSION_V02,
    impactValue: round(total),
    domainScores,
    primaryDomain,
    breakdown,
    frameworkTags: { sdg: [...sdg].sort(), ebf: [...ebf].sort(), iris: [...iris].sort() },
    flags,
    capped,
  };
}

function addPhysical(m: Map<ImpactDomain, Map<string, number>>, d: ImpactDomain, unit: string, amount: number) {
  if (!(amount > 0)) return;
  const inner = m.get(d) ?? new Map<string, number>();
  inner.set(unit, (inner.get(unit) ?? 0) + amount);
  m.set(d, inner);
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
