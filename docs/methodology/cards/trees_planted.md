# Trees planted (terrestrial) (`trees_planted`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Area planted with trees, in hectares, credited per monitored year (ha·yr). A tree count is converted to area with the declared planted area or planting density. Area-based approach as in Verra VM0047 (reference only). |
| Input unit / scored unit | trees / ha·yr |
| What the weight represents | Above-ground carbon uptake of a young tropical plantation per hectare per year. |
| Weight (points per ha·yr) | 8.6 |
| Anchor | IPCC 2019 Refinement Vol. 4 Ch. 4 Table 4.10: Asia, tropical rainforest, "other" species, 5 t dry matter/ha/yr; carbon fraction 0.47 (IPCC 2006 GL Table 4.3); 44/12 C→CO2. |
| Calculation | 5 × 0.47 × 44/12 = 8.62 → 8.6 tCO2e/ha/yr. Score = ha × years × 8.6 × SM × ESM. Count without area or density = 0 carbon and a `needs_area` flag. |
| Status | derived (our arithmetic on a cited table). Source: IPCC 2019 Refinement V4 Table 4.10 × 0.47 (2006 GL Table 4.3) × 44/12 |
| Multipliers | SM (area factor): yes. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | stable (ranking moves at −50%: 0, at +50%: 0) |
| Proof that fits | P1 post with photos of the planting; P2 geotagged photos, planting plan with area; P3 landowner or local authority letter; P4 survey or satellite measurement of the planted area. |
| SDG tags (contributes to) | SDG-13, SDG-15 |
| v0.1 value | 0.1 per trees |

## Open questions for experts

- Region-specific rates for other zones (Table 4.10 has dry and montane zones).
- Should a tree count without area get a small non-carbon weight?
- How to treat the first years, when young trees capture far less than the average rate?
