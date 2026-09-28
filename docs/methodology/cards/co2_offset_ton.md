# tCO2e with registry serial (`co2_offset_ton`)

Methodology v0.2, Community layer. Domain: environment. Part of Regen Bazaar's own relative index; not a certification.

**Parked:** registry carbon belongs to the corporate layer. Kept in the table; scores 0 in the Community layer.

| Field | Value |
|---|---|
| Definition and unit | Tonnes of CO2e issued or retired in a recognised registry (Verra, Gold Standard, Plan Vivo), identified by serial number. |
| Input unit / scored unit | tCO2e / tCO2e |
| What the weight represents | The anchor of the environment scale: 1 point = 1 tCO2e. |
| Weight (points per tCO2e) | 1 |
| Anchor | Definition. Counts only with a registry serial; otherwise 0 and a `registry_required` flag, to prevent double claiming. |
| Calculation | tCO2e × 1.0 × ESM. With a serial, tree and area rows of the same report become evidence only (score 0). |
| Status | sourced. Source: anchor: 1 point = 1 tCO2e; only with a registry serial |
| Multipliers | SM (area factor): no, 1.0. ESM: yes, 1.0–1.3. Domain coefficient k: 1.0, pending cost survey |
| Sensitivity (±50%) | not in the sample set |
| Proof that fits | P4 registry record with serial number and retirement. |
| SDG tags (contributes to) | SDG-13 |
| v0.1 value | 1 per tCO2e |

## Open questions for experts

- Should registry-certified carbon be listed at all in the community layer, or only in the corporate layer?
