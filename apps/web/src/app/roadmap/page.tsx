import Link from "next/link";
import { DONE, EXPLORING, PHASES, ROADMAP_INTRO, type Phase } from "../../lib/roadmap";

export const metadata = { title: "Roadmap · Regen Bazaar" };

const STATUS: Record<Phase["status"], { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-green/40 text-paper" },
  now: { label: "Now", cls: "bg-gold text-ink" },
  next: { label: "Next", cls: "border border-gold/50 text-gold" },
  later: { label: "Later", cls: "border border-paper/20 text-paper/60" },
};

export default function Roadmap() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Roadmap</h1>
      <p className="mt-2 text-paper/70">{ROADMAP_INTRO}</p>

      <section className="mt-8 rounded-xl border border-green/30 bg-ink-soft/30 p-5">
        <h2 className="text-lg font-semibold">Already built</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-paper/85">
          {DONE.map((d) => (
            <li key={d.text} className="flex gap-2">
              <span className="text-green-soft">✓</span>
              <span>
                {d.text}
                {d.proof && (
                  <>
                    {" "}
                    <a href={d.proof} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                      proof
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ol className="mt-8 space-y-5">
        {PHASES.map((p, i) => (
          <li key={p.id} className="rounded-xl border border-gold/15 bg-ink-soft/30 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-paper/45">Phase {i + 1}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
              {p.grant && <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs text-gold">grant-fundable</span>}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-paper/70">{p.goal}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-paper/85">
              {p.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-md bg-ink/50 p-3 text-xs text-paper/70">
              <b className="text-paper/85">Done when:</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {p.doneWhen.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border border-gold/15 bg-ink-soft/20 p-5">
        <h2 className="text-lg font-semibold">Exploring</h2>
        <p className="mt-1 text-xs text-paper/50">Ideas we are researching, not commitments.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-paper/80">
          {EXPLORING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm text-paper/60">
        Want to help with any of this, or fund a milestone? Try the <Link href="/guide" className="text-gold underline">beta</Link>{" "}
        and tell us in our community.
      </p>
    </main>
  );
}
