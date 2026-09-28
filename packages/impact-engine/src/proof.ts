// Proof layer (community dMRV). The proof level is set by a human validator; AI checks only produce
// flags. P never changes IV: it enters the price and decides whether a report can be listed.

export type ProofLevel = "P0" | "P1" | "P2" | "P3" | "P4";
export const PROOF_LEVELS: readonly ProofLevel[] = ["P0", "P1", "P2", "P3", "P4"];

/** Price factor per level. Pilot hypothesis, needs checking. P0 is never listed. */
export const PROOF_FACTORS: Record<ProofLevel, number> = { P0: 0, P1: 0.6, P2: 0.8, P3: 0.9, P4: 1.0 };

export const PROOF_REQUIREMENTS: Record<ProofLevel, string> = {
  P0: "text only",
  P1: "at least one public link within the period that matches the claim",
  P2: "photo or video with date and place (EXIF), or at least two independent public traces; clean AI flags",
  P3: "a second party confirms (partner, local authority, community validator), or 3+ earlier verified reports",
  P4: "third-party measurement, instrument, government or standard registry record",
};

export const MIN_LISTABLE_LEVEL: ProofLevel = "P1";

export function parseProofLevel(x: unknown): ProofLevel | null {
  return typeof x === "string" && (PROOF_LEVELS as readonly string[]).includes(x) ? (x as ProofLevel) : null;
}

export function proofFactor(level: ProofLevel): number {
  return PROOF_FACTORS[level];
}

export function isListable(level: ProofLevel | null | undefined): boolean {
  return !!level && PROOF_LEVELS.indexOf(level) >= PROOF_LEVELS.indexOf(MIN_LISTABLE_LEVEL);
}

/** Flags an AI check may raise about a proof link. Flags inform the validator; they never set a level. */
export type ProofFlagCode =
  | "date_in_period"
  | "date_out_of_period"
  | "date_not_found"
  | "numbers_match"
  | "numbers_mismatch"
  | "numbers_not_found"
  | "place_match"
  | "place_mismatch"
  | "duplicate_media"
  | "unreachable";

export interface ProofFlag {
  code: ProofFlagCode;
  severity: "ok" | "warn" | "fail";
  detail: string;
}
