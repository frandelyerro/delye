# AI/ML Specialist Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- `mlReadiness.ts`/`mlEvaluation.ts` should be cross-checked against the real outcome
  labels added in cycles 17-18 (currently feature correlations run over `buildTrainingRows`,
  which already includes real-labeled rows where present, but readiness scoring may still
  be synthetic-only — needs a follow-up audit).

## Completed
- 2026-06-11 (cycle 19): New specialist agent created (`.claude/commands/ml.md`), added to the
  `/advance` Phase 1 roster (7 agents total) and to `AgentEvolutionPage` (`AgentId`, `AGENTS`,
  `CYCLE_HISTORY`, `AGENT_COLORS`, `META_IMPROVEMENTS`). Audit scope: `mlFeatures.ts`,
  `mlDataset.ts`, `mlModel.ts`, `mlReadiness.ts`, `mlTrainingFeatures.ts`, `mlTrainingService.ts`,
  `mlEvaluation.ts`, `mlLogisticRegression.ts`, `norwayFactpagesAdapter.ts`, `MLLabPage.tsx`.
- 2026-06-11 (cycle 19): Shipped `computeFeatureCorrelations()` in `mlEvaluation.ts`
  (point-biserial correlation between each training feature and the binary label,
  sorted by |correlation| descending, returns [] for <2 rows, zero-variance features
  get correlation 0). Wired into `MLLabPage.tsx` as a "Feature Correlations
  (Exploratory)" panel shown once >=5 labeled rows exist, with explicit
  exploratory-only / not-for-feature-selection language. 5 new mlEvaluation tests.

## Reference material / methodology notes
- Real outcome labels (`Prospect.outcome`, `getOutcomeStats`/`getOutcomeCalibration` in
  `portfolioIntelligence.ts`, BatchOutcomePage `/outcomes`, CalibrationPage `/calibration`) became
  available in cycles 17-18 — these did not exist when ML Core v1/v2 were originally built, so the
  ML pipeline (`mlReadiness.ts`, `mlEvaluation.ts`) should be checked for whether it leverages this
  new ground truth.
- Hard constraint: ML output is advisory only, must never override expert-system GCoS/recommendations,
  and every prediction surface must disclose "no trained model connected yet" / "deterministic baseline".
