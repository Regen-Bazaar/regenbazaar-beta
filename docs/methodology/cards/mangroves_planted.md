# Mangroves planted (`mangroves_planted`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | Mangrove area planted, in hectares per monitored year (ha·yr), from declared area or density. Current Verra route for mangroves is VM0033 (reference only). |
| Input unit / scored unit | trees / ha·yr |
| What the weight represents | Above-ground carbon uptake of planted tropical mangroves, discounted for survival. |
| Weight (points per ha·yr) | 23.1 |
| Anchor | Bernal, Murray, Pearson 2018, Carbon Balance and Management, Table 2: 23.1 tCO2/ha/yr (±2.9) for years 0–20, tree form; 6.7 for shrub form. Cross-check [derived] IPCC 2013 Wetlands Supplement Tables 4.4 × 4.2 × 44/12 = 16.4 above-ground, ≈24.4 with roots (Table 4.5). |
| Calculation | ha × years × 23.1 (6.7 for shrub form) × S × SM × ESM. S = measured surviving share when given, else 0.72 (proxy from Bourgeois et al. 2024: planted stands reach 71–73% of intact biomass after ~20 years). |
| Status | sourced. Source: Bernal et al. 2018, Table 2 (tree form, yrs 0–20, above-ground) |
| Survival factor S | 0.72, assumption (needs check). Source: proxy: Bourgeois et al. 2024, planted stands reach 71–73% of intact biomass; replaced by measured survival |
| Multipliers | SM (area factor): yes. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | unstable (ranking moves at −50%: 5, at +50%: 2) |
| Proof that fits | P1 public post; P2 geotagged photos and planting records; P3 local authority or partner confirmation; P4 survival survey, drone or satellite area measurement. |
| SDG tags (contributes to) | SDG-13, SDG-14, SDG-15 |
| v0.1 value | 0.15 per trees |

## Open questions for experts

- Include soil carbon (+5.9 tCO2e/ha/yr [derived] IPCC 2013 Table 4.12)?
- Is the Bourgeois ratio a fair default survival factor, or should unmonitored planting get a lower default?
- How to credit the first years after planting?
