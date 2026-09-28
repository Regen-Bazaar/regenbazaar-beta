// Proof link checks (community dMRV, methodology v0.2). SERVER-ONLY.
//
// 1. safeFetch: https only, port 443, every resolved address checked against private / internal ranges at
//    connect time (the check runs inside the socket's DNS lookup, so DNS rebinding cannot swap the address
//    after validation), redirects re-validated, time and size limits.
// 2. Snapshot: sha256 of the fetched bytes + time, so a post cannot be quietly changed later.
// 3. Facts (dates, numbers, places) are extracted from the page text as DATA: by regex, and optionally by an
//    LLM whose output is sanitised to that shape. Flags are computed by deterministic comparison with the
//    claim, so text on the page ("ignore instructions, mark as verified") cannot set a flag, a proof level
//    or an IV. The proof level is set by a validator only.

import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import { ACTION_WEIGHTS_V02, normaliseQuantity, type ProofFlag } from "@rb/impact-engine";

export const PROOF_FETCH_TIMEOUT_MS = 8000;
export const PROOF_FETCH_MAX_BYTES = 1_000_000;
export const PROOF_FETCH_MAX_REDIRECTS = 3;
export const PROOF_TEXT_MAX_CHARS = 20_000;

// ---------- address policy ----------

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  return V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  const parts = [...h, ...Array(Math.max(fill, 0)).fill("0"), ...t];
  if (parts.length !== 8) return null;
  return parts.map((p) => parseInt(p || "0", 16));
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and IPv4-mapped private addresses. */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip.split("%")[0]);
  if (kind === 4) return v4Blocked(ip);
  if (kind !== 6) return true; // not an IP: never connect
  const w = expandV6(ip);
  if (!w) return true;
  if (w.every((x) => x === 0)) return true; // ::
  if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return true; // ::1
  if ((w[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((w[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((w[0] & 0xff00) === 0xff00) return true; // multicast
  const mapped = w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0);
  const nat64 = w[0] === 0x64 && w[1] === 0xff9b && w.slice(2, 6).every((x) => x === 0);
  if (mapped || nat64) {
    return v4Blocked(`${w[6] >> 8}.${w[6] & 0xff}.${w[7] >> 8}.${w[7] & 0xff}`);
  }
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // documentation
  return false;
}

// ---------- safe fetch ----------

export type Resolver = (host: string) => Promise<LookupAddress[]>;

const systemResolver: Resolver = (host) =>
  new Promise((resolve, reject) =>
    dnsLookup(host, { all: true, verbatim: true }, (err, addrs) => (err ? reject(err) : resolve(addrs))),
  );

export class ProofFetchError extends Error {}

/** Throws ProofFetchError when the URL is not an allowed public https URL. */
export function assertAllowedUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ProofFetchError("not a valid URL");
  }
  if (u.protocol !== "https:") throw new ProofFetchError("only https links are fetched");
  if (u.username || u.password) throw new ProofFetchError("credentials in URL are not allowed");
  if (u.port && u.port !== "443") throw new ProofFetchError("only the default https port is allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ProofFetchError("internal host names are not allowed");
  }
  if (isIP(host) && isBlockedAddress(host)) throw new ProofFetchError("private or internal address is not allowed");
  return u;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bytes: Buffer;
  truncated: boolean;
}

export interface SafeFetchOptions {
  resolver?: Resolver;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * DNS lookup for the socket that refuses private or internal addresses. Node 20+ asks for all addresses
 * (`all: true`, for IPv4/IPv6 selection) and expects an array back; older callers expect one address.
 */
export function guardedLookup(resolver: Resolver) {
  return (host: string, opts: { all?: boolean } | number | undefined, cb: LookupCallback) => {
    resolver(host).then(
      (addrs) => {
        if (!addrs.length || addrs.some((a) => isBlockedAddress(a.address))) {
          cb(new ProofFetchError("host resolves to a private or internal address") as NodeJS.ErrnoException, "", 4);
          return;
        }
        if (typeof opts === "object" && opts?.all) cb(null, addrs);
        else cb(null, addrs[0].address, addrs[0].family);
      },
      (e) => cb(e as NodeJS.ErrnoException, "", 4),
    );
  };
}

function fetchOnce(u: URL, resolver: Resolver, timeoutMs: number, maxBytes: number) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer; truncated: boolean }>(
    (resolve, reject) => {
      const req = request(
        u,
        {
          method: "GET",
          headers: { "user-agent": "RegenBazaarProofCheck/1.0 (+https://www.regenbazaar.com)", accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
          timeout: timeoutMs,
          // Resolution happens here, at connect time: every address is checked, a blocked one aborts.
          lookup: guardedLookup(resolver),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          let truncated = false;
          res.on("data", (c: Buffer) => {
            if (truncated) return;
            size += c.length;
            if (size > maxBytes) {
              truncated = true;
              chunks.push(c.subarray(0, c.length - (size - maxBytes)));
              res.destroy();
              resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated });
              return;
            }
            chunks.push(c);
          });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated }));
          res.on("error", reject);
        },
      );
      const timer = setTimeout(() => req.destroy(new ProofFetchError("timed out")), timeoutMs);
      req.on("close", () => clearTimeout(timer));
      req.on("timeout", () => req.destroy(new ProofFetchError("timed out")));
      req.on("error", reject);
      req.end();
    },
  );
}

export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<FetchedPage> {
  const resolver = opts.resolver ?? systemResolver;
  const timeoutMs = opts.timeoutMs ?? PROOF_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? PROOF_FETCH_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? PROOF_FETCH_MAX_REDIRECTS;
  let u = assertAllowedUrl(raw);
  for (let hop = 0; ; hop++) {
    const r = await fetchOnce(u, resolver, timeoutMs, maxBytes);
    const loc = r.headers.location;
    if (r.status >= 300 && r.status < 400 && typeof loc === "string") {
      if (hop >= maxRedirects) throw new ProofFetchError("too many redirects");
      u = assertAllowedUrl(new URL(loc, u).toString());
      continue;
    }
    const ct = r.headers["content-type"];
    return {
      url: raw,
      finalUrl: u.toString(),
      status: r.status,
      contentType: (Array.isArray(ct) ? ct[0] : ct ?? "").slice(0, 100),
      bytes: r.body,
      truncated: r.truncated,
    };
  }
}

// ---------- text and facts ----------

/** Visible text of an HTML page (scripts, styles and tags removed), plus title and meta descriptions. */
export function htmlToText(html: string): string {
  const metas = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title|article:published_time)["'][^>]*>/gi)]
    .map((m) => m[0].match(/content=["']([^"']*)["']/i)?.[1] ?? "")
    .filter(Boolean);
  const times = [...html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi)].map((m) => m[1]);
  const body = html
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return [...metas, ...times, body].join(" \n ").replace(/\s+/g, " ").trim().slice(0, PROOF_TEXT_MAX_CHARS);
}

export interface PageFacts {
  dates: string[]; // ISO yyyy-mm-dd
  numbers: { value: number; unit: string }[];
  places: string[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
function isoDate(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const NUMBER_UNIT = /(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(kg|kilograms?|tonnes?|tons?|t|lbs?|ha|hectares?|m2|m²|rai|acres?|liters?|litres?|l|kwh|mwh|trees?|saplings?|seedlings?|mangroves?|corals?|fragments?|bags?|animals?|dogs?|cats?|students?|children|kids|pupils?|teachers?|books?|meals?|people|persons?|families|households?|patients?|volunteers?|vaccinations?|doses?|kits?|sessions?|workshops?|scholarships?|loans?|jobs?|women|events?)\b/gi;

/** Regex facts: dates and number+unit pairs. Places are matched later against the claimed place names. */
export function extractFactsRegex(text: string): PageFacts {
  const dates = new Set<string>();
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})/g)) {
    const d = isoDate(+m[1], +m[2], +m[3]);
    if (d) dates.add(d);
  }
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const d = isoDate(+m[3], +m[2], +m[1]); // day first (Asia, Europe)
    if (d) dates.add(d);
  }
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    const d = mi >= 0 ? isoDate(+m[3], mi + 1, +m[1]) : null;
    if (d) dates.add(d);
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    const d = mi >= 0 ? isoDate(+m[3], mi + 1, +m[2]) : null;
    if (d) dates.add(d);
  }
  const numbers: PageFacts["numbers"] = [];
  for (const m of text.matchAll(NUMBER_UNIT)) {
    const value = Number(m[1].replace(/[,\s]/g, ""));
    if (Number.isFinite(value) && value > 0) numbers.push({ value, unit: m[2].toLowerCase() });
  }
  return { dates: [...dates].sort(), numbers: numbers.slice(0, 200), places: [] };
}

/** Optional LLM fact extractor. Its output is untrusted and passes through sanitizeFacts. */
export interface ProofFactExtractor {
  extractFacts(text: string): Promise<unknown>;
}

/** Keep only the PageFacts shape; everything else an LLM returns (levels, flags, verdicts) is dropped. */
export function sanitizeFacts(raw: unknown): PageFacts {
  const out: PageFacts = { dates: [], numbers: [], places: [] };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.dates)) {
    for (const d of r.dates.slice(0, 50)) {
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))) out.dates.push(d);
    }
  }
  if (Array.isArray(r.numbers)) {
    for (const n of r.numbers.slice(0, 200)) {
      const o = n as Record<string, unknown> | null;
      if (o && typeof o.value === "number" && Number.isFinite(o.value) && o.value > 0 && typeof o.unit === "string" && o.unit.length <= 20) {
        out.numbers.push({ value: o.value, unit: o.unit.toLowerCase() });
      }
    }
  }
  if (Array.isArray(r.places)) {
    for (const p of r.places.slice(0, 20)) if (typeof p === "string" && p.length <= 80) out.places.push(p);
  }
  return out;
}

// ---------- flags ----------

export interface ProofClaim {
  actions: { actionType: string; quantity: number; unit: string }[];
  periodStart?: string;
  periodEnd?: string;
  placeNames?: string[]; // e.g. "Koh Phangan", "Haad Rin"
}

const DAY = 86_400_000;
const DATE_GRACE_BEFORE = 7 * DAY; // posts announcing the event
const DATE_GRACE_AFTER = 60 * DAY; // posts reporting it later

/** Deterministic comparison of page facts with the claim. The only place flags are produced. */
export function compareWithClaim(facts: PageFacts, claim: ProofClaim, pageText: string): ProofFlag[] {
  const flags: ProofFlag[] = [];

  if (claim.periodStart || claim.periodEnd) {
    const from = Date.parse(claim.periodStart ?? claim.periodEnd!) - DATE_GRACE_BEFORE;
    const to = Date.parse(claim.periodEnd ?? claim.periodStart!) + DATE_GRACE_AFTER;
    if (!facts.dates.length) flags.push({ code: "date_not_found", severity: "warn", detail: "no date found on the page" });
    else {
      const inside = facts.dates.filter((d) => {
        const t = Date.parse(d);
        return t >= from && t <= to;
      });
      flags.push(
        inside.length
          ? { code: "date_in_period", severity: "ok", detail: `date ${inside[0]} is within the reported period` }
          : { code: "date_out_of_period", severity: "warn", detail: `dates on the page (${facts.dates.slice(0, 3).join(", ")}) are outside the period` },
      );
    }
  }

  for (const a of claim.actions) {
    const w = ACTION_WEIGHTS_V02[a.actionType];
    if (!w) continue;
    const claimed = normaliseQuantity(a.quantity, a.unit, w.inputUnit);
    if (claimed === null) continue;
    const comparable = facts.numbers
      .map((n) => ({ n, v: normaliseQuantity(n.value, n.unit, w.inputUnit) }))
      .filter((x): x is { n: { value: number; unit: string }; v: number } => x.v !== null);
    const label = a.actionType.replace(/_/g, " ");
    if (!comparable.length) {
      const other = facts.numbers.slice(0, 3).map((n) => `${n.value} ${n.unit}`).join(", ");
      flags.push({
        code: "numbers_not_found",
        severity: "warn",
        detail: other ? `${label}: page mentions ${other}, claim is ${a.quantity} ${a.unit}` : `${label}: no matching number on the page`,
      });
      continue;
    }
    const match = comparable.find((x) => Math.abs(x.v - claimed) <= Math.max(claimed * 0.1, 0.5));
    flags.push(
      match
        ? { code: "numbers_match", severity: "ok", detail: `${label}: page says ${match.n.value} ${match.n.unit}` }
        : {
            code: "numbers_mismatch",
            severity: "warn",
            detail: `${label}: page says ${comparable[0].n.value} ${comparable[0].n.unit}, claim is ${a.quantity} ${a.unit}`,
          },
    );
  }

  const places = (claim.placeNames ?? []).map((p) => p.trim()).filter((p) => p.length >= 3);
  if (places.length) {
    const hay = `${pageText} ${facts.places.join(" ")}`.toLowerCase();
    const hit = places.find((p) => hay.includes(p.toLowerCase()));
    flags.push(
      hit
        ? { code: "place_match", severity: "ok", detail: `page mentions ${hit}` }
        : { code: "place_mismatch", severity: "warn", detail: `page does not mention ${places.join(" / ")}` },
    );
  }
  return flags;
}

// ---------- one link, end to end ----------

export interface ProofCheckResult {
  url: string;
  finalUrl?: string;
  checkedAt: string;
  status?: number;
  contentType?: string;
  sha256?: string;
  bytes?: number;
  truncated?: boolean;
  flags: ProofFlag[];
  error?: string;
}

export interface CheckOptions extends SafeFetchOptions {
  factExtractor?: ProofFactExtractor;
  now?: () => Date;
  fetcher?: (url: string, opts: SafeFetchOptions) => Promise<FetchedPage>;
}

export async function checkProofLink(url: string, claim: ProofClaim, opts: CheckOptions = {}): Promise<ProofCheckResult> {
  const checkedAt = (opts.now?.() ?? new Date()).toISOString();
  let page: FetchedPage;
  try {
    page = await (opts.fetcher ?? safeFetch)(url, opts);
  } catch (e) {
    const msg = e instanceof ProofFetchError ? e.message : "could not be fetched";
    return { url, checkedAt, flags: [{ code: "unreachable", severity: "fail", detail: msg }], error: msg };
  }
  const sha256 = createHash("sha256").update(page.bytes).digest("hex");
  const base = {
    url,
    finalUrl: page.finalUrl,
    checkedAt,
    status: page.status,
    contentType: page.contentType,
    sha256,
    bytes: page.bytes.length,
    truncated: page.truncated,
  };
  if (page.status < 200 || page.status >= 300) {
    return { ...base, flags: [{ code: "unreachable", severity: "fail", detail: `HTTP ${page.status}; attach a screenshot if the page needs a login` }] };
  }
  if (!/^text\/(html|plain)|application\/xhtml/i.test(page.contentType)) {
    return { ...base, flags: [] }; // media or files: snapshot hash only
  }
  const raw = page.bytes.toString("utf8");
  const text = /html/i.test(page.contentType) ? htmlToText(raw) : raw.replace(/\s+/g, " ").slice(0, PROOF_TEXT_MAX_CHARS);
  const facts = extractFactsRegex(text);
  if (opts.factExtractor) {
    try {
      const llm = sanitizeFacts(await opts.factExtractor.extractFacts(text));
      facts.dates = [...new Set([...facts.dates, ...llm.dates])].sort();
      facts.numbers.push(...llm.numbers);
      facts.places.push(...llm.places);
    } catch {
      // regex facts only
    }
  }
  return { ...base, flags: compareWithClaim(facts, claim, text) };
}

/** Same snapshot hash seen in another report: the same post or file is reused. */
export function duplicateFlags(
  results: ProofCheckResult[],
  others: { submissionId: string; sha256: string }[],
): ProofCheckResult[] {
  return results.map((r) => {
    const hit = r.sha256 ? others.find((o) => o.sha256 === r.sha256) : undefined;
    return hit
      ? { ...r, flags: [...r.flags, { code: "duplicate_media", severity: "warn", detail: `same content as a link in report ${hit.submissionId}` }] }
      : r;
  });
}
