# ML Training Baseline

## Overview

The ML Training Baseline is the first **supervised** ML prototype in PetroTarget AI. It trains a transparent, local **logistic-regression** classifier on the portfolio's labeled historical outcomes, evaluates it on a held-out test split, and compares its predictions against the expert-system GCoS.

It exists to prove the ML workflow end-to-end:

1. import / label real historical outcomes,
2. build a leakage-safe feature matrix,
3. train a baseline model in the browser,
4. evaluate model quality (accuracy, precision, recall, F1, Brier score),
5. compare trained ML predictions vs. expert-system GCoS,
6. judge whether the dataset is actually strong enough.

**This is not a production ML system.** There is no backend training job, no Python service, no LLM, no paid API, no production inference endpoint, and no cloud model registry. Everything runs locally; the trained model is a small JSON blob stored in `localStorage`.

---

## Critical safety rule

The **expert-system GCoS remains the source of truth** for targeting until a trained model is validated and calibrated. The trained model is **advisory only**. It must never override:

- prospect priority,
- recommended action,
- drill-candidate logic,
- economics decision signal,
- geoscience component scores.

It appears only as: an ML predicted probability, a comparison against expert GCoS, model evaluation output, and advisory insight on the ML Lab and Prospect Detail pages.

---

## Model

| Property | Value |
|---|---|
| Algorithm | Logistic regression (pure TypeScript, no ML dependency) |
| Optimizer | Batch gradient descent |
| Regularization | L2 penalty (default `0.001`, weights only — not the intercept) |
| Normalization | Z-score per feature; zero std → std = 1 |
| Determinism | Same rows + config → identical weights; fixed split seed (42) |
| Probability clamp | `[1e-6, 1 − 1e-6]` |

### Default training config

```ts
{
  target: 'geological_success',
  featureMode: 'safe_pre_drill',
  trainRatio: 0.8,
  learningRate: 0.05,
  iterations: 1000,
  l2Penalty: 0.001,
  minExamples: 30,
  excludeSynthetic: true,
}
```

---

## Target variables

Labels are derived from each prospect's recorded `outcome.label`:

| Target | Label = 1 | Label = 0 | Excluded (null) |
|---|---|---|---|
| `hydrocarbon_presence` | commercial / technical / non-commercial discovery | dry hole | unknown |
| `geological_success` | commercial / technical / non-commercial discovery | dry hole | unknown |
| `commercial_success` | commercial discovery | technical / non-commercial / dry hole | unknown |

A non-commercial discovery counts as hydrocarbons-encountered (geological success) but as a commercial failure.

---

## Feature modes & leakage prevention

Feature selection is the single most important safety boundary. **Post-drill and outcome-derived information is never used as a model input** — using it would leak the answer into the features and produce a model that looks excellent in evaluation but cannot generalise to undrilled prospects.

### A. `safe_pre_drill` (default)

Only information available **before** drilling:

- `latitude`, `longitude`
- six geoscience component scores: `sourceScore`, `migrationScore`, `reservoirScore`, `sealScore`, `trapScore`, `timingScore`
- `dataConfidence`
- `isEvidenceDerived` (scoring-mode flag)
- `evidenceCompleteness`
- main-risk one-hot flags: `mainRisk_source` … `mainRisk_timing`
- `basin_hash`, `play_type_hash` (stable numeric encodings of the categorical basin / play type)

### B. `expert_calibration`

All `safe_pre_drill` features **plus** `gcosExpert` (the expert-system GCoS). This lets the baseline learn how to calibrate against the expert score.

### Never used as features (in either mode)

Outcome label, `hydrocarbon_present` / `geological_success` / `commercial_success` flags, discovery/field status, post-drill actuals (net pay, porosity, permeability, production), reserves / recoverable resources, development status, `resourceEstimate`, `riskedResource`, `simpleEMV`, `economicAssessment`, `commercialScore`, `recommended_action`, `prospectivity_tier`, `priority`.

### Defaulted-feature warning

If many training rows have all six component scores at the neutral `0.5` default (e.g. wells imported via the Norway FactPages adapter, which lacks pre-drill risking), the tool warns:

> "Many geoscience scores may be defaulted. Model performance may reflect geography/outcome distribution rather than calibrated petroleum system features."

---

## Train/test split & metrics

- **Split**: deterministic seeded shuffle (mulberry32), default 80/20, configurable to 70/30 or 90/10.
- **Metrics** (computed on the held-out test set, threshold 0.5):
  - accuracy, precision, recall, F1
  - Brier score (mean squared error of predicted probabilities)
  - confusion matrix (TP / FP / TN / FN)
  - positive rate & predicted-positive rate
- Division-by-zero is handled safely (e.g. precision = 0 when nothing is predicted positive). A single-class test set yields weak/degenerate metrics and triggers warnings.

---

## Local model storage

The trained model is persisted to `localStorage` under the key `petrotarget-ai:trained-ml-model` via `src/services/mlModelStorage.ts`:

- `saveTrainedMLModel(model)` — best-effort write
- `loadTrainedMLModel()` — returns `null` for missing, corrupted, or shape-invalid payloads
- `clearTrainedMLModel()` — removes the saved model

No backend storage is involved. When a model is saved, each Prospect Detail page shows an advisory trained-model prediction; otherwise it falls back to the deterministic baseline preview.

---

## UI

**ML Lab → "Train Baseline ML Model"**: target / feature-mode / split / exclude-synthetic controls; pre-training counts (labeled, positive, negative, synthetic-excluded) and readiness warnings; train button (disabled until `minExamples` is met); post-training metadata, metrics, confusion matrix, warnings, and a per-prospect predictions table (expert GCoS, ML probability, delta, agreement, top ± factors); save / load / clear / export-model / export-metrics actions.

**Prospect Detail**: if a model is saved, an advisory "Trained ML Model" section shows ML probability vs. expert GCoS, delta, agreement, top factors, and the model target / trained-at. Targeting recommendations are unchanged.

---

## Limitations

- Local prototype only; logistic-regression baseline only.
- No backend training, no production inference API, no calibration yet.
- A positive prediction is **not** a discovery guarantee.
- ML does not override expert-system GCoS or any targeting gate.
- Model quality depends entirely on the quality of real labeled datasets and pre-drill features. Small or imbalanced label sets produce unstable metrics.
- Categorical basin / play type are hashed to a single numeric feature; this is a pragmatic encoding for a baseline, not a calibrated categorical embedding.

---

## Why post-drill data cannot be used as inputs

Post-drill measurements (actual net pay, production, reserves, development status) and the outcome itself are only known **after** a well is drilled. If used as features, the model would achieve near-perfect training/test scores by effectively reading the answer — then fail completely on new undrilled prospects, where those values do not exist. They are valid only as **labels** and for evaluation, never as inputs.

## Why Norway FactPages data is useful for labels but weak for pre-drill features

Regulator exports (e.g. Norway Sokkeldirektoratet FactPages) provide excellent real **outcome labels** (discovery / dry hole). However they do not publish pre-drill geological risking, so imported component scores are defaulted. Such rows are great for labels but provide little genuine pre-drill signal — hence the defaulted-feature warning.

---

## Path to production ML

1. Import real datasets.
2. Clean labels.
3. Enrich pre-drill geoscience features (real per-component risking, not defaults).
4. Train baseline.
5. Evaluate & calibrate.
6. Compare against expert GCoS.
7. Deploy backend inference **only after** validation — and even then, keep ML advisory until calibration is proven.

---

## Related Documentation

- [ML Core](./ml-core.md) — feature extraction, deterministic baseline preview, readiness
- [ML Dataset Import](./ml-dataset-import.md) — CSV import schema and validation
- [ML Outcomes](./ml-outcomes.md) — recording historical outcome labels
- [Geoscience Engine](./geoscience-engine.md) — GCoS formula and evidence-derived scoring
