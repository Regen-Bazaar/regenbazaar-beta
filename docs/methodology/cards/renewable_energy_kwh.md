# Renewable energy generated (`renewable_energy_kwh`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

| Field | Value |
|---|---|
| Definition and unit | kWh of solar or wind electricity generated, converted to tCO2e avoided with the country grid factor. |
| Input unit / scored unit | kWh / tCO2e |
| What the weight represents | Grid emissions avoided. |
| Weight (points per tCO2e) | 1 |
| Anchor | IFI Default Grid Factors v3.0 (Dec 2021, UNFCCC), combined margin for intermittent sources, tCO2e/kWh: TH 0.000413, VN 0.000493, ID 0.000714, PH 0.000617, MY 0.000508, KH 0.000874, LA 0.000876, IN 0.000842. Unknown country: lowest listed factor, flagged. |
| Calculation | kWh × grid factor × 1.0 × ESM. |
| Status | sourced. Source: anchor: 1 point = 1 tCO2e avoided |
| Multipliers | SM (area factor): no, 1.0. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | unstable (ranking moves at −50%: 4, at +50%: 3) |
| Proof that fits | P2 photos of the installation and meter; P4 inverter or meter export. |
| SDG tags (contributes to) | SDG-7, SDG-13 |
| v0.1 value | 0.002 per kWh |

## Open questions for experts

- Switch Thailand to the TGO 2026 factor once the official page is reachable.
- Off-grid systems replacing diesel need a different baseline.
