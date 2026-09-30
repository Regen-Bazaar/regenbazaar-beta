import { writeFileSync, readFileSync } from "node:fs";
import { ACTION_WEIGHTS_V02 } from "../src/tables-v02.ts";
import { ACTION_WEIGHTS } from "../src/tables.ts";
import { CARDS_V02 as CARDS } from "../src/cards-v02.ts";

// Regenerates docs/methodology/cards/*.md, cards/README.md and five-dimensions-rubric.md from the engine.
//   node --experimental-strip-types scripts/sensitivity.ts > ../../docs/methodology/sensitivity.md
//   node --experimental-strip-types scripts/render-cards.ts
const out = new URL("../../../docs/methodology", import.meta.url).pathname;
const statusLabel = { sourced: "sourced", derived: "derived (our arithmetic on a cited table)", assumption: "assumption (needs check)" };
const sens = new Map<string, string>();
for (const line of readFileSync(out + "/sensitivity.md", "utf8").split("\n")) {
  const m = line.match(/^\| (\w+) \| [\d.]+ \| \w+ \| (\d+) \| (\d+) \| (\w+) \|$/);
  if (m) sens.set(m[1], `${m[4]} (ranking moves at −50%: ${m[2]}, at +50%: ${m[3]})`);
}

// Five Dimensions rubric: implied weight within a domain ∝ depth × duration × vulnerability.
const byDomain = new Map<string, string[]>();
for (const [k, w] of Object.entries(ACTION_WEIGHTS_V02)) {
  if (!CARDS[k].rubric || w.parked) continue;
  byDomain.set(w.domain, [...(byDomain.get(w.domain) ?? []), k]);
}
const implied = new Map<string, number>();
for (const keys of byDomain.values()) {
  const prod = (k: string) => CARDS[k].rubric!.reduce((a, b) => a * b, 1);
  const sumP = keys.reduce((s, k) => s + prod(k), 0);
  const sumW = keys.reduce((s, k) => s + ACTION_WEIGHTS_V02[k].aw.value, 0);
  for (const k of keys) implied.set(k, Math.round((prod(k) / sumP) * sumW * 1000) / 1000);
}

const index: string[] = [];
const rubricRows: string[] = [];
for (const [k, w] of Object.entries(ACTION_WEIGHTS_V02)) {
  const c = CARDS[k];
  if (!c) throw new Error("missing card " + k);
  const v1 = ACTION_WEIGHTS[k];
  const r = c.rubric;
  const imp = implied.get(k);
  const ratio = imp !== undefined && w.aw.value > 0 ? imp / w.aw.value : undefined;
  const md = [
    `# ${c.title} (\`${k}\`)`,
    "",
    `Methodology v0.2, Community layer. Domain: ${w.domain.replace("_", " ")}. Part of Regen Bazaar's own relative index; not a certification.`,
    ...(w.parked ? ["", `**Parked:** ${w.parked}. Kept in the table; scores 0 in the Community layer.`] : []),
    "",
    "| Field | Value |",
    "|---|---|",
    `| Definition and unit | ${c.definition} |`,
    `| Input unit / scored unit | ${w.inputUnit} / ${w.scoredUnit} |`,
    `| What the weight represents | ${c.represents} |`,
    `| Weight (points per ${w.scoredUnit}) | ${w.aw.value} |`,
    `| Anchor | ${c.anchor} |`,
    `| Calculation | ${c.calc} |`,
    `| Status | ${statusLabel[w.aw.status]}. Source: ${w.aw.source} |`,
    ...(w.s ? [`| Survival factor S | ${w.s.value}, ${statusLabel[w.s.status]}. Source: ${w.s.source} |`] : []),
    `| Multipliers | SM (area factor): ${w.areaFactor ? "yes" : "no, 1.0"}. ESM: ${w.domain === "environment" ? "yes, 1.0–1.3" : "no, 1.0"}. Domain coefficient k: 1.0, platform value |`,
    `| Sensitivity (±50%) | ${sens.get(k) ?? "not in the sample set"} |`,
    ...(r && !w.parked ? [`| Five Dimensions rubric | depth ${r[0]}, duration ${r[1]}, vulnerability ${r[2]} → product ${r[0] * r[1] * r[2]}; rubric-implied weight ${imp} (${ratio!.toFixed(2)}× current) |`] : []),
    `| Proof that fits | ${c.evidence} |`,
    `| SDG tags (contributes to) | ${w.sdg.join(", ")} |`,
    ...(w.iris ? [`| IRIS+ metric IDs (definitions, cited with attribution to the GIIN) | ${w.iris.join(", ")} |`] : []),
    `| v0.1 value | ${v1.aw} per ${v1.unit} |`,
    "",
    "## Open questions for experts",
    "",
    ...c.questions.map((q) => `- ${q}`),
    "",
  ].join("\n");
  writeFileSync(`${out}/cards/${k}.md`, md);
  index.push(`| [${c.title}](${k}.md) | ${w.domain.replace("_", " ")} | ${w.aw.value} per ${w.scoredUnit} | ${w.parked ? "parked" : w.aw.status} |`);
  if (r && !w.parked) rubricRows.push(`| ${k} | ${w.domain.replace("_", " ")} | ${r.join(" × ")} = ${r[0] * r[1] * r[2]} | ${w.aw.value} | ${imp} | ${ratio!.toFixed(2)}× |`);
}

writeFileSync(out + "/cards/README.md", [
  "# Weight justification cards (v0.2)",
  "",
  "One card per action: definition and unit, what the weight represents, anchor, calculation, source status,",
  "sensitivity, proof that fits, open questions. Numbers match `packages/impact-engine/src/tables-v02.ts`.",
  "",
  "| Action | Domain | Weight | Status |",
  "|---|---|---|---|",
  ...index,
  "",
].join("\n"));

writeFileSync(out + "/five-dimensions-rubric.md", [
  "# Five Dimensions rubric for weights without a source",
  "",
  "For actions with no public value source, each unit is scored 1–3 on three questions drawn from the Impact",
  "Management Project's Five Dimensions (what, how much, who):",
  "",
  "- **Depth**: how much one unit changes the outcome (1 small, 2 moderate, 3 large).",
  "- **Duration**: how long the change lasts (1 days to weeks, 2 months, 3 years or permanent).",
  "- **Vulnerability**: how underserved the beneficiaries are (1 general, 2 moderate need, 3 high need).",
  "",
  "Within a domain, the rubric-implied weight is proportional to depth × duration × vulnerability, scaled so",
  "the domain's total equals the current total. The table compares it with the current weight.",
  "",
  "**Status: proposal for review.** The scores are the platform's first judgement. v0.2 tables keep the v0.1",
  "weights until the owner and the expert round confirm the scores, because units inside a",
  "domain differ in size (a meal and a job are both \"one unit\"), which the rubric alone cannot correct.",
  "Rows at more than 2× or under 0.5× the current weight go to experts first.",
  "",
  "| Action | Domain | Depth × duration × vulnerability | Current weight | Rubric-implied | Ratio |",
  "|---|---|---|---|---|---|",
  ...rubricRows,
  "",
].join("\n"));
console.log("cards:", index.length);
