// AI run log: collects the lines the pipeline reports during one request and writes them to ai_runs afterwards.
// A failing write never breaks the request. Input text is never stored here; only the model's output.
import { aiRuns } from "@rb/db/schema";
import type { DB } from "@rb/db";
import type { LlmRunRecord } from "@rb/pipeline";

const MAX_OUTPUT_CHARS = 20_000;

function clip(output: unknown): unknown {
  if (output === null || output === undefined) return null;
  try {
    const s = JSON.stringify(output);
    return s.length <= MAX_OUTPUT_CHARS ? output : { truncated: true, head: s.slice(0, MAX_OUTPUT_CHARS) };
  } catch {
    return null;
  }
}

export function createRunRecorder() {
  const runs: LlmRunRecord[] = [];
  return {
    onRun: (r: LlmRunRecord) => {
      runs.push(r);
    },
    get count() {
      return runs.length;
    },
    /** Writes the collected lines. submissionId is null when there is no report (e.g. refused at moderation). */
    async flush(db: DB, submissionId: string | null): Promise<void> {
      const batch = runs.splice(0, runs.length);
      if (!batch.length) return;
      try {
        await db.insert(aiRuns).values(
          batch.map((r) => ({
            submissionId,
            job: r.job.slice(0, 30),
            provider: r.provider,
            model: r.model.slice(0, 120),
            instructionVersion: r.instructionVersion.slice(0, 30),
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            durationMs: r.durationMs,
            ok: r.ok,
            error: r.error ? r.error.slice(0, 500) : null,
            output: clip(r.output),
          })),
        );
      } catch (e) {
        console.error("ai_runs write failed", e instanceof Error ? e.message : e);
      }
    },
  };
}
