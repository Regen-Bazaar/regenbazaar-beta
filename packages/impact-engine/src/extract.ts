// Extraction: turn an NGO's free-text submission into structured ExtractedAction[].
//
// Two implementations:
//  - ruleBasedExtract: deterministic regex/keyword fallback (no API key needed; used for tests and
//    as a fallback). Handles the broad impact spectrum.
//  - LLMExtractor: an interface for an LLM (function-calling, structured output) wired in the Next.js
//    server layer. Its output is ALWAYS validated and fed to the deterministic scorer — the LLM never
//    scores impact. User input must be sanitized before going into the prompt.

import type { ExtractedAction } from "./types.ts";

export interface LLMExtractor {
  extract(text: string): Promise<ExtractedAction[]>;
}

interface Pattern {
  actionType: string;
  unit: string;
  re: RegExp; // must capture the quantity in group 1
}

// Ordered so more specific verbs match before generic ones.
const PATTERNS: Pattern[] = [
  { actionType: "mangroves_planted", unit: "trees", re: /(\d[\d,]*)\s*mangroves?\b/gi },
  { actionType: "trees_planted", unit: "trees", re: /(\d[\d,]*)\s*(?:trees?|saplings?)\b/gi },
  { actionType: "hectares_restored", unit: "ha", re: /(\d[\d,]*)\s*(?:hectares?|ha)\b[^.]*?(?:restored|reforest|rehabilit)/gi },
  { actionType: "co2_offset_ton", unit: "tCO2e", re: /(\d[\d,]*)\s*(?:tons?|tonnes?|tco2e?)\b[^.]*?(?:co2|carbon|offset|sequester)/gi },
  { actionType: "plastic_recycled_kg", unit: "kg", re: /(\d[\d,]*)\s*kg\b[^.]*?(?:recycled)/gi },
  { actionType: "waste_collected_kg", unit: "kg", re: /(\d[\d,]*)\s*kg\b[^.]*?(?:waste|trash|garbage|plastic|litter)/gi },
  { actionType: "animals_sterilized", unit: "animals", re: /(\d[\d,]*)\s*(?:animals?|dogs?|cats?)\b[^.]*?(?:sterili[sz]ed|neutered|spayed)/gi },
  { actionType: "animals_adopted", unit: "animals", re: /(\d[\d,]*)\s*(?:animals?|dogs?|cats?|pets?)\b[^.]*?(?:adopted|rehomed)/gi },
  { actionType: "animals_treated", unit: "animals", re: /(\d[\d,]*)\s*(?:animals?|dogs?|cats?)\b[^.]*?(?:treated|vaccinat|cared)/gi },
  { actionType: "animals_rescued", unit: "animals", re: /(\d[\d,]*)\s*(?:animals?|dogs?|cats?|strays?)\b[^.]*?(?:rescued|saved|sheltered)/gi },
  { actionType: "scholarships_granted", unit: "scholarships", re: /(\d[\d,]*)\s*scholarships?\b/gi },
  { actionType: "teachers_trained", unit: "teachers", re: /(\d[\d,]*)\s*teachers?\b[^.]*?(?:trained|certified)?/gi },
  { actionType: "books_distributed", unit: "books", re: /(\d[\d,]*)\s*(?:text)?books?\b/gi },
  { actionType: "students_taught", unit: "students", re: /(\d[\d,]*)\s*(?:students?|children|kids|pupils?)\b[^.]*?(?:taught|educated|enrolled|tutored)?/gi },
  { actionType: "workshops_held", unit: "workshops", re: /(\d[\d,]*)\s*workshops?\b/gi },
  { actionType: "meals_provided", unit: "meals", re: /(\d[\d,]*)\s*meals?\b/gi },
  { actionType: "jobs_created", unit: "jobs", re: /(\d[\d,]*)\s*jobs?\b/gi },
  { actionType: "people_housed", unit: "people", re: /(\d[\d,]*)\s*(?:people|families|persons?|individuals?)\b[^.]*?(?:housed|sheltered)/gi },
  { actionType: "microloans_issued", unit: "loans", re: /(\d[\d,]*)\s*(?:micro)?loans?\b/gi },
  { actionType: "vaccinations_administered", unit: "vaccinations", re: /(\d[\d,]*)\s*(?:vaccinations?|vaccines?|immuni[sz]ations?)\b/gi },
  { actionType: "patients_treated", unit: "patients", re: /(\d[\d,]*)\s*patients?\b[^.]*?(?:treated|cared|seen)?/gi },
  { actionType: "volunteers_mobilized", unit: "volunteers", re: /(\d[\d,]*)\s*volunteers?\b/gi },
];

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** Deterministic keyword/regex extraction. Best-effort; the canonical path is the LLM extractor. */
export function ruleBasedExtract(text: string): ExtractedAction[] {
  const out: ExtractedAction[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      const quantity = toNumber(m[1]);
      if (Number.isFinite(quantity) && quantity > 0) {
        out.push({ actionType: p.actionType, quantity, unit: p.unit });
      }
    }
  }
  return out;
}
