// One structured LLM call for the pipeline (moderation, report extraction, proof-page facts). SERVER-ONLY.
// Order: Claude first (ANTHROPIC_API_KEY, paid from the plan's monthly API credits), then the OpenAI-compatible
// endpoint (DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL, OpenRouter in production) when Claude is
// not set, out of credit, rate-limited, down, refuses or returns nothing parseable.
// The result is untrusted: every caller passes it through its own sanitizer.
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface StructuredCall {
  system: string;
  user: string; // the data, already wrapped in the caller's tags
  name: string; // tool name for the OpenAI-compatible path
  description: string;
  schema: Record<string, unknown>; // JSON schema of the object to return
}

export interface LlmOptions {
  // Setting any field pins ONE provider (eval and tests): no fallback, no env defaults for the other one.
  provider?: "anthropic" | "openai-compatible";
  apiKey?: string;
  baseURL?: string; // openai-compatible only
  model?: string;
}

const CLAUDE_MODEL = "claude-sonnet-5-5"; // chosen by packages/pipeline/eval/extract-eval.ts, see docs/DECISIONS.md

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY);
}

type Runner = { label: string; run: (c: StructuredCall) => Promise<unknown> };

// Structured outputs need additionalProperties: false on every object.
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictSchema(v);
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

function claudeRunner(apiKey: string, model: string): Runner {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    label: `anthropic/${model}`,
    async run(c) {
      // Sonnet 5.5 rejects forced tool_choice; structured outputs return the same object as JSON text.
      const res = await client.messages.create({
        model,
        max_tokens: 4000,
        system: c.system,
        output_config: { effort: "low", format: { type: "json_schema", schema: strictSchema(c.schema) as Record<string, unknown> } },
        messages: [{ role: "user", content: c.user }],
      });
      if (res.stop_reason !== "end_turn") throw new Error(`stop_reason ${res.stop_reason}`);
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("no text block");
      return JSON.parse(text.text) as unknown;
    },
  };
}

function openaiRunner(apiKey: string | undefined, baseURL: string, model: string): Runner {
  const client = new OpenAI({ apiKey, baseURL });
  return {
    label: `${baseURL}/${model}`,
    async run(c) {
      const res = await client.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: c.system },
          { role: "user", content: c.user },
        ],
        tools: [{ type: "function", function: { name: c.name, description: c.description, parameters: c.schema } }],
        tool_choice: { type: "function", function: { name: c.name } },
      });
      const call = res.choices[0]?.message?.tool_calls?.[0];
      if (!call || call.type !== "function") throw new Error("no tool call");
      return JSON.parse(call.function.arguments) as unknown;
    },
  };
}

function runners(opts: LlmOptions): Runner[] {
  if (opts.provider === "anthropic") return [claudeRunner(opts.apiKey ?? "", opts.model ?? CLAUDE_MODEL)];
  if (opts.provider || opts.apiKey !== undefined || opts.baseURL !== undefined || opts.model !== undefined) {
    return [openaiRunner(opts.apiKey, opts.baseURL ?? "https://api.deepseek.com", opts.model ?? "deepseek-chat")];
  }
  const out: Runner[] = [];
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey) out.push(claudeRunner(claudeKey, process.env.ANTHROPIC_MODEL || CLAUDE_MODEL));
  if (process.env.DEEPSEEK_API_KEY) {
    out.push(
      openaiRunner(
        process.env.DEEPSEEK_API_KEY,
        process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      ),
    );
  }
  return out;
}

/** Runs the call on the first provider that answers; throws the last error when all fail. */
export async function callStructured(c: StructuredCall, opts: LlmOptions = {}): Promise<unknown> {
  const list = runners(opts);
  if (list.length === 0) throw new Error("no LLM provider configured");
  let last: unknown;
  for (const [i, r] of list.entries()) {
    try {
      return await r.run(c);
    } catch (e) {
      last = e;
      // Logs the provider and error only, never the submission text.
      if (i < list.length - 1) console.warn(`[llm] ${c.name} via ${r.label} failed, falling back: ${(e as Error).message?.slice(0, 200)}`);
    }
  }
  throw last;
}
