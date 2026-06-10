# Petroleum Domain Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Unconventional reservoir flag-consistency check (`geoscienceEngine.ts` ~line 174):
  porosity/permeability assessment branches on `evidence.isUnconventional`, but there's
  no validation that this flag matches the actual porosity/permeability profile (e.g.
  a tight sandstone with `isUnconventional=false` gets penalized under conventional
  thresholds). Proposal: add `validateUnconventionalFlagConsistency()` producing a
  `GeoscienceAssessment.warnings` entry (not a hard gate) when porosity/permeability
  contradicts the flag. Touches geoscienceEngine.ts (hard constraint) — needs a PR with
  methodology citation (SPE/AAPG/SEG unconventional definitions) and before/after test
  evidence for a tight-sandstone case.

## Reference material / methodology notes
- 2026-06-10: Added an advisor handler for source-kitchen / migration-distance queries
  using `evidence.migration.distanceFromKitchenKm` (>50 km flagged as elevated lateral
  charge risk). This is additive only (advisor.ts), no geoscience engine change.
- 2026-06-10: Kerogen-type-aware TOC thresholds — CONFIRMED ALREADY IMPLEMENTED in
  `geoscienceEngine.ts assessSource()` (coaly/terrestrial sources use a 0.5%/2% TOC
  scale vs. 1%/2%/4% for Type I/II). No further action needed; removed from open items.
- 2026-06-10: IRR/NPV for `EconomicAssessment` — RESOLVED via PR #23 (commit `b81ce6b`,
  branch `feature/economics-npv`): added `discountRate` (default 10%) and
  `simpleNPVAtDiscountUsdMM` (5-year single-point realization assumption) to
  `EconomicAssessment`, plus a "positive EMV but negative NPV" warning. IRR intentionally
  not added (no multi-year cash-flow timeline exists). Awaiting human review/merge to main.
- 2026-06-10: Added two safe/additive advisor handlers (advisor.ts): "compare <prospect
  A> and <prospect B>" (highlights largest component-score divergence) and "which
  component should we prioritize/focus to de-risk the portfolio" (lowest portfolio-
  average component score + most-frequent weakest component). Both are pure aggregation
  over existing scores, no geoscience engine change.
