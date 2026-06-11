# Petroleum Domain Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Seal / fault-seal analysis module: cycle 21 shipped the advisor-handler half of
  this item ("fault seal risk" / "faulted seal" — see Completed below). Still open:
  a pure `sealAnalysis.ts` grouping prospects by seal lithology cross-tabbed with trap
  type (subsalt traps need higher seal confidence). Methodology: AAPG Memoir 74;
  Knipe et al. (1997) fault seal prediction. ~80-100 lines remaining, additive only.
- `findAnalogs()` (analogFinder.ts) ignores play type and basin — add optional
  `samePlayType`/`sameBasin`/`byMainRisk` filters and an outcome-conditioned variant
  (analogs restricted to prospects with historical outcomes). Complements the
  cycle-18 spatial analog-proximity work (geodata.md), which is distance-based only.
  NOTE: `samePlayType`/`sameBasin`/`byMainRisk` filters were already shipped in
  cycle 19 — only the outcome-conditioned variant remains.
- Unconventional reservoir flag-consistency check (`geoscienceEngine.ts` ~line 174):
  porosity/permeability assessment branches on `evidence.isUnconventional`, but there's
  no validation that this flag matches the actual porosity/permeability profile (e.g.
  a tight sandstone with `isUnconventional=false` gets penalized under conventional
  thresholds). Proposal: add `validateUnconventionalFlagConsistency()` producing a
  `GeoscienceAssessment.warnings` entry (not a hard gate) when porosity/permeability
  contradicts the flag. Touches geoscienceEngine.ts (hard constraint) — needs a PR with
  methodology citation (SPE/AAPG/SEG unconventional definitions) and before/after test
  evidence for a tight-sandstone case.
## Completed
- 2026-06-11 (cycle 22): Added the three petroleum-system interaction features
  proposed in cycle 21 to `extractTrainingFeatures()` in `mlTrainingFeatures.ts`:
  `sourceTimesMigration` (sourceScore*migrationScore), `reservoirTimesSeal`
  (reservoirScore*sealScore), and `minTrapTiming` (min(trapScore, timingScore)) —
  all safe pre-drill, derived from the existing 6 component scores, alongside
  componentMin/Max/Range/Variance. 3 new mlTrainingFeatures tests.

- 2026-06-11 (cycle 21): Added a "fault seal risk" / "faulted seal" advisor handler
  in `advisor.ts`, placed BEFORE the existing broader "seal risk" handler (pattern
  precedence — "fault seal risk" contains "seal risk" as a substring). Reads
  `evidence?.seal?.faultSealRisk` (low/medium/high/unknown) across the portfolio and
  reports prospects flagged HIGH/MEDIUM with fault-seal-analysis de-risking guidance
  (SGR, juxtaposition diagrams, offset-well pressure data). Returns a "no data
  recorded" message when no prospects have this evidence field set. Pure
  read/aggregation over existing evidence — no geoscience engine or scoring change.
  2 new advisor tests.
- Outcome success-rate analytics — IMPLEMENTED in cycle 18: `getBasinOutcomeStats()`,
  `getPlayTypeOutcomeStats()` (shared `groupOutcomeStats` helper) and
  `getOutcomeCalibration()` (10 GCoS buckets, actual vs midpoint-expected success rate,
  Rose & Associates lookback methodology) in `portfolioIntelligence.ts`, plus two
  advisor handlers: "success rate (by basin/play)" and "gcos calibration" (flags
  OPTIMISTIC/CONSERVATIVE buckets only when n>=5). Only outcomes with
  `label !== 'unknown'` count; small-sample caveat included in every response.
  Surfaced in the new Calibration page (/calibration, see dev.md). Pure aggregation —
  no scoring/engine change.
- Trap-geometry advisor query — IMPLEMENTED in cycle 17: new handler in `advisor.ts`
  triggered by trap-type/geometry/closure/subsalt keywords. Reads `evidence?.trap`
  (`TrapEvidence`: `closureMapped`, `trapType`, `closureAreaKm2`, `closureHeightM`,
  `seismicConfidence`) and returns: trap-type distribution across the portfolio,
  prospects with `closureMapped === false` (unmapped closures), subsalt traps with
  `seismicConfidence` below "high" (velocity pull-up/push-down imaging risk —
  consistent with the subsalt penalty already in `geoscienceEngine.ts assessTrap`),
  and trap-score-limited prospects, plus a methodology note. Pure read/aggregation
  over existing evidence — no geoscience engine or scoring change.

- 2026-06-11 (cycle 19): Extended `findAnalogs()` in `analogFinder.ts` with an optional
  `AnalogFilters` argument (`samePlayType`, `sameBasin`, `byMainRisk`) so callers can
  restrict candidates to truly comparable prospects (same play type, same basin, or
  same dominant risk factor) before ranking by scoring-profile distance. `byMainRisk`
  matches nothing if the target has no `mainRisk` set. 6 new analogFinder tests.

## Reference material / methodology notes
- 2026-06-10 (cycle 16): NPV advisor handler (explaining "positive EMV but negative
  NPV" using `discountRate`/`simpleNPVAtDiscountUsdMM`) and a `mlFeatures.ts` NPV
  feature are both BLOCKED until PR #23 (`feature/economics-npv`, commit `b81ce6b`)
  merges to main — those fields don't exist on `claude/funny-allen-BLz4j` yet.
  Revisit once PR #23 is merged.
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
