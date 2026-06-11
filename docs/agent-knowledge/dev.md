# Development Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Drill-sequence / budget allocation planner: `getDrillSequenceOrder()` exists but
  there's no budget-constrained view (EMV waterfall, cumulative capex vs risked
  resource). Next-best candidate after calibration; uses existing
  `economicAssessment` fields only.
- CSV export exists on Dashboard; consider a calibration-data CSV export on
  /calibration if users ask for lookback data offline.
- GCoS range slider + filter presets for TargetingPage (validated cycle 21): new
  `src/domain/filterPresets.ts` (save/load/delete/validate via localStorage key
  `petrotarget:filter-presets`), `gcosMin`/`gcosMax` added to the store's `Filters`
  type, and a range-slider + preset dropdown in `TargetingPage.tsx` (currently local
  component state, lines ~39-43, not store-backed). ~200 lines across 4 files
  (domain + store + page + tests). Deferred from cycle 21 for sizing — ready to
  implement next cycle.

## Completed
- Outcome Calibration page — IMPLEMENTED in cycle 18: new
  `src/pages/CalibrationPage.tsx` at route `/calibration` (sidebar: "Calibration").
  KPI row from `getOutcomeStats`, actual-vs-predicted grouped bar chart from
  `getOutcomeCalibration` (only populated buckets), and per-basin / per-play-type
  success tables from `getBasinOutcomeStats`/`getPlayTypeOutcomeStats` with
  optimistic/conservative/calibrated badges (±10% threshold, n>=5 gate, "n<5"
  otherwise). Empty state links to /outcomes. Closes the label → calibrate → train
  UX loop opened by cycle 17's Outcome Labeling page.
- Batch outcome labeling — IMPLEMENTED in cycle 17: new `src/pages/BatchOutcomePage.tsx`
  at route `/outcomes` (sidebar: "Outcome Labeling"). Shows an ML-readiness summary
  (via `assessMLReadiness`), basin + "unlabeled only" filters, a per-row outcome-label
  + result-confidence editor, and a "apply to N visible" bulk action. Saves via a new
  `batchUpdateOutcomes(updates: { id, outcome }[])` store mutation (additive — existing
  `updateProspect`/CRUD untouched), which preserves any existing `wellName`/`drillYear`/
  `operator`/`notes` on each prospect's outcome and re-scores via `scoreProspects`.
  Advisor's "labeled examples"/"prospects with outcomes" responses now mention the new
  page. Tests added to `useProspectStore.test.ts` (batch-set + overwrite cases).

## Reference material / methodology notes
- 2026-06-10: Confirmed already implemented & polished: risk tornado/sensitivity
  chart (TornadoChart.tsx + sensitivityAnalysis.ts), portfolio analytics dashboard,
  analog prospect finder (analogFinder.ts + ComparisonPage), and the new
  VisualizationsPage (2D cross-section, 3D bubble, resource forecast).
