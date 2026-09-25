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
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Roadmap</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">{ROADMAP_INTRO}</p>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-16">
      <div className="space-y-8 lg:sticky lg:top-24">
      <section>
        <h2 className="text-2xl">Journey so far</h2>
        <ol className="mt-4 border-l border-line pl-6">
          {HISTORY.map((h) => (
            <li key={h.when} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[30px] top-1 h-2.5 w-2.5 rounded-full bg-gold" />
              <p className="label-mono !text-accent">{h.when}</p>
              <p className="mt-1 text-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card !border-ok/40 p-6">
        <h2 className="text-2xl">Already built</h2>
        <ul className="mt-4 space-y-2 text-muted">
          {DONE.map((d) => (
            <li key={d.text} className="flex gap-2">
              <span className="text-ok">✓</span>
              <span>
                {d.text}
                {d.proof && (
                  <>
                    {" "}
                    <a href={d.proof} target="_blank" rel="noopener noreferrer" className="link">
                      proof
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      <div>
      <ol className="space-y-5">
        {PHASES.map((p, i) => (
          <li key={p.id} className="card p-6 md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-mono">Phase {i + 1}</span>
              <span className={`badge ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
              {p.grant && <span className="badge badge-gold">grant-fundable</span>}
            </div>
            <h2 className="mt-3 text-[1.75rem]">{p.title}</h2>
            <p className="mt-2 text-lg text-muted">{p.goal}</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-muted marker:text-accent">
              {p.items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl bg-raised p-4 text-sm text-muted">
              <b className="text-fg">Done when:</b>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {p.doneWhen.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>

      <section className="card mt-5 p-6">
        <h2 className="text-2xl">Exploring</h2>
        <p className="mt-1 text-sm text-subtle">Ideas we are researching, not commitments.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
          {EXPLORING.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-subtle">
        Want to help with any of this, or fund a milestone? Try the <Link href="/guide" className="link">beta</Link>{" "}
        and tell us in our community.
      </p>
      </div>
      </div>
    </main>
  );
}
