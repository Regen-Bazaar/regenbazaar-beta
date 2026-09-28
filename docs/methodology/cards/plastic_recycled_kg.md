# Plastic recycled (`plastic_recycled_kg`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Mass of plastic delivered to recycling, in kg. Unit definitions: Verra Waste Recycling Credit, PCX PPRS (1 t). |
| Input unit / scored unit | kg / kg |
| What the weight represents | Carbon avoided by recycling instead of landfilling; when no collection row exists, also the pollution part of collected waste. |
| Weight (points per kg) | 0.00105 |
| Anchor | US EPA WARM v16 (Dec 2023) Exhibit 5-3, mixed plastics: recycling −0.93, landfilling +0.02 MTCO2E per short ton → [derived] 1.05 tCO2e per metric t = 0.00105 per kg. US factors. |
| Calculation | kg × 0.00105 × ESM. If the report has no `waste_collected_kg` row, 0.05 per kg (pollution part) is added, because the plastic was also collected. |
| Status | derived (our arithmetic on a cited table). Source: EPA WARM v16 Exhibit 5-3, mixed plastics recycling vs landfill, per metric t (US factors) |
| Multipliers | SM (area factor): no, 1.0. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | stable (ranking moves at −50%: 0, at +50%: 0) |
| Proof that fits | P2 photos of delivery; P4 receipt from the recycler or collection point. |
| SDG tags (contributes to) | SDG-12 |
| v0.1 value | 0.06 per kg |

## Open questions for experts

- Asian recycling factors instead of US WARM factors.
- Pollution value of plastic diverted from open burning.
