// A link taken from a creator's report or a fetched page is shown as a link only when it is plain http(s).
// Anything else (javascript:, data:, a relative path) is shown as text.
export function safeHref(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}
