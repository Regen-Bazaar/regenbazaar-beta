export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "5rem 1.5rem" }}>
      <h1 style={{ fontSize: "2.75rem", fontWeight: 700, lineHeight: 1.1 }}>Regen Bazaar</h1>
      <p style={{ color: "var(--gold)", fontSize: "1.25rem", marginTop: "0.75rem" }}>
        We turn verified real-world impact into a tradable asset class.
      </p>
      <p style={{ opacity: 0.75, marginTop: "1.5rem" }}>
        Beta dApp — under construction. Server pipeline live at <code>POST /api/submissions</code>.
      </p>
    </main>
  );
}
