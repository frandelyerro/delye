# Norway Sokkeldirektoratet FactPages Adapter

## Overview

The Norway FactPages Adapter (`src/domain/norwayFactpagesAdapter.ts`) converts CSV exports from [Sokkeldirektoratet FactPages](https://sdp.factpages.npd.no) (Norwegian Petroleum Directorate public data portal) into PetroTarget AI's 28-column ML import schema.

The adapter is automatically detected in the ML Lab Import section when a wellbore_exploration_all CSV is uploaded. No manual column mapping is required for the primary file.

**Important**: FactPages does not include pre-drill geological scores. All six GCoS component scores (source, migration, reservoir, seal, trap, timing) default to 0.5, and GCoS defaults to 0.015625. These defaults cannot substitute for real expert-system scoring and should be updated manually per prospect after import.

---

## Source Data

Download CSV exports from: **sdp.factpages.npd.no** (Norwegian Sokkeldirektoratet public portal, English interface)

### Primary file (required)

| File | Content | Adapter use |
|---|---|---|
| `wellbore_exploration_all.csv` | All exploration wellbore records with coordinates, HC content, play, operator, licence | Primary wellbore rows — field mapping and outcome derivation |

### Enrichment files (optional)

Uploading optional enrichment files improves outcome label accuracy and resource estimates:

| File | Content | Enrichment effect |
|---|---|---|
| `discovery.csv` | Discovery name, activity status, HC type, associated field, NPDID discovery | Upgrades outcome from technical to commercial where field is confirmed or production is active |
| `discovery_reserves.csv` | Rec. oil eq. [mill OE] by phase and recovery category | Fills `resource_estimate_mmboe` from proven + probable reserves |
| `discovery_description.csv` | Discovery text descriptions | Adds well description to prospect notes |
| `field.csv` | Field name, activity status, HC type, NPDID field | Confirms commercial status when wellbore is linked to an active producing field |

---

## Automatic Dataset Detection

The adapter detects the Norway wellbore format by checking for these required headers:

- `Wellbore name`
- `Content`
- `Main area`
- `NS decimal degrees`
- `EW decimal degrees`
- `NPDID wellbore`

When detected, the ML Lab Import section shows the **Norway FactPages Detected** banner with optional enrichment file upload slots and a "Convert using Norway adapter" button.

---

## Field Mapping

| PetroTarget column | Source column | Fallback |
|---|---|---|
| `prospect_id` | `NPDID wellbore` | `norway-{normalized-name}` |
| `prospect_name` | `Wellbore name` → `Well name` | `Norway wellbore {NPDID}` |
| `basin` | `Main area` | `Norwegian Continental Shelf` |
| `country` | — | `Norway` (always) |
| `block` | `Production licence at wellhead` | — |
| `play_type` | `Purpose` | `Offshore exploration` |
| `latitude` | `NS decimal degrees` | — |
| `longitude` | `EW decimal degrees` | — |
| `scoring_mode` | — | `manual` (always) |
| `target_variable` | — | `hydrocarbon_presence` (always) |
| `data_source` | — | `Sokkeldirektoratet FactPages` (always) |
| `is_synthetic` | — | `false` (always) |
| `source_score` … `timing_score` | — | `0.5` (all six, see limitations) |
| `gcos_expert` | — | `0.015625` (product of six 0.5 scores) |
| `main_risk` | — | `source` (default, update after import) |
| `data_confidence` | — | `50` |

---

## Outcome Derivation

### Primary derivation (from `Content` column)

| `Content` value | `outcome_label` | `result_confidence` |
|---|---|---|
| `DRY` | `dry_hole` | `high` |
| `OIL`, `GAS`, `OIL/GAS`, `GAS/CONDENSATE`, `CONDENSATE`, `OIL/GAS/CONDENSATE`, `OIL/CONDENSATE`, `GAS/OIL` + associated field | `commercial_discovery` | `high` |
| Same HC values + associated discovery (no field) | `technical_discovery` | `high` |
| Same HC values + no discovery or field | `technical_discovery` | `medium` |
| `OIL SHOWS`, `GAS SHOWS`, `OIL/GAS SHOWS`, `SHOWS`, `TRACES` | `non_commercial` | `medium` |
| All other or blank | `unknown` | `low` |

**DRY outcomes are never overridden by enrichment data.**

### Discovery enrichment (applied when discovery CSV is provided)

| Discovery status condition | Upgrade to |
|---|---|
| `Producing`, `Shut down`, `PDO approved`, included in field (field reference present) | `commercial_discovery` |
| Description contains "production is unlikely" | `non_commercial` |
| Status contains "clarification" or "evaluation" + HC-bearing content | `technical_discovery` |

### Field enrichment (applied when field CSV is provided)

When the wellbore's `NPDID field` matches a field record, the outcome is upgraded to `commercial_discovery` (unless the outcome was `dry_hole`).

---

## Resource Mapping

When a reserves CSV is provided, the adapter looks up the discovery associated with the wellbore:

- Preferred: rows with recovery type index 0 or 1 (proven + probable)
- Fallback: row with the largest `Rec. oil eq. [mill OE]` value
- Conversion: Norwegian million OE → MMboe (1:1)

The result fills `resource_estimate_mmboe`.

---

## Commercial Score Defaults

| Outcome | Resource present | `commercial_score` |
|---|---|---|
| `commercial_discovery` | Yes | 85 |
| `commercial_discovery` | No | 80 |
| `technical_discovery` | Yes | 65 |
| `technical_discovery` | No | 60 |
| `non_commercial` | — | 45 |
| `dry_hole` | — | 25 |
| `unknown` | — | 50 |

---

## Boolean Outcome Columns

Derived automatically from `outcome_label`:

| outcome_label | hydrocarbon_present | geological_success | commercial_success |
|---|---|---|---|
| `commercial_discovery` | true | true | true |
| `technical_discovery` | true | true | false |
| `non_commercial` | true | false | false |
| `dry_hole` | false | false | false |
| `unknown` | false | false | false |

---

## Validation

After conversion, the standard 28-column import validation runs on the converted rows. In addition, the adapter emits:

- **Info**: One info message per row describing the outcome derivation basis (wellbore-only, or discovery/field enriched)
- **Warning**: "Geoscience component scores were defaulted because the Norway FactPages wellbore export does not include pre-drill source/reservoir/seal/trap/timing risking." — emitted once per batch when no enriched scores are available
- **Critical**: Only from standard import validation (e.g., invalid coordinates)

---

## Limitations

1. **No pre-drill geological scores**: All six component scores default to 0.5. GCoS defaults to 0.015625 — this is the arithmetic product but does not reflect real geological risking. Update scores manually per prospect after import.

2. **Outcome accuracy**: Outcome labels are inferred from the `Content` field and discovery/field status. Some wells with ambiguous content (e.g., shows in an unclassified play) will be labeled `unknown`.

3. **No GCoS or target_variable calibration**: Imported rows use `target_variable = hydrocarbon_presence`, which reflects whether hydrocarbons were encountered. For commercial ML training purposes you may need to adjust `target_variable` and `commercial_score` per row.

4. **Excel format not supported**: Sokkeldirektoratet FactPages provides Excel exports (.xlsx). Save each sheet as CSV (File → Save As → CSV UTF-8) before uploading to ML Lab. The adapter does not read .xlsx files because adding SheetJS would increase the bundle by ~400–700 KB.

5. **Coordinate system**: Coordinates are imported as-is from the `NS decimal degrees` and `EW decimal degrees` columns. Verify that coordinates are in WGS-84 decimal degrees before importing.

6. **Reserve estimates may be outdated**: The reserves dataset reflects the most recent Sokkeldirektoratet estimate, which may differ from operator-reported reserves.

---

## Step-by-Step Usage

1. Go to **sdp.factpages.npd.no** (Sokkeldirektoratet FactPages).
2. Download `wellbore_exploration_all` (Excel → save as CSV UTF-8).
3. Optionally download `discovery`, `discovery_reserves`, `discovery_description`, `field` sheets and save each as CSV.
4. Open PetroTarget AI → **ML Lab** → scroll to **Import Historical Dataset**.
5. Click **Select CSV file** and choose the wellbore CSV.
6. The **Norway FactPages Detected** banner appears automatically.
7. Optionally upload enrichment CSVs in the labeled slots.
8. Click **Convert using Norway adapter**.
9. Review the validation summary — check for critical issues and warnings.
10. Click **Import valid rows into portfolio** to merge wells into the prospect portfolio.
11. Open each imported prospect in the **Edit Prospect** form and update geological scores with real expert input.

---

## Related Documentation

- [ML Dataset Import](./ml-dataset-import.md) — 28-column schema, validation rules, readiness score
- [ML Core](./ml-core.md) — Feature extraction, baseline model, readiness assessment
- [Geoscience Engine](./geoscience-engine.md) — GCoS formula and evidence-derived scoring
