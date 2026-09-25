// Fixed-window in-memory rate limit (per server process; enough for a single-container beta).
const buckets = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (now - v.start >= windowMs) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

/** Client IP as set by our nginx (X-Real-IP = $remote_addr); not spoofable through the proxy. */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? "unknown";
}
