// Declared cost of the work (owner, 2026-10-01): the group states what the work took (volunteer hours at its own
// hourly value, and money spent); proof and a validator check it. Cost is NOT the price: it only raises the price of
// the impact through the cost coefficient E (price-v02.ts). The country's statutory minimum hourly wage is shown to
// the validator as a reference frame only; nothing is capped or rejected automatically.

import type { SourcedValue } from "./types-v02.ts";

export const COST_CATEGORIES = ["materials", "transport", "equipment", "food", "services", "other"] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export interface CostDeclaration {
  currency: string; // ISO 4217 code of all amounts below
  volunteerHours: number; // people × hours
  hourlyValue: number; // value of one volunteer hour, declared by the group, in `currency`
  spent: Partial<Record<CostCategory, number>>; // money spent, in `currency`
}

/** USD per one unit of a currency. Filled from a dated, cited source; see FX_AS_OF. */
export const FX_USD: Record<string, SourcedValue> = {
  USD: { value: 1, status: "sourced", source: "definition" },
  THB: { value: 0.0299256945, status: "sourced", source: "1 USD = 33.4161 THB, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  VND: { value: 3.855562903e-05, status: "sourced", source: "1 USD = 25936.55 VND, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  IDR: { value: 5.580033302e-05, status: "sourced", source: "1 USD = 17921.04 IDR, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  PHP: { value: 0.01601283589, status: "sourced", source: "1 USD = 62.4499 PHP, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  MYR: { value: 0.2454349107, status: "sourced", source: "1 USD = 4.0744 MYR, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  KHR: { value: 0.0002469800514, status: "sourced", source: "1 USD = 4048.91 KHR, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  LAK: { value: 4.494586046e-05, status: "sourced", source: "1 USD = 22248.99 LAK, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  INR: { value: 0.0104244959, status: "sourced", source: "1 USD = 95.9279 INR, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  RUB: { value: 0.01187761307, status: "sourced", source: "1 USD = 84.192 RUB, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
  EUR: { value: 1.138490544, status: "sourced", source: "1 USD = 0.878356 EUR, open.er-api.com 2026-09-28; THB, IDR, PHP, MYR, INR within 0.3% of ECB 2026-09-25" },
};
export const FX_AS_OF = "2026-09-28";

/** Statutory minimum hourly wage by country (local currency), the validator's reference frame. */
export interface WageReference {
  hourly: number;
  currency: string;
  basis: string; // how the hourly figure was derived
  source: string;
  effective: string;
}
// Lowest statutory rate where it varies by region; see docs/methodology/minimum-wages.md. Checked 2026-09-28.
export const MIN_WAGE_REFERENCE: Record<string, WageReference> = {
  TH: { hourly: 42.13, currency: "THB", basis: "337 THB/day (lowest band) ÷ 8 h", source: "Wage Committee Notification No.14, mol.go.th", effective: "2025-07-01" },
  VN: { hourly: 17800, currency: "VND", basis: "Region IV hourly rate in the decree", source: "Decree 293/2025/ND-CP (via Baker McKenzie, Vietnam Briefing)", effective: "2026-01-01" },
  ID: { hourly: 13397, currency: "IDR", basis: "lowest provincial UMP 2,317,601 IDR/month ÷ 173 h", source: "UMP 2026 Jawa Barat (secondary: Pajakku, Fortune IDN)", effective: "2026-01-01" },
  PH: { hourly: 51.38, currency: "PHP", basis: "411 PHP/day (lowest non-agriculture, BARMM) ÷ 8 h", source: "Wage Order BARMM-05, nwpc.dole.gov.ph", effective: "2026-08-06" },
  MY: { hourly: 8.72, currency: "MYR", basis: "hourly rate in the order (1,700 MYR/month)", source: "Minimum Wages Order P.U.(A) 376/2024", effective: "2025-02-01" },
  KH: { hourly: 1.01, currency: "USD", basis: "210 USD/month ÷ 208 h; garment sector only, no general minimum wage", source: "Prakas 214/25 (via Andersen, WageIndicator)", effective: "2026-01-01" },
  LA: { hourly: 12019, currency: "LAK", basis: "2,500,000 LAK/month ÷ 208 h; a 2026 raise was under review, not confirmed", source: "kpl.gov.la", effective: "2024-10-01" },
  IN: { hourly: 22.25, currency: "INR", basis: "advisory national floor 178 INR/day ÷ 8 h; binding rates are set by states; not verified officially", source: "secondary sources only", effective: "2019" },
  RU: { hourly: 164.87, currency: "RUB", basis: "MROT 27,093 RUB/month ÷ 164.33 h (2026 norm 1,972 h/yr)", source: "Federal Law 429-FZ, consultant.ru", effective: "2026-01-01" },
  US: { hourly: 7.25, currency: "USD", basis: "federal hourly rate; many states set higher", source: "dol.gov", effective: "2009-07-24" },
};

export const MAX_DECLARED = 10_000_000; // per amount, in local currency units; sanity bound only

export interface CostInUsd {
  labourUsd: number;
  spentUsd: number;
  totalUsd: number;
  fxRate: number;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
const amount = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.min(x, MAX_DECLARED) : 0);

/** Null when the currency has no rate. */
export function costToUsd(c: CostDeclaration): CostInUsd | null {
  const fx = FX_USD[(c.currency ?? "").toUpperCase()];
  if (!fx) return null;
  const labour = amount(c.volunteerHours) * amount(c.hourlyValue);
  const spent = COST_CATEGORIES.reduce((s, k) => s + amount(c.spent?.[k]), 0);
  return {
    labourUsd: round(labour * fx.value),
    spentUsd: round(spent * fx.value),
    totalUsd: round((labour + spent) * fx.value),
    fxRate: fx.value,
  };
}

export interface LabourCheck {
  declaredHourly: number;
  currency: string;
  reference: WageReference | null;
  ratio: number | null; // declared ÷ minimum, same currency (converted through USD when they differ)
  note: string;
}

/** Declared hourly value against the country's minimum wage. Information for the validator only. */
export function labourCheck(c: CostDeclaration, country?: string): LabourCheck {
  const ref = country ? (MIN_WAGE_REFERENCE[country.toUpperCase()] ?? null) : null;
  const declared = amount(c.hourlyValue);
  const cur = (c.currency ?? "").toUpperCase();
  if (!ref) return { declaredHourly: declared, currency: cur, reference: null, ratio: null, note: "no minimum wage reference for this country" };
  let refInDeclared = ref.currency === cur ? ref.hourly : null;
  if (refInDeclared === null && FX_USD[ref.currency] && FX_USD[cur]) {
    refInDeclared = (ref.hourly * FX_USD[ref.currency].value) / FX_USD[cur].value;
  }
  if (refInDeclared === null || refInDeclared <= 0) {
    return { declaredHourly: declared, currency: cur, reference: ref, ratio: null, note: "currencies cannot be compared" };
  }
  const ratio = round(declared / refInDeclared, 2);
  const note =
    declared === 0 ? "volunteer time not valued" : ratio > 3 ? "well above the minimum wage: ask how it was set" : ratio < 1 ? "below the minimum wage" : "within the usual range";
  return { declaredHourly: declared, currency: cur, reference: ref, ratio, note };
}
