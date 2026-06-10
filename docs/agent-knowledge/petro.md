# Petroleum Domain Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Kerogen-type-aware TOC thresholds in `geoscienceEngine.ts` `assessSource()`: Type III
  (coaly/terrestrial) sources can be gas-prone at lower TOC than Type I/II — current
  thresholds may over-penalize. This touches the geoscience engine (hard constraint),
  so any change must go through a PR with methodology justification (Espitalié &
  Bordenave kerogen typing) and before/after test evidence — do not change directly.
- IRR/NPV-style metrics for `EconomicAssessment` (discount rate, NPV @ 10%): would
  catch "high EMV / negative NPV at discount" cases. Touches `economics.ts` /
  `economicTypes.ts` (hard constraint) — needs a PR with justification, not a direct
  cycle change.

## Reference material / methodology notes
- 2026-06-10: Added an advisor handler for source-kitchen / migration-distance queries
  using `evidence.migration.distanceFromKitchenKm` (>50 km flagged as elevated lateral
  charge risk). This is additive only (advisor.ts), no geoscience engine change.
