# Patients treated (`patients_treated`)

Methodology v0.2, Community layer. Domain: health. Part of Regen Bazaar's own relative index; not a certification.

**Parked:** needs licensed medical professionals. Kept in the table; scores 0 in the Community layer.

| Field | Value |
|---|---|
| Definition and unit | Patients completing treatment. IRIS+ PI5060 Patients Completing Treatment. |
| Input unit / scored unit | patients / patients |
| What the weight represents | Health gain for one patient. |
| Weight (points per patients) | 0.2 |
| Anchor | None (v0.1 value 0.2). Calibration sources: WHO DALY methods (2024), DCP3 (CC BY 3.0 IGO). |
| Calculation | patients × 0.2. With vaccinations or kits in the same report, a `review_overlap` flag goes to the validator. |
| Status | assumption (needs check). Source: v0.1 value |
| Multipliers | SM (area factor): no, 1.0. ESM: no, 1.0. Domain coefficient k: 1.0, platform value |
| Sensitivity (±50%) | not in the sample set |
| Proof that fits | P2 photos; P3 clinic or health office letter; P4 patient register. |
| SDG tags (contributes to) | SDG-3 |
| IRIS+ metric IDs (definitions, cited with attribution to the GIIN) | PI5060 |
| v0.1 value | 0.2 per patients |

## Open questions for experts

- DALY-based weights by treatment type.
