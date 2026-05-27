# Geoscience Intelligence Engine

## What it does

The Geoscience Intelligence Engine is the evidence-derived scoring layer of PetroTarget AI.

It replaces pure manual floating-point inputs with structured geological evidence per petroleum system component, then derives component scores deterministically from that evidence.

The resulting scores feed the same GCoS formula and priority thresholds used by the manual scoring path. No formula, threshold, or mainRisk logic was changed.

## What it does not do

- It is not a machine learning model.
- It does not predict oil discovery.
- It does not replace a geologist, geophysicist or reservoir engineer.
- It does not validate field data or audit geological interpretations.
- It does not have access to real subsurface data, seismic, or well logs.
- It does not guarantee that a "drill candidate" will be productive.

## Manual vs evidence-derived scoring

| Aspect | Manual | Evidence-derived |
|---|---|---|
| Source of scores | User-entered floats (0–1) | Derived from SourceEvidence, MigrationEvidence, etc. |
| Traceability | None | Positive, negative and missing evidence per component |
| Data confidence | Proxy-based (score proxies) | Reflects actual evidence presence |
| Recommendation | Same GCoS / priority path | Same GCoS / priority path |
| Explainability | GCoS formula only | GCoS formula + Evidence Matrix + Recommended Next Data |

A `scoringMode` field distinguishes the two paths:
- `manual`: scores are entered directly
- `evidence_derived`: scores are computed from structured evidence

Manual prospects show a placeholder message in the Geoscience Intelligence Engine section. Switching a prospect to evidence-derived requires adding structured evidence fields.

## How tiers and scores are computed

Each of the six petroleum system components has an `assess*` function:

```
assessSource(SourceEvidence, targetPhase?) → ComponentAssessment
assessMigration(MigrationEvidence)         → ComponentAssessment
assessReservoir(ReservoirEvidence)         → ComponentAssessment
assessSeal(SealEvidence)                   → ComponentAssessment
assessTrap(TrapEvidence)                   → ComponentAssessment
assessTiming(TimingEvidence)               → ComponentAssessment
```

Each function:
1. Assigns a base score from the presence/confidence classification (proven/probable/possible/unknown/absent for most components)
2. Applies additive adjustments from quantitative parameters (TOC, Ro, porosity, permeability, fault seal risk, seismic confidence, etc.)
3. Clamps the result to 0..1
4. Populates `positiveEvidence`, `negativeEvidence` and `missingEvidence` lists
5. Determines `confidence` (high/medium/low/unknown) from evidence completeness

## How GCoS integrates

After deriving the 6 component scores, the engine passes them to the same multiplicative GCoS formula:

```
GCoS = sourceScore × migrationScore × reservoirScore × sealScore × trapScore × timingScore
```

Priority thresholds are unchanged:
- `high`: GCoS >= 0.35 and commercialScore >= 70
- `medium`: GCoS >= 0.18
- `low`: GCoS < 0.18

## How Data Confidence integrates

The existing `calculateDataConfidence` function still runs on the derived scores. For evidence-derived prospects, the `geoscienceAssessment.overallConfidence` field provides a richer confidence signal based on evidence completeness across all 6 components.

## Component scoring rules (heuristic summary)

### Source
- Base: proven 0.90, probable 0.75, possible 0.55, unknown 0.35, absent 0.05
- TOC ≥ 4%: +0.12 | TOC 2–4%: +0.08 | TOC 1–2%: +0.04 | TOC < 0.5%: −0.15
- Ro in oil window (0.6–1.1%): +0.10 | Ro in gas window (1.0–2.0%): +0.10 | Ro < 0.5%: −0.10
- Source thickness ≥ 30m: +0.05 | Kitchen distance > 80km: −0.08

### Migration
- Base: proven 0.85, probable 0.70, possible 0.50, unknown 0.30, unlikely 0.10
- Fault connectivity good: +0.08 | poor: −0.10
- Carrier bed proven: +0.08 | absent: −0.12
- Distance from kitchen > 100km: −0.08

### Reservoir
- Base: proven 0.85, probable 0.70, possible 0.50, unknown 0.30, absent 0.05
- Porosity ≥ 18%: +0.12 | 12–18%: +0.08 | 8–12%: +0.03 | < 8%: −0.12
- Permeability ≥ 100mD: +0.12 | 10–100mD: +0.08 | 1–10mD: +0.03 | < 1mD: −0.12
- Net pay ≥ 10m: +0.06 | Vshale > 35%: −0.08
- Continuity good: +0.05 | poor: −0.08

### Seal
- Base: proven 0.85, probable 0.70, possible 0.50, unknown 0.30, absent 0.05
- Salt/evaporite: +0.10 | Shale: +0.07 | Mudstone: +0.04 | Other: −0.15
- Thickness ≥ 30m: +0.06
- Fault seal risk low: +0.05 | **high: −0.20**

### Trap
- Base: closure mapped 0.70, not mapped 0.30
- Structural/combination/subsalt type: +0.07 | Unknown type: −0.10
- Closure area ≥ 20km²: +0.05 | Closure height ≥ 50m: +0.05
- Seismic confidence high: +0.10 | low: −0.10 | unknown: −0.05

### Timing
- Base: yes 0.85, likely 0.70, uncertain 0.45, unlikely 0.20, no 0.05
- Charge timing favorable: +0.08 | possible: +0.04 | **unfavorable: −0.20**
- Burial history confidence high: +0.05 | low/unknown: −0.08

## Limitations of this MVP

1. **Heuristic rules, not calibrated ML.** All scoring adjustments are expert-system rules, not trained against historical drilling outcomes.
2. **No basin or play specificity.** The same rules apply to a Permian unconventional as to a North Sea deepwater structural. Real calibration needs per-basin, per-play tuning.
3. **Point estimates, not distributions.** Components produce a single score, not a P10/P50/P90 range.
4. **Missing volumetrics.** There is no GRV / N/G / saturation / FVF / recovery factor model. Resource estimates remain user-provided.
5. **No charge volume.** The engine assesses charge pathway quality but not charge volume (expulsion efficiency, migration losses, trap fill).
6. **No pressure or phase modeling.** Hydrocarbon phase, reservoir pressure, overpressure risk are not represented.
7. **No analog calibration.** The system cannot yet incorporate analog field data to validate the heuristics.

## How calibration would work in future

To move from heuristic to calibrated:

1. Collect a dataset of drilled wells with known outcomes (discovery, dry hole, appraisal) and their pre-drill input parameters.
2. For each drilled well, compare the predicted component score and GCoS against the outcome.
3. Adjust base scores, adjustment deltas and thresholds by basin and play type to minimize prediction error.
4. Repeat as new wells are drilled.

This calibration step transforms the engine from an expert system into a statistically grounded risk model.
