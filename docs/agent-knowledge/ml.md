# AI/ML Specialist Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- `MLLabPage.tsx` (~960 lines) recomputes `buildTrainingRows()` on every
  prospects/trainingConfig change inside `trainingPreview`; extracting a
  `useTrainingPreview()` hook was proposed in cycle 20 but deferred alongside the
  broader page-decomposition work already tracked by the architecture agent.
  Re-checked in cycle 21: the existing `useMemo([prospects, trainingConfig])` is
  already correctly memoized — extraction would be a pure readability refactor with
  no behavioral fix, so it stays low priority.

## Completed
- 2026-06-11 (cycle 24 audit): No findings — clean report. Deep-audited three
  not-recently-checked areas: (1) mlLogisticRegression.ts numerics — zero-variance
  normalization sets std=1 (no div-by-zero), log-loss clamps to
  [1e-6, 1-1e-6], early-stopping/patience correct. (2) mlTrainingService split is
  deterministic (mulberry32 seed 42) with a >=30-row minExamples guard. The
  highest-value check — old models (trained pre-cycle-22, without the 3
  interaction features) meeting the new feature keys — is SAFE BY DESIGN:
  `predictProbability()` iterates only over `model.featureNames`, so extra keys
  in the extracted vector are ignored via `features[name] ?? 0`; no mismatch, no
  crash, no silent mis-prediction. (3) norwayFactpagesAdapter labels real imports
  `is_synthetic: false` and synthetic derivations `source: 'synthetic'` — data
  honesty intact.
- 2026-06-11 (cycle 23 audit): VERIFIED the cycle-22 interaction features flow
  correctly through the full training pipeline — mlTrainingTypes rows use a
  dynamic `Record<string, number>`, mlLogisticRegression/mlTrainingService
  normalize via `Object.keys()` (no stale hardcoded feature list), and the
  feature-correlation panel picks them up automatically. The one finding
  (CSV export omits the interaction features) was REJECTED as inapplicable:
  `exportTrainingDatasetAsCsv()` serializes `MLTrainingExample.features`, which
  is typed `MLFeatureVector` (from `extractMLFeatures`) — a different feature
  set that structurally cannot contain the training-row interaction features;
  adding those keys to `scalarFeatureKeys: Array<keyof MLFeatureVector>` would
  be a type error. The training rows and the MLFeatureVector export are
  intentionally separate surfaces.
- 2026-06-11 (cycle 22 audit): Re-checked two findings raised this cycle, both
  rejected as non-actionable. (1) `deriveSyntheticLabel()` in `mlDataset.ts` was
  flagged for the case `gcos>=0.35 && commercialScore>=70 && dc<70` falling
  through to `'unknown'` — but this matches the documented synthetic-label rules
  exactly (the conservative "else -> unknown" catch-all is intentional: low data
  confidence undermines both the GCoS and commercial-score inputs, so the case is
  correctly left unlabeled). (2) The proposed mainRisk one-hot-sum validation in
  `validateTrainingExample()` is already implemented (`mlDataset.ts` ~lines 81-90,
  `oneHotFields` loop). No code changes from the ML agent this cycle.
- 2026-06-11 (cycle 21): Resolved the cycle-20 "design decision" blocker
  (`dummyModel`/threshold) by NOT building a model object at all — added
  `evaluateBaselineOnLabeledOutcomes(prospects, target?, threshold = 0.5)` to
  `mlEvaluation.ts`, which calls `predictWithBaselineModel()` directly per prospect,
  filters to `buildTrainingRows()` rows with `excludeSynthetic: true` (i.e. real,
  non-synthetic outcomes only — synthetic labels are themselves derived from a GCoS-
  based formula, so including them would be circular), thresholds `predictedGCoS` at
  0.5, and reuses `calculateConfusionMatrix`/`calculateBrierScore`/`calculateROCAUC`/
  `findOptimalThreshold` to produce the same `MLMetrics` shape as `evaluateModel()`.
  Wired into `MLLabPage.tsx` `trainingPreview` as `baselineCalibration`, rendered as a
  "Baseline Calibration Report (Experimental)" panel (accuracy/Brier/ROC-AUC/sample
  size) shown once >=5 real-labeled prospects exist for the selected target, with
  explicit "Experimental" / "not a calibrated, trained model" language. 3 new
  mlEvaluation tests (zero real outcomes -> zeroed metrics; synthetic excluded;
  clearly-discriminating dataset classifies correctly).
  Also re-confirmed (cycle 21 audit): `mlReadiness.ts:20-22` already correctly counts
  `labeledExamples` from real outcomes via `isKnownOutcome(p.outcome)` — the cycle-19
  "cross-check against real outcome labels" item is RESOLVED, no further action needed.
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
- 2026-06-11 (cycle 20): Removed `riskedResource`, `simpleEMV`, and
  `prospectivityTierNumeric` from `exportTrainingDatasetAsCsv()`'s
  `scalarFeatureKeys` in `mlDataset.ts`. These are post-drill/economics-derived
  fields (from `economicAssessment` and `recommendationEngine`'s prospectivity
  tier) that `mlTrainingFeatures.ts` never used for training — including them in a
  "training dataset" CSV could mislead users into treating them as valid pre-drill
  features. `MLFeatureVector` itself is unchanged (still used for the Feature
  Extraction Preview panel); only the training-CSV export was narrowed.

## Reference material / methodology notes
- Real outcome labels (`Prospect.outcome`, `getOutcomeStats`/`getOutcomeCalibration` in
  `portfolioIntelligence.ts`, BatchOutcomePage `/outcomes`, CalibrationPage `/calibration`) became
  available in cycles 17-18 — these did not exist when ML Core v1/v2 were originally built, so the
  ML pipeline (`mlReadiness.ts`, `mlEvaluation.ts`) should be checked for whether it leverages this
  new ground truth.
- Hard constraint: ML output is advisory only, must never override expert-system GCoS/recommendations,
  and every prediction surface must disclose "no trained model connected yet" / "deterministic baseline".
