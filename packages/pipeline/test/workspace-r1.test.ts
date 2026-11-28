// Release 1 of the validator workspace: AI run log, which reader answered, honest AI-reading source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createTestDb } from "@rb/db/testing";
import * as schema from "@rb/db/schema";
import {
  checkProofLink,
  processSubmission,
  type LlmRunRecord,
  type PageReading,
} from "../src/index.ts";
import { callStructured } from "../src/llm.ts";

const CALL = {
  job: "extract_actions",
  instructionVersion: "extract-v1",
  system: "s",
  user: "<ngo_report>SECRET CREATOR TEXT</ngo_report>",
  name: "n",
  description: "d",
  schema: { type: "object", properties: {} },
};

async function fakeProvider(handler: (n: number) => { status: number; body: unknown }) {
  let n = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const r = handler(++n);
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, close: () => server.close() };
}

test("run log: a good call writes one line with provider, model, instruction version, tokens and output", async () => {
  const p = await fakeProvider(() => ({
    status: 200,
    body: {
      id: "x", object: "chat.completion", created: 1, model: "m1",
      choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "c", type: "function", function: { name: "n", arguments: '{"actions":[]}' } }] } }],
      usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 },
    },
  }));
  const runs: LlmRunRecord[] = [];
  try {
    await callStructured(CALL, { provider: "openai-compatible", apiKey: "k", baseURL: p.url, model: "m1", onRun: (r) => runs.push(r) });
  } finally {
    p.close();
  }
  assert.equal(runs.length, 1);
  assert.deepEqual({ job: runs[0].job, provider: runs[0].provider, model: runs[0].model, v: runs[0].instructionVersion, i: runs[0].inputTokens, o: runs[0].outputTokens, ok: runs[0].ok }, { job: "extract_actions", provider: "openai-compatible", model: "m1", v: "extract-v1", i: 11, o: 3, ok: true });
  assert.deepEqual(runs[0].output, { actions: [] });
  assert.ok(!JSON.stringify(runs[0]).includes("SECRET CREATOR TEXT"), "the creator's text is never in the run line");
});

test("run log: a failed call writes a line with the error and no creator text", async () => {
  const p = await fakeProvider(() => ({ status: 400, body: { error: { message: "bad request" } } }));
  const runs: LlmRunRecord[] = [];
  const warn = console.warn;
  const logged: string[] = [];
  console.warn = (...a: unknown[]) => logged.push(a.join(" "));
  try {
    await assert.rejects(callStructured(CALL, { provider: "openai-compatible", apiKey: "k", baseURL: p.url, model: "m1", onRun: (r) => runs.push(r) }));
  } finally {
    p.close();
    console.warn = warn;
  }
  assert.equal(runs.length, 1);
  assert.equal(runs[0].ok, false);
  assert.ok(runs[0].error && runs[0].error.length > 0);
  assert.equal(runs[0].output, null);
  assert.ok(!JSON.stringify(runs[0]).includes("SECRET CREATOR TEXT"));
  assert.ok(!logged.join("\n").includes("SECRET CREATOR TEXT"), "the server log never has the creator's text");
});

test("a run recorder that throws never breaks the call", async () => {
  const p = await fakeProvider(() => ({
    status: 200,
    body: {
      id: "x", object: "chat.completion", created: 1, model: "m1",
      choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{ id: "c", type: "function", function: { name: "n", arguments: '{"ok":true}' } }] } }],
    },
  }));
  try {
    const out = await callStructured(CALL, { provider: "openai-compatible", apiKey: "k", baseURL: p.url, model: "m1", onRun: () => { throw new Error("db down"); } });
    assert.deepEqual(out, { ok: true });
  } finally {
    p.close();
  }
});

const page = (html: string) => ({ url: "u", finalUrl: "u", status: 200, contentType: "text/html", bytes: Buffer.from(html), truncated: false });
const CLAIM = { actions: [{ actionType: "waste_collected_kg", quantity: 380, unit: "kg" }], periodStart: "2026-06-01", periodEnd: "2026-06-30", placeNames: [] };

test("proof check reports which reader answered: AI, or pattern matching when the AI fails", async () => {
  const seen: PageReading[] = [];
  const html = "<p>We collected 380 kg of plastic on 2026-06-10</p>";
  await checkProofLink("https://x.org/p", CLAIM, {
    fetcher: async () => page(html),
    factExtractor: { extractFacts: async () => ({ dates: [], numbers: [], places: ["Koh Phangan"] }) },
    onPage: (p) => seen.push(p),
  });
  await checkProofLink("https://x.org/p", CLAIM, {
    fetcher: async () => page(html),
    factExtractor: { extractFacts: async () => { throw new Error("down"); } },
    onPage: (p) => seen.push(p),
  });
  assert.deepEqual(seen.map((s) => s.reader), ["ai", "pattern"]);
  assert.ok(seen[0].text.includes("380 kg"));
});

test("a media link is fetched for its fingerprint only: no page reading is reported", async () => {
  const seen: PageReading[] = [];
  const r = await checkProofLink("https://x.org/a.jpg", CLAIM, {
    fetcher: async () => ({ ...page("jpeg-bytes"), contentType: "image/jpeg" }),
    onPage: (p) => seen.push(p),
  });
  assert.ok(r.sha256);
  assert.equal(seen.length, 0);
});

test("the stored AI-reading source tells the truth: ai, fallback after an error, fallback after an empty answer", async () => {
  const { db } = await createTestDb();
  const [o] = await db.insert(schema.organizations).values({ walletAddress: "0x0000000000000000000000000000000000c0ffee", name: "O", slug: "o-r1" }).returning();
  const base = { orgId: o.id, title: "t", description: "We collected 380 kg of plastic waste", declaredActions: [{ actionType: "waste_collected_kg", quantity: 380, unit: "kg" }] };
  const good = await processSubmission(db, base, { extractor: { extract: async () => [{ actionType: "waste_collected_kg", quantity: 380, unit: "kg" }] } });
  const bad = await processSubmission(db, base, { extractor: { extract: async () => { throw new Error("x"); } } });
  const empty = await processSubmission(db, base, { extractor: { extract: async () => [] } });
  const none = await processSubmission(db, base);
  const src = (s: { submission: { context: unknown } }) => (s.submission.context as { aiRead?: string }).aiRead;
  assert.deepEqual([src(good), src(bad), src(empty), src(none)], ["ai", "fallback_error", "fallback_empty", "not_configured"]);
});
