import { ImageResponse } from "next/og";
import { GOLD, MUTED, OG_SIZE, OgFrame, ogFonts } from "../lib/og";

export const alt = "Regen Bazaar: verified real-world impact as a tradable asset class";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 980 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Acma", fontSize: 76, lineHeight: 1.08 }}>
            We turn verified real-world impact into a&nbsp;<span style={{ color: GOLD }}>tradable asset class.</span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: MUTED, lineHeight: 1.4 }}>
            NGOs tokenize their impact as tRWI; funders back it with stablecoins, with proof on-chain.
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
