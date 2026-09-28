# Water purified (`water_purified_liters`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Litres of safe drinking water supplied, converted to person-days of drinking water. Service definition: WHO/UNICEF JMP "safely managed" (SDG 6.1.1). |
| Input unit / scored unit | liters / person-days |
| What the weight represents | Days of safe drinking water for one person. |
| Weight (points per person-days) | 0.0055 |
| Anchor | Gold Standard Safe Drinking Water Supply v2.0 (July 2026): caps of 1.3 L/day under 5, 4.5 L/day ages 5–18, 5.5 L/day adults; 5% deduction when defaults are used. Quality: no detectable E. coli per 100 ml (v1.0). Weight 0.0055 per person-day keeps the v0.1 scale. |
| Calculation | person-days = litres ÷ 5.5 × 0.95; score = person-days × 0.0055 × ESM. |
| Status | assumption (needs check). Source: v0.1 scale (0.001/L × 5.5 L); needs check |
| Multipliers | SM (area factor): no, 1.0. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | not in the sample set |
| Five Dimensions rubric | depth 2, duration 1, vulnerability 3 → product 6; rubric-implied weight 0.171 (31.09× current) |
| Proof that fits | P2 photos of the system in use; P3 school or community confirmation; P4 water quality test (E. coli). |
| SDG tags (contributes to) | SDG-6 |
| IRIS+ metric IDs (definitions, cited with attribution to the GIIN) | PI2822 |
| v0.1 value | 0.001 per liters |

## Open questions for experts

- Value per person-day relative to other actions.
- Full weight only with a water quality test?
