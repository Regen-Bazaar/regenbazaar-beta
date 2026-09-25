import Link from "next/link";
import { DONE, EXPLORING, HISTORY, PHASES, ROADMAP_INTRO, type Phase } from "../../lib/roadmap";

export const metadata = { title: "Roadmap · Regen Bazaar" };

const STATUS: Record<Phase["status"], { label: string; cls: string }> = {
  done: { label: "Done", cls: "badge-ok" },
  now: { label: "Now", cls: "badge-gold" },
  next: { label: "Next", cls: "border border-line-strong text-accent" },
  later: { label: "Later", cls: "badge-muted" },
};

export default function Roadmap() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Roadmap</h1>
      <p className="mt-2 text-muted">{ROADMAP_INTRO}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Journey so far</h2>
        <ol className="mt-3 border-l border-line pl-5">
          {HISTORY.map((h) => (
            <li key={h.when} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
              <p className="text-xs uppercase tracking-wide text-accent">{h.when}</p>
              <p className="text-sm text-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-xl border border-ok/40 bg-surface p-5">
        <h2 className="text-lg font-semibold">Already built</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          {DONE.map((d) => (
            <li key={d.text} className="flex gap-2">
              <span className="text-ok">✓</span>
              <span>
                {d.text}
                {d.proof && (
                  <>
                    {" "}
                    <a href={d.proof} target="_blank" rel="noopener noreferrer" className="text-accent underline">
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
          <li key={p.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-subtle">Phase {i + 1}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
              {p.grant && <span className="badge badge-gold">grant-fundable</span>}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.goal}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {p.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="mt-3 rounded-md bg-raised p-3 text-xs text-muted">
              <b className="text-muted">Done when:</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {p.doneWhen.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Exploring</h2>
        <p className="mt-1 text-xs text-subtle">Ideas we are researching, not commitments.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {EXPLORING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm text-subtle">
        Want to help with any of this, or fund a milestone? Try the <Link href="/guide" className="text-accent underline">beta</Link>{" "}
        and tell us in our community.
      </p>
    </main>
  );
}
