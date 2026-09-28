# Waste collected (`waste_collected_kg`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Mass of waste removed from the environment, in kg. Unit definitions: Verra Plastic Standard Waste Collection Credit (1 t plastic), OBP (1 kg ocean-bound plastic), BVRio CCM v2.0 (1 t any solid waste). Evidence schema: Ocean Conservancy ICC data card, NOAA MDMAP. |
| Input unit / scored unit | kg / kg |
| What the weight represents | Pollution removed from beaches, rivers and streets per kg. No public source values litter removal against carbon. |
| Weight (points per kg) | 0.05 |
| Anchor | None (v0.1 value 0.05 per kg kept). Implies 1 t of litter = 50 tCO2e-equivalent points, likely high relative to carbon. |
| Calculation | kg × 0.05 × ESM. Tonnes, grams and pounds are converted to kg first; "bags" cannot be converted and are flagged. |
| Status | assumption (needs check). Source: v0.1 value; unit per Verra Plastic / OBP / BVRio definitions, value needs check |
| Multipliers | SM (area factor): no, 1.0. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | unstable (ranking moves at −50%: 7, at +50%: 3) |
| Five Dimensions rubric | depth 1, duration 1, vulnerability 2 → product 2; rubric-implied weight 0.09 (1.80× current) |
| Proof that fits | P1 public post; P2 geotagged photos of bags and scale, two independent posts; P3 local authority or beach manager confirmation; P4 weighbridge or collection-point receipt. |
| SDG tags (contributes to) | SDG-12, SDG-14 |
| v0.1 value | 0.05 per kg |

## Open questions for experts

- Value of 1 kg of litter removed relative to 1 tCO2e.
- Different values for plastic and other waste?
- Beaches refill: should repeated cleanups of the same site count fully?
