// Single entry point: score with a named methodology version. v0.1 stays available so reports stamped
// v0.1 keep recomputing exactly as they were scored.

import { computeImpactValue } from "./score.ts";
import { computeImpactValueV02 } from "./score-v02.ts";
import type { ImpactContext, IVResult } from "./types.ts";
import type { ExtractedActionV02, ImpactContextV02, IVResultV02 } from "./types-v02.ts";

export type MethodologyVersion = "v0.1" | "v0.2";
export const DEFAULT_METHODOLOGY_VERSION: MethodologyVersion = "v0.2";

export type ScoreResult =
  | { version: "v0.1"; result: IVResult }
  | { version: "v0.2"; result: IVResultV02 };

export function scoreImpact(
  actions: ExtractedActionV02[],
  ctx: ImpactContext & ImpactContextV02 = {},
  version: MethodologyVersion = DEFAULT_METHODOLOGY_VERSION,
): ScoreResult {
  if (version === "v0.1") return { version, result: computeImpactValue(actions, ctx) };
  return { version: "v0.2", result: computeImpactValueV02(actions, ctx) };
}
