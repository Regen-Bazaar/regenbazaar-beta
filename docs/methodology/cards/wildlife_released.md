# Wildlife released (`wildlife_released`)

Methodology v0.2, Community layer. Domain: animal welfare. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Wild animals returned to the wild after care. Gate: IUCN/SSC Reintroduction Guidelines 2013 (justification and post-release monitoring). |
| Input unit / scored unit | animals / animals |
| What the weight represents | Return of a wild animal to its population. |
| Weight (points per animals) | 0.8 |
| Anchor | None (v0.1 value 0.8). Always flagged `gate_iucn` for the validator. |
| Calculation | animals × 0.8, only after the validator accepts the IUCN gate. |
| Status | assumption (needs check). Source: v0.1 value; IUCN/SSC 2013 gate |
| Multipliers | SM (area factor): no, 1.0. ESM: no, 1.0. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | not in the sample set |
| Five Dimensions rubric | depth 3, duration 3, vulnerability 3 → product 27; rubric-implied weight 0.771 (0.96× current) |
| Proof that fits | P2 release photos; P3 wildlife authority permit; P4 tracking data. |
| SDG tags (contributes to) | SDG-15 |
| v0.1 value | 0.8 per animals |

## Open questions for experts

- Weight by conservation status of the species (IUCN Red List cannot be queried commercially).
