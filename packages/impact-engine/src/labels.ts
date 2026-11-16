// Human labels for extracted actions. An action type often names its unit already ("waste_collected_kg",
// "volunteers_mobilized"), so "<qty> <unit> <action type>" printed the unit twice ("25 volunteers volunteers
// mobilized"). Always render as "<Label>: <qty> <unit>".

const UNIT_SUFFIX = /_(kg|kwh|liters|ton|people)$/;

/** "waste_collected_kg" -> "Waste collected", "co2_offset_ton" -> "CO2 offset". */
export function actionLabel(actionType: string): string {
  const s = actionType.replace(UNIT_SUFFIX, "").replace(/_/g, " ").replace(/\bco2\b/gi, "CO2");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ActionPhraseInput {
  actionType: string;
  quantity: number;
  unit?: string;
  areaHa?: number;
  survivalRate?: number;
}

/** "Mangroves planted: 1,500 seedlings on 0.6 ha, 80% survived". */
export function actionPhrase(a: ActionPhraseInput, fmtNum: (n: number) => string = (n) => n.toLocaleString("en-US")): string {
  const qty = `${fmtNum(a.quantity)}${a.unit ? ` ${a.unit}` : ""}`;
  const area = a.areaHa ? ` on ${a.areaHa} ha` : "";
  const surv = a.survivalRate !== undefined ? `, ${Math.round(a.survivalRate * 100)}% survived` : "";
  return `${actionLabel(a.actionType)}: ${qty}${area}${surv}`;
}
