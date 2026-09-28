import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTION_WEIGHTS, ACTION_WEIGHTS_V02, CARDS_V02 } from "@rb/impact-engine";
import { DOMAIN_LABEL } from "../../../../lib/impact-view";

const STATUS: Record<string, string> = {
  sourced: "sourced",
  derived: "derived (our arithmetic on a cited table)",
  assumption: "assumption (needs checking)",
};

export function generateStaticParams() {
  return Object.keys(ACTION_WEIGHTS_V02).map((action) => ({ action }));
}

export async function generateMetadata({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const c = Object.hasOwn(CARDS_V02, action) ? CARDS_V02[action] : undefined;
  return { title: c ? `${c.title}: weight card` : "Weight card" };
}

// One justification card per action (methodology v0.2). Numbers come from the engine tables.
export default async function Card({ params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!Object.hasOwn(ACTION_WEIGHTS_V02, action)) notFound();
  const w = ACTION_WEIGHTS_V02[action];
  const c = CARDS_V02[action];
  const v1 = ACTION_WEIGHTS[action];
  const rows: [string, React.ReactNode][] = [
    ["Definition and unit", c.definition],
    ["Scored unit", `${w.scoredUnit} (input: ${w.inputUnit})`],
    ["What the weight represents", c.represents],
    ["Weight", <span key="w" className="font-mono text-accent">{w.aw.value} per {w.scoredUnit}</span>],
    ["Anchor", c.anchor],
    ["Calculation", c.calc],
    ["Status", `${STATUS[w.aw.status]}. Source: ${w.aw.source}`],
    ...(w.s ? ([["Survival factor S", `${w.s.value}, ${STATUS[w.s.status]}. Source: ${w.s.source}`]] as [string, string][]) : []),
    [
      "Multipliers",
      `SM (area factor): ${w.areaFactor ? "yes" : "no, 1.0"}. ESM: ${w.domain === "environment" ? "1.0 to 1.3, confirmed by a validator" : "no, 1.0"}. Domain coefficient k: 1.0, pending cost survey.`,
    ],
    ...(c.rubric
      ? ([["Five Dimensions rubric", `depth ${c.rubric[0]}, duration ${c.rubric[1]}, vulnerability ${c.rubric[2]} (1 to 3 each; proposal for review)`]] as [string, string][])
      : []),
    ["Proof that fits", c.evidence],
    ["SDG (contributes to)", w.sdg.join(", ")],
    ...(w.iris ? ([["IRIS+ metric IDs", `${w.iris.join(", ")} (IRIS+ by the GIIN)`]] as [string, string][]) : []),
    ["v0.1 value", `${v1.aw} per ${v1.unit}`],
  ];

  return (
    <main className="page-wrap py-10 md:py-14">
      <Link href="/methodology#aw" className="text-muted hover:text-accent">
        ← Methodology
      </Link>
      <div className="mt-5 label-mono">{DOMAIN_LABEL[w.domain]} · weight card · v0.2</div>
      <h1 className="mt-2 text-[clamp(2.25rem,4vw,3.25rem)]">{c.title}</h1>
      <p className="mt-2 font-mono text-sm text-subtle">{action}</p>
      <div className="mt-8 max-w-[80ch] overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-line align-top last:border-0">
                <th scope="row" className="w-[34%] px-4 py-3 text-left font-semibold text-fg">
                  {k}
                </th>
                <td className="px-4 py-3 leading-relaxed text-muted">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 text-2xl">Open questions for experts</h2>
      <ul className="mt-3 ml-5 max-w-[80ch] list-disc space-y-1 text-muted">
        {c.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <p className="mt-8 max-w-[80ch] text-sm text-subtle">
        Part of Regen Bazaar&apos;s own relative index (methodology v0.2, Community layer); not a certification.
      </p>
    </main>
  );
}
