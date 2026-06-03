// Mock marketplace preview (listings come from the indexer once contracts are deployed).
const LISTINGS = [
  { title: "Beach reforestation — Koh Phangan", domain: "environment", iv: 1287.5, editions: "42 / 100", price: "0.05", tags: ["SDG-13", "EBF carbon"] },
  { title: "Street dog rescue & sterilization", domain: "animal welfare", iv: 342, editions: "10 / 50", price: "0.03", tags: ["SDG-15"] },
  { title: "Mangrove restoration", domain: "environment", iv: 980, editions: "60 / 80", price: "0.08", tags: ["SDG-14", "EBF biodiversity"] },
  { title: "After-school STEM program", domain: "education", iv: 96, editions: "5 / 25", price: "0.02", tags: ["SDG-4"] },
  { title: "Community kitchen — meals", domain: "poverty", iv: 60, editions: "8 / 40", price: "0.015", tags: ["SDG-1", "SDG-2"] },
  { title: "Coral nursery", domain: "environment", iv: 540, editions: "20 / 60", price: "0.06", tags: ["SDG-14"] },
];

export default function Marketplace() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Marketplace</h1>
      <p className="mt-2 text-paper/70">Fund verified real-world impact. Each edition is a fractional share of the claim.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LISTINGS.map((l) => (
          <div key={l.title} className="flex flex-col rounded-xl border border-gold/15 bg-ink-soft/40 p-5">
            <div className="mb-3 h-28 rounded-lg bg-gradient-to-br from-green/40 to-ink" />
            <div className="text-xs capitalize text-paper/50">{l.domain}</div>
            <div className="mt-1 font-medium leading-snug">{l.title}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {l.tags.map((t) => (
                <span key={t} className="rounded-full bg-green/25 px-2 py-0.5 text-xs text-paper/80">{t}</span>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div className="text-xs text-paper/45">Impact Value</div>
                <div className="font-semibold text-gold">{l.iv.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-paper/45">{l.editions} editions</div>
                <div className="text-sm">{l.price} CELO</div>
              </div>
            </div>
            <button className="mt-4 rounded-md border border-gold/40 py-2 text-sm transition-colors hover:border-gold hover:text-gold">
              Fund this impact
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
