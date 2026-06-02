# ML Column Mapping

## Why Mapping Is Needed

Real petroleum datasets from national regulators, public repositories, and internal databases use different column names than PetroTarget AI's required ML import schema. A Norwegian well dataset might name the well identifier `wlbwellborename`; an Australian dataset might call coordinates `lat` and `lon`; a UK North Sea dataset might use `well_result` for the drilling outcome.

The Column Mapping step lets you upload any CSV and connect its column names to the PetroTarget schema before validation and import.

---

## The 4-Step Import Flow

1. **Upload CSV** — Parse headers, auto-suggest mappings, select a preset
2. **Map Columns** — Review and adjust the source→target column table
3. **Validate** — Run schema validation on the mapped rows
4. **Import** — Confirm and merge valid rows into the portfolio

You can go back from Step 3 to Step 2 to adjust mappings if validation finds issues.

---

## Required vs Defaultable Fields

### Never defaulted — must be mapped (critical if missing)

| Column | Description |
|---|---|
| `prospect_id` | Unique identifier for the well/prospect |
| `prospect_name` | Human-readable name |
| `basin` | Geological basin |
| `country` | Country name |
| `play_type` | Petroleum play type |
| `latitude` | Surface latitude (WGS84, −90 to 90) |
| `longitude` | Surface longitude (WGS84, −180 to 180) |
| `outcome_label` | Drilling outcome (see normalization table below) |

### Defaulted automatically if unmapped

| Column | Default value | Notes |
|---|---|---|
| `scoring_mode` | `manual` | |
| `target_variable` | `geological_success` | |
| `result_confidence` | `medium` | |
| `data_source` | `manual_entry` | |
| `is_synthetic` | `false` | |
| `commercial_score` | `50` | |
| `resource_estimate_mmboe` | `0` | |
| `data_confidence` | `50` or `30` | 50 if ≥ 5 required fields mapped; 30 otherwise |

### Score defaults (only when no component scores are mapped)

If none of the six component scores (`source_score`, `migration_score`, `reservoir_score`, `seal_score`, `trap_score`, `timing_score`) are mapped, they are all defaulted to `0.5` and `gcos_expert` to `0.35`. A **warning** is shown:

> "Component scores were defaulted because source dataset did not include geoscience risking. Results are development-only until real scores are provided."

Defaulted scores produce unreliable GCoS values. Collect geoscience risking assessments and re-import with real scores before using for ML training or portfolio analysis.

### Derived boolean columns

If `outcome_label` is mapped and the boolean columns (`hydrocarbon_present`, `geological_success`, `commercial_success`) are not mapped, they are derived automatically:

| Outcome label | hydrocarbon_present | geological_success | commercial_success |
|---|---|---|---|
| `commercial_discovery` | true | true | true |
| `technical_discovery` | true | true | false |
| `dry_hole` | false | false | false |
| `non_commercial` | true | false | false |
| `unknown` | unknown | unknown | unknown |

---

## Common Column Aliases

The auto-map feature recognizes these aliases (case-insensitive, spaces/hyphens normalized to underscores):

| PetroTarget target | Recognized aliases |
|---|---|
| `prospect_id` | well_id, wellbore_id, borehole_id, id, prospectid |
| `prospect_name` | well_name, wellbore_name, borehole_name, name |
| `basin` | basin_name, geological_basin |
| `country` | nation |
| `play_type` | play, petroleum_play, reservoir_play |
| `latitude` | lat, y, surface_latitude |
| `longitude` | lon, lng, x, surface_longitude |
| `outcome_label` | result, well_result, exploration_result, final_status, discovery_status, hole_status |
| `data_source` | source, dataset_source, origin |
| `is_synthetic` | synthetic, synthetic_flag |

For columns not in this list (e.g., `source_score`, `seal_score`), only an exact normalized name match is attempted.

---

## Outcome Value Normalization

The `normalizeExternalValue` function converts common petroleum result strings to PetroTarget's outcome labels (case-insensitive):

| Input value | PetroTarget outcome_label |
|---|---|
| dry, dry hole, dry_hole, plugged and abandoned, p&a dry, abandoned dry | `dry_hole` |
| commercial discovery, producing discovery, field discovery, producer, producing | `commercial_discovery` |
| discovery, hydrocarbon discovery, oil discovery, gas discovery, discovery non-producing | `technical_discovery` |
| non commercial, non-commercial, subcommercial, uneconomic discovery | `non_commercial` |
| unknown, confidential, suspended, not available, blank, unrecognized | `unknown` |

Boolean fields (`hydrocarbon_present`, `geological_success`, `commercial_success`):
- `yes / y / true / 1` → `true`
- `no / n / false / 0` → `false`
- `unknown / blank` → `unknown`

---

## Preset Mappings

Five preset column mappings are available as starting points. **All are best-effort — always verify column names against your actual dataset before importing.**

| Preset | Covers |
|---|---|
| **Generic Well Dataset** | Common aliases: well_id, well_name, basin_name, result |
| **NSTA-like (UK North Sea)** | wellbore_name, surface_latitude/longitude, well_result |
| **NOPIMS-like (Australia)** | wellbore_id, lat/lon, exploration_result |
| **NPD-like (Norway)** | wlbwellborename, wlbnsutmdeg/wlewutmdeg, wlbdisconame |
| **NLOG-like (Netherlands)** | well_id, y_coord/x_coord, status |

Preset column names are modeled from publicly documented formats but may not match the exact column names in the current version of each regulator's dataset.

---

## Post-Drill Leakage Reminder

Do not map post-drill measurement columns as ML input features. These columns are only available after drilling:

`actual_net_pay_m`, `actual_porosity_percent`, `actual_permeability_md`, `actual_initial_rate_bopd`, `actual_reserves_mmboe`, `actual_recoverable_resource_mmboe`, `actual_development_status`

Including these as predictive inputs causes data leakage — the model would learn from information unavailable at prediction time and produce falsely optimistic performance estimates. The import validator will warn if it detects these column names.

---

## Limitations

- Users must review all column mappings before importing — auto-map and presets are starting points, not guaranteed correct
- Defaulted geoscience component scores (0.5 each) are weak and development-only; they do not reflect real geological risking
- No trained ML model is connected — importing data does not trigger training
- CSV input only; no direct API integration with regulator databases
- No backend storage — imported data persists to localStorage only
- Preset mappings are best-effort and may not match current regulator schema versions

---

## Related Documentation

- [ML Dataset Import](./ml-dataset-import.md) — CSV format, validation rules, required columns, readiness score
- [ML Core](./ml-core.md) — Feature extraction and baseline model
- [ML Outcomes](./ml-outcomes.md) — Prospect outcome labels
