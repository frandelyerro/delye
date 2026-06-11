# Development Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Drill-sequence / budget allocation planner: `getDrillSequenceOrder()` exists but
  there's no budget-constrained view (EMV waterfall, cumulative capex vs risked
  resource). Next-best candidate; uses existing `economicAssessment` fields only.
- Filter PRESETS for TargetingPage (the GCoS range half shipped cycle 24): a new
  `src/domain/filterPresets.ts` (save/load/delete/validate via localStorage key
  `petrotarget:filter-presets`) + a preset dropdown in `TargetingPage.tsx`. NOTE
  (corrected cycle 24): TargetingPage filters are LOCAL component state, NOT the
  store's `Filters` type — presets only need the page + a small domain module +
  tests (~120 lines), no store changes. The earlier "store-backed" framing was
  stale.

## Completed
- 2026-06-11 (cycle 24): GCoS min/max range filter IMPLEMENTED on TargetingPage
  — two percentage inputs (0–100) + a "Clear GCoS range" button, local
  `gcosMin`/`gcosMax` string state, filtering `r`'s prospect by
  `geologicalChanceOfSuccess * 100`. Composes with the existing basin/play/
  scoring-mode/tier/action filters. No store change, no new domain module (the
  presets half is deferred — see Open areas).
- 2026-06-11 (cycle 23): Calibration-data CSV export IMPLEMENTED — new
  `exportCalibrationDataAsCsv()` in `src/utils/exportReport.ts` (reuses
  `csvEscape`/`downloadText`): one row per known-outcome prospect with
  pre-drill GCoS %, data confidence, outcome label/target/well/year/operator/
  result-confidence/source. "Export Calibration CSV" button added to the
  /calibration header, shown only when drilled outcomes exist.
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
