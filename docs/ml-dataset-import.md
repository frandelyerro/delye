# ML Dataset Import

## Overview

The ML Dataset Import module (`src/domain/mlDatasetImport.ts`) provides CSV parsing, schema validation, and prospect conversion for historical petroleum exploration datasets. It allows exploration teams to load real drilling outcome data into PetroTarget AI to support future ML model training.

**Important**: Importing historical data does NOT train a model. It populates the prospect portfolio with labeled outcomes that can later be exported as a feature matrix for external training pipelines. No trained ML model is connected to PetroTarget AI yet.

---

## CSV Format

### Required Columns (28)

All 28 columns must be present in the CSV header row. Missing any required column produces a **critical** validation error and blocks the import.

| Column | Type | Allowed Values |
|---|---|---|
| `prospect_id` | string | Any non-empty identifier |
| `prospect_name` | string | Any non-empty name |
| `basin` | string | Basin name (e.g., "Neuquén", "Permian") |
| `country` | string | Country name |
| `block` | string | Block / license area |
| `play_type` | string | e.g., "Structural", "Stratigraphic" |
| `latitude` | float | –90 to 90 |
| `longitude` | float | –180 to 180 |
| `source_score` | float | 0.0 – 1.0 |
| `migration_score` | float | 0.0 – 1.0 |
| `reservoir_score` | float | 0.0 – 1.0 |
| `seal_score` | float | 0.0 – 1.0 |
| `trap_score` | float | 0.0 – 1.0 |
| `timing_score` | float | 0.0 – 1.0 |
| `gcos_expert` | float | 0.0 – 1.0 |
| `main_risk` | string | `source`, `migration`, `reservoir`, `seal`, `trap`, `timing` |
| `data_confidence` | integer | 0 – 100 |
| `resource_estimate_mmboe` | float | ≥ 0 |
| `commercial_score` | float | 0 – 100 |
| `scoring_mode` | string | `manual`, `evidence_derived` |
| `outcome_label` | string | `commercial_discovery`, `technical_discovery`, `dry_hole`, `non_commercial`, `unknown` |
| `target_variable` | string | `geological_success`, `commercial_success`, `hydrocarbon_presence` |
| `hydrocarbon_present` | boolean | `true`, `false` |
| `geological_success` | boolean | `true`, `false` |
| `commercial_success` | boolean | `true`, `false` |
| `result_confidence` | string | `high`, `medium`, `low` |
| `data_source` | string | `historical`, `synthetic`, or any label |
| `is_synthetic` | boolean | `true`, `false` |

### Optional Geology Columns

Including these columns adds geochemical and petrophysical attributes to the imported prospects:

`toc_percent`, `ro_percent`, `tmax_c`, `porosity_percent`, `permeability_md`, `seal_thickness_m`, `closure_area_km2`

### Post-Drill Leakage Columns (WARNING)

The following columns are measured **after** drilling and must NOT be used as ML input features. The validator emits a warning if it detects these columns in your CSV:

`actual_net_pay_m`, `actual_porosity_percent`, `actual_permeability_md`, `actual_initial_rate_bopd`, `actual_reserves_mmboe`, `actual_recoverable_resource_mmboe`, `actual_development_status`

Including post-drill measurements as ML inputs causes data leakage: the model would learn from information that is only available after the well is drilled, producing falsely optimistic performance estimates.

---

## Validation Rules

### Critical Issues (block import)

- Missing required column in the header
- Invalid `latitude` (outside –90 to 90) or `longitude` (outside –180 to 180)
- Non-numeric coordinate values
- Component score (`source_score` … `timing_score`, `gcos_expert`) outside [0, 1]
- `data_confidence` or `commercial_score` outside [0, 100]
- `resource_estimate_mmboe` below 0
- Unrecognised `outcome_label` (not one of the five allowed values)
- Unrecognised `target_variable`

Rows with any critical issue are excluded from the import. The readiness score is set to 0 when any column-level critical issue exists.

### Warnings (do not block import)

- `outcome_label = unknown` — row has no usable training label
- `is_synthetic = true` — row is artificially generated; not suitable for real training claims
- No dry holes in the dataset — class imbalance will make training unreliable
- Post-drill leakage columns detected in the header

---

## Synthetic Data Warning

Rows with `is_synthetic = true` are assigned `outcome.source = 'synthetic'` in the imported `Prospect` object. These rows:

- **Do** count toward the total prospect count and portfolio statistics
- **Do NOT** count as real training examples for ML
- Are flagged with a warning during validation
- Are clearly distinguished in the import summary

The synthetic label rules used internally (GCoS ≥ 0.35 + commercialScore ≥ 70 → commercial_discovery, etc.) are for development purposes only and cannot substitute for real historical drilling outcomes.

---

## Import Behavior

1. **Parse**: PapaParse reads the CSV with trimmed headers and skips empty rows.
2. **Validate**: Schema-level checks (required columns, post-drill leakage) run first; then per-row checks.
3. **Preview**: Up to 10 rows are shown in the validation summary; the full count is reported.
4. **Convert**: Valid rows are mapped to `Prospect` objects. `scoreProspect` regenerates derived fields (GCoS, priority, prospectivity tier) after mapping — it does NOT reuse the CSV `gcos_expert` value as the final GCoS.
5. **Import**: On confirmation, `useProspectStore.importProspects()` merges non-duplicate prospects by ID and persists to localStorage.

### Duplicate Handling

If an imported row's `prospect_id` matches an existing prospect in the store, the row is skipped (not overwritten). The import summary reports the `skippedDuplicates` count.

---

## Readiness Score

The readiness score (0–100) assesses how useful the imported dataset is for ML training:

```
readinessScore =
  (validRows / totalRows) × 40
  + min(labeledRows / 100, 1) × 30
  + (dryHoleCount > 0 ? 15 : 0)
  + (discoveryCount > 0 ? 15 : 0)
```

| Score | Interpretation |
|---|---|
| 0–20 | Not ready — too many invalid rows or no labels |
| 21–50 | Partial — more historical data needed |
| 51–80 | Baseline-ready — sufficient for development testing |
| 81–100 | Training-ready — good coverage, balance, and labeling |

A score of 100 requires: all rows valid, ≥ 100 labeled rows, at least one dry hole, at least one discovery.

---

## Templates

Two CSV templates are available from the ML Lab page:

- **Minimum template**: All 28 required columns with one example data row.
- **Recommended template**: Required columns + optional geology columns (`toc_percent`, `porosity_percent`, etc.) with one example row.

Download the template, fill in your historical data, and upload to ML Lab for validation.

---

## Limitations

- No trained ML model is connected yet. Importing data does not trigger training.
- The import only merges new prospect IDs. Existing prospects are never overwritten.
- The GCoS in the CSV (`gcos_expert`) is stored as metadata but the system recomputes GCoS from the six component scores using the standard formula.
- The import does not validate basin/play-type lists — any string is accepted.
- Optional geology columns are currently stored as metadata; they are not used in the baseline ML feature vector (v1).

---

## Related Documentation

- [ML Core](./ml-core.md) — Feature extraction, baseline model, and readiness assessment
- [ML Outcomes](./ml-core.md#outcomes) — Prospect outcome labels and target variables
- [Decision Economics](./decision-economics.md) — EMV and risked resource calculations
- [Geoscience Engine](./geoscience-engine.md) — GCoS formula and evidence integration

---

## Using Imported Data for Model Training

Imported rows that carry a real `outcome_label` (≠ `unknown`) and `is_synthetic = false` become labeled training examples for the **ML Training Baseline** (see [ml-training-baseline.md](./ml-training-baseline.md)). After importing:

1. Open **ML Lab → Train Baseline ML Model**.
2. The pre-training panel shows how many labeled examples, positives, and negatives the import produced.
3. Train once at least 30 labeled examples are available (100+ recommended, with both discoveries and dry holes).

Only the leakage-safe pre-drill columns are used as model **inputs**; `outcome_label`, the post-drill leakage columns, reserves, and economics are used for **labels/evaluation only**, never as features. This preserves the same leakage protection enforced during import validation.
