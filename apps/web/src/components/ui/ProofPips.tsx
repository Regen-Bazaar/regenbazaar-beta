/** Proof level as four pips with the words next to them (colour is never the only carrier). */
export function ProofPips({ level, of = 4 }: { level: number; of?: number }) {
  return (
    <span className="proof">
      <span className="pips" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <i key={i} className={i < level ? "on" : ""} />
        ))}
      </span>
      Proof {level} of {of}
    </span>
  );
}
