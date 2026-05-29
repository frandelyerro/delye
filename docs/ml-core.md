# ML Core v1

This document describes the ML Core v1 implementation in PetroTarget AI: what it does, what it does not do, what data is needed to advance to real training, and the training roadmap.

---

## What ML Core v1 Does

ML Core v1 builds the **foundation** for an ML-assisted geoscience platform without introducing a production ML model. It provides:

1. **ML feature extraction** (`src/domain/mlFeatures.ts`) — converts each scored prospect into a structured `MLFeatureVector` with 30+ scalar features derived deterministically from existing expert-system outputs (GCoS, component scores, data confidence, evidence assessments, economic assessment, prospectivity tier).

2. **Training dataset module** (`src/domain/mlDataset.ts`) — creates `MLTrainingExample` objects, generates synthetic training datasets (labeled from expert-system scores for development use only), validates training examples, and exports datasets as JSON or CSV.

3. **Baseline deterministic model** (`src/domain/mlModel.ts`) — a weighted linear formula over extracted features that produces a "predicted GCoS" alongside the expert-system GCoS. Completely deterministic and transparent; not a trained classifier.

4. **ML readiness assessment** (`src/domain/mlReadiness.ts`) — evaluates the portfolio against readiness thresholds (prospects, evidence-derived count, labeled examples) and returns a readiness score (0–100), status, missing requirements, and recommendations.

5. **ML Lab page** (`/ml-lab`) — a dedicated UI showing ML readiness, feature extraction preview, baseline prediction comparison table, dataset export buttons, and model status.

6. **ML Readiness Preview on Prospect Detail** — a bottom section on each `/prospects/:id` page showing expert vs. baseline GCoS, agreement, and top factors.

7. **Advisor ML queries** — the Geo AI Advisor answers questions about ML status, training requirements, feature comparison, and ML-ready prospects.

---

## What ML Core v1 Does NOT Do

- **No trained ML model** — there is no classifier, neural network, gradient boosted tree, or any other trained model. The "baseline" is a deterministic weighted formula.
- **No backend training pipeline** — no Python, no Jupyter notebooks, no training server, no inference API.
- **No real LLM** — the Advisor is rule-based pattern matching, not an LLM.
- **No paid APIs** — no external ML service is called.
- **No calibration** — the baseline formula weights are illustrative only, chosen to blend expert-system GCoS with data quality indicators.
- **No guarantee of discovery** — nothing in this module predicts or implies commercial success.
- **Synthetic labels are not real ML ground truth** — labels derived from expert-system GCoS are circular and unsuitable for real model evaluation or claims.

---

## Why There Is No Trained Model Yet

PetroTarget AI does not yet have a **real historical drilling dataset** with ground-truth well outcomes. Training a legitimate ML model for geological chance of success requires:

- Labeled historical records of drilled wells: whether they were discoveries (commercial, technical) or dry holes.
- Enough examples across different basins, play types, and geological settings to generalize.
- The same feature inputs (component scores, evidence quality, data confidence) that the expert system uses today.

Without these labeled outcomes, any "trained" model would be circular (trained on outputs of the very expert system it is meant to augment) or unreliable.

---

## What Data Is Needed for Real ML Training

### Minimum requirements

| Item | Minimum |
|---|---|
| Labeled historical well outcomes | 100 examples |
| Known success/failure outcomes | 50 examples |
| Evidence-derived prospects | 30 examples |

### Outcome labels

| Label | Meaning |
|---|---|
| `commercial_discovery` | Well encountered hydrocarbons at commercial rates |
| `technical_discovery` | Well encountered hydrocarbons, but sub-commercial |
| `dry_hole` | Well encountered no significant hydrocarbons |
| `non_commercial` | Well encountered hydrocarbons but project was not developed |
| `unknown` | Outcome not known or not classifiable |

### Feature inputs needed per well

- All 6 petroleum system component scores (source, migration, reservoir, seal, trap, timing)
- Data confidence at the time of drilling decision
- Prospectivity tier at the time of drilling decision
- Basin and play type
- Evidence assessments (if available from pre-drill reports)
- Economic assumptions used for the FID decision

### Additional attributes (higher quality model)

- Seismic interpretation quality scores
- Well log attributes (porosity, permeability, fluid contacts)
- Geochemical indicators (TOC, Ro, GOR)
- Structural complexity index
- Proximity to known discoveries

---

## Difference Between Expert-System GCoS, Baseline Prediction, and Future ML

| | Expert-System GCoS | Baseline Deterministic v1 | Future Trained ML |
|---|---|---|---|
| **Formula** | `source × migration × reservoir × seal × trap × timing` | Weighted linear blend of 7 features | Trained classifier (e.g., XGBoost, neural net) |
| **Trained?** | No — deterministic formula | No — deterministic formula | Yes — trained on historical outcomes |
| **Ground truth** | Geological judgement (component scores) | Expert-system GCoS + data quality | Historical well outcomes |
| **Calibrated?** | No explicit calibration | No | Yes — evaluated on held-out data |
| **Source of truth?** | **Yes** — use for all targeting and investment decisions | No — development baseline only | Not yet — needs validation |
| **Interpretable?** | Fully — each component is visible | Fully — weights are hardcoded | Partially — depends on model type |

---

## Training Roadmap

### Stage 1: Collect Labeled Dataset
- Source historical well outcome data from company records, public databases, or partner companies.
- Map each historical well to the features defined in `MLFeatureVector`.
- Label each example with an `OutcomeLabel`.
- Validate using `validateTrainingExample()`.
- Export using `exportTrainingDatasetAsJson()` or `exportTrainingDatasetAsCsv()`.

### Stage 2: Feature Export and Inspection
- Use the ML Lab page (`/ml-lab`) to export the current feature vectors.
- Check for data quality issues: missing values, out-of-range features, class imbalance.
- Ensure the training distribution reflects the prospect basins and play types you will predict.

### Stage 3: Train Baseline Classifier
- Train a simple classifier offline (e.g., logistic regression, random forest, XGBoost) on the exported CSV/JSON.
- Use geological chance of success (`geological_success` target) as the first target variable.
- Evaluate with proper train/validation/test split.

### Stage 4: Evaluate and Calibrate
- Report AUC-ROC, precision, recall for discovery vs. dry hole.
- Calibrate predicted probabilities (e.g., Platt scaling) to ensure `predictedGCoS` is a real probability.
- Compare calibrated predicted GCoS to expert-system GCoS on held-out examples.
- Investigate disagreements — they may reveal systematic expert biases or model blind spots.

### Stage 5: Deploy Inference
- Replace the `computeBaselinePrediction` function in `src/domain/mlModel.ts` with an inference call to the trained model.
- Options: ONNX model loaded in-browser, serverless function, or Supabase Edge Function.
- Keep `getMLModelStatus()` updated: set `available: true`, `modelName`, `modelVersion`, `trainedOnExamples`, `lastTrainedAt`.

### Stage 6: Monitor Performance
- Track drift between expert-system GCoS and ML-predicted GCoS over time.
- Re-train periodically as new labeled data becomes available.
- Never allow the ML model to override targeting hard gates (Tier 1 data confidence requirement ≥ 70, drill candidate only through Tier 1).

---

## Feature Vector Reference

See `src/domain/mlTypes.ts` for the full `MLFeatureVector` type definition.

Key features:

| Feature | Type | Source |
|---|---|---|
| `gcosExpert` | float [0,1] | Expert-system GCoS |
| `dataConfidence` | float [0,100] | Scoring engine |
| `evidenceCompleteness` | float [0,1] | Derived from geoscienceAssessment |
| `mainRisk_*` | int {0,1} | One-hot encoding of mainRisk |
| `riskedResource` | float ≥0 | economicAssessment or estimate |
| `simpleEMV` | float | economicAssessment or 0 |
| `prospectivityTierNumeric` | int [0,4] | 0=unknown, 4=Tier1 |
| `isEvidenceDerived` | int {0,1} | scoringMode === 'evidence_derived' |

---

## Limitations

- Synthetic labels are derived from expert-system outputs and are **circular** — they cannot validate the expert system.
- Baseline weights (0.35/0.15/0.10/0.10/0.10/0.10/0.10) are illustrative. They were chosen to give `gcosExpert` strong weight while blending in data quality, not because they are empirically calibrated.
- The `evidenceCompleteness` calculation uses the fraction of non-missing evidence items relative to total items seen. This is a proxy; a better measure would compare against a canonical complete evidence template.
- No uncertainty quantification — the baseline returns a point estimate, not a distribution.
- No domain-specific play-type adjustments.
