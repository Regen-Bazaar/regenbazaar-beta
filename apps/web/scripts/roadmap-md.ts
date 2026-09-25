// Renders docs/ROADMAP.md from src/lib/roadmap.ts (the single source).  node --import tsx scripts/roadmap-md.ts
import { writeFileSync } from "node:fs";
import { DONE, EXPLORING, PHASES, ROADMAP_INTRO } from "../src/lib/roadmap.ts";

const L: string[] = ["# Regen Bazaar roadmap", "", ROADMAP_INTRO, "", "Also on the site: https://app.regenbazaar.com/roadmap", "", "## Already built", ""];
for (const d of DONE) L.push(`- ${d.text}${d.proof ? ` ([proof](${d.proof}))` : ""}`);
PHASES.forEach((p, i) => {
  L.push("", `## Phase ${i + 1}: ${p.title} (${p.status}${p.grant ? ", grant-fundable" : ""})`, "", `**Goal:** ${p.goal}`, "");
  for (const t of p.items) L.push(`- ${t}`);
  L.push("", "**Done when:**", "");
  for (const t of p.doneWhen) L.push(`- ${t}`);
});
L.push("", "## Exploring (not commitments)", "");
for (const t of EXPLORING) L.push(`- ${t}`);
L.push("", "_Generated from `apps/web/src/lib/roadmap.ts`; edit there._", "");
writeFileSync(new URL("../../../docs/ROADMAP.md", import.meta.url), L.join("\n"));
console.log("docs/ROADMAP.md written");
