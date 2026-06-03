// Price model — derive a suggested ask price from the Impact Value. IV already aggregates the impact's
// volume (SM/quantity), complexity (ACDM), and context (TBV/ESM/PIM), so price is a function of IV.
// SEED rate, not calibrated — versioned for auditability, like the IV tables. The creator may still
// override the listing price; this is the formula-suggested baseline.

export const PRICE_MODEL_VERSION = "v0-price-2026-06";

/** Suggested price units (listing currency) per 1.0 Impact Value point. SEED — calibrate later. */
export const PRICE_RATE_PER_IV = 0.5;

export interface PriceResult {
  totalPrice: number; // suggested total ask for the whole tokenized impact
  pricePerEdition: number; // totalPrice spread across editions
  impactValue: number;
  editions: number;
  rate: number;
  modelVersion: string;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** Suggested price from Impact Value and the number of fractional editions. */
export function computePrice(impactValue: number, editions = 1): PriceResult {
  const eds = editions > 0 ? editions : 1;
  const iv = Number.isFinite(impactValue) && impactValue > 0 ? impactValue : 0;
  const totalPrice = round(iv * PRICE_RATE_PER_IV);
  return {
    totalPrice,
    pricePerEdition: round(totalPrice / eds),
    impactValue: iv,
    editions: eds,
    rate: PRICE_RATE_PER_IV,
    modelVersion: PRICE_MODEL_VERSION,
  };
}
