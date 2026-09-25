// Generative tRWI artwork: a deterministic SVG "impact card" drawn from the impact data itself (domain palette,
// SDG colour ring, a seeded pattern whose density grows with Impact Value, title/org/period). No external
// service, no user-uploaded images, so nothing to moderate and nothing to pay for. Same input -> same image,
// so the site can re-render it and the pinned IPFS copy stays identical.
//
// All user-supplied text is XML-escaped before it reaches the SVG.

export interface ImpactCardInput {
  seed: string; // stable id (submission id) -> pattern
  title: string;
  orgName: string;
  domain?: string | null;
  impactValue: number;
  sdgs: string[]; // e.g. ["SDG-13", "SDG-14"]
  periodStart?: string | null;
  periodEnd?: string | null;
}

const PALETTES: Record<string, { bg: [string, string]; accent: string[] }> = {
  environment: { bg: ["#1f3b2a", "#0f1a12"], accent: ["#6fbf73", "#a8d5a2", "#3e8e5a", "#d9c27a"] },
  animal_welfare: { bg: ["#4a3218", "#1a120a"], accent: ["#e0a458", "#f2c98a", "#b8733b", "#fff1d6"] },
  education: { bg: ["#23285a", "#0e1026"], accent: ["#7f8cff", "#b3bbff", "#4a56c9", "#f2d27a"] },
  poverty: { bg: ["#5a2c1f", "#1f0f0a"], accent: ["#e07a5f", "#f2b8a2", "#b5523a", "#f2d27a"] },
  social: { bg: ["#16464a", "#08191b"], accent: ["#5cc3c9", "#a6e3e6", "#2f8c92", "#f2d27a"] },
  health: { bg: ["#5a1f35", "#1f0a12"], accent: ["#e0708f", "#f2b3c5", "#b54365", "#f2d27a"] },
};
const DEFAULT_PALETTE = PALETTES.environment;

// Official UN SDG colours.
const SDG_COLORS: Record<number, string> = {
  1: "#E5243B", 2: "#DDA63A", 3: "#4C9F38", 4: "#C5192D", 5: "#FF3A21", 6: "#26BDE2", 7: "#FCC30B",
  8: "#A21942", 9: "#FD6925", 10: "#DD1367", 11: "#FD9D24", 12: "#BF8B2E", 13: "#3F7E44", 14: "#0A97D9",
  15: "#56C02B", 16: "#00689D", 17: "#19486A",
};

function xml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: small deterministic PRNG.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(text: string, max: number, lines: number): string[] {
  const words = text.trim().split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].slice(0, max - 1).trimEnd() + "…";
  }
  return out.map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)].map((n) => n.toFixed(1)).join(" ");
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
}

export function renderImpactCard(input: ImpactCardInput): string {
  const W = 1000;
  const pal = PALETTES[input.domain ?? ""] ?? DEFAULT_PALETTE;
  const rand = rng(hash(input.seed));
  const iv = Number.isFinite(input.impactValue) ? Math.max(0, input.impactValue) : 0;

  // Pattern density grows with IV on a log scale (12..90 marks).
  const marks = Math.min(90, Math.max(12, Math.round(12 + Math.log10(iv + 1) * 22)));
  let pattern = "";
  for (let i = 0; i < marks; i++) {
    const x = rand() * W;
    const y = rand() * 640;
    const r = 6 + rand() * 38;
    const c = pal.accent[Math.floor(rand() * pal.accent.length)];
    const o = (0.08 + rand() * 0.22).toFixed(2);
    pattern += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" opacity="${o}"/>`;
  }

  // Growth rings around the centre, one per ~order of magnitude of IV.
  const cx = 500;
  const cy = 330;
  const rings = Math.max(2, Math.min(7, Math.round(Math.log10(iv + 1) * 2)));
  let ringSvg = "";
  for (let i = 0; i < rings; i++) {
    const r = 120 + i * 16 + rand() * 6;
    ringSvg += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${pal.accent[1]}" stroke-opacity="${(0.35 - i * 0.04).toFixed(2)}" stroke-width="1.5"/>`;
  }

  // SDG ring: one coloured arc per SDG.
  const sdgNums = [...new Set(input.sdgs.map((s) => Number(s.replace(/\D/g, ""))).filter((n) => SDG_COLORS[n]))].sort(
    (a, b) => a - b,
  );
  let sdgSvg = "";
  const R = 250;
  if (sdgNums.length > 0) {
    const gap = 0.06;
    const seg = (Math.PI * 2) / sdgNums.length;
    sdgNums.forEach((n, i) => {
      const a0 = -Math.PI / 2 + i * seg + gap / 2;
      const a1 = a0 + seg - gap;
      sdgSvg += `<path d="${arc(cx, cy, R, a0, a1)}" fill="none" stroke="${SDG_COLORS[n]}" stroke-width="18" stroke-linecap="round"/>`;
      const am = (a0 + a1) / 2;
      const lx = cx + (R + 34) * Math.cos(am);
      const ly = cy + (R + 34) * Math.sin(am) + 6;
      sdgSvg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="18" text-anchor="middle" fill="#f5efe0" opacity="0.8">${n}</text>`;
    });
  }

  const ivText = iv >= 1000 ? Math.round(iv).toLocaleString("en-US") : (Math.round(iv * 10) / 10).toString();
  const titleLines = wrap(input.title, 34, 2);
  const period = [input.periodStart, input.periodEnd].filter(Boolean).map((d) => String(d).slice(0, 10)).join(" to ");
  const domain = (input.domain ?? "impact").replace(/_/g, " ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" font-family="Georgia, 'Times New Roman', serif">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${pal.bg[0]}"/><stop offset="1" stop-color="${pal.bg[1]}"/></linearGradient></defs>
<rect width="${W}" height="${W}" fill="url(#bg)"/>
${pattern}
${ringSvg}
${sdgSvg}
<text x="${cx}" y="${cy + 8}" font-size="92" font-weight="700" text-anchor="middle" fill="#f5efe0">${xml(ivText)}</text>
<text x="${cx}" y="${cy + 50}" font-size="22" letter-spacing="4" text-anchor="middle" fill="#d9c27a">IMPACT VALUE</text>
<rect x="0" y="690" width="${W}" height="310" fill="#000" opacity="0.35"/>
<text x="60" y="740" font-size="20" letter-spacing="5" fill="#d9c27a">${xml(domain.toUpperCase())}</text>
${titleLines.map((l, i) => `<text x="60" y="${800 + i * 50}" font-size="42" font-weight="700" fill="#f5efe0">${xml(l)}</text>`).join("\n")}
<text x="60" y="${titleLines.length > 1 ? 905 : 855}" font-size="24" fill="#f5efe0" opacity="0.75">by ${xml(input.orgName.slice(0, 60))}</text>
${period ? `<text x="60" y="${titleLines.length > 1 ? 940 : 890}" font-size="20" fill="#f5efe0" opacity="0.55">${xml(period)}</text>` : ""}
<text x="940" y="960" font-size="22" text-anchor="end" fill="#d9c27a">tRWI · Regen Bazaar</text>
<rect x="16" y="16" width="${W - 32}" height="${W - 32}" fill="none" stroke="#d9c27a" stroke-opacity="0.5" stroke-width="2"/>
</svg>`;
}
