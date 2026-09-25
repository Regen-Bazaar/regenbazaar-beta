import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";
import { LOGO_PATHS } from "../components/Logo";

// Link-preview images (Open Graph / X cards), rendered with next/og. Fonts are read from public/fonts; the
// standalone Docker image runs from the repo root, `next dev` from apps/web, so both locations are tried.
export const OG_SIZE = { width: 1200, height: 630 };

async function font(file: string): Promise<Buffer> {
  for (const dir of [join(process.cwd(), "public/fonts"), join(process.cwd(), "apps/web/public/fonts")]) {
    try {
      return await readFile(join(dir, file));
    } catch {}
  }
  throw new Error(`og font not found: ${file}`);
}

export async function ogFonts() {
  const [acma, eb] = await Promise.all([font("pp-acma.ttf"), font("eb-garamond.ttf")]);
  return [
    { name: "Acma", data: acma, weight: 400 as const, style: "normal" as const },
    { name: "EB", data: eb, weight: 400 as const, style: "normal" as const },
  ];
}

export const INK = "#1b0f08";
export const PAPER = "#f7f3e4";
export const GOLD = "#d8b85a";
export const MUTED = "#d9ccb0";


/** Brand frame: ink background with the green and gold glows of the site hero, logo top-left, URL bottom. */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "56px 72px",
        backgroundColor: INK,
        backgroundImage:
          "radial-gradient(circle at 85% 25%, rgba(63,108,59,0.55), rgba(27,15,8,0) 55%), radial-gradient(circle at 60% 110%, rgba(189,158,72,0.35), rgba(27,15,8,0) 50%)",
        color: PAPER,
        fontFamily: "EB",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="96" height="42" viewBox="0 0 73 32" fill={PAPER}>
          {LOGO_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <div style={{ display: "flex", fontFamily: "Acma", fontSize: 34 }}>
          Regen&nbsp;<span style={{ color: GOLD }}>Bazaar</span>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: MUTED, letterSpacing: 2 }}>
        <span>app.regenbazaar.com</span>
        <span>TESTNET BETA</span>
      </div>
    </div>
  );
}

