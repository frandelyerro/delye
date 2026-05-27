# Petroleum Expert Review 001 — PetroTarget AI v0 Baseline

**Review date:** 2026-05-27
**Reviewer:** Petroleum Expert Agent (PetroTarget AI internal)
**Scope:** Full technical review of the v0 baseline geoscience engine, scoring logic, advisor, explainability module and domain model.
**Framework:** docs/PETROLEUM_EXPERT_REVIEW_PROMPT.md

---

## 1. Technical verdict

**Approve with significant comments.**

The baseline establishes a working GCoS multiplication model with six petroleum system components. The architecture is sound for an MVP. However, several petroleum correctness issues, missing evidence structures and fragile recommendation logic require attention before the engine can be extended to a full targeting workbench.

---

## 2. Petroleum correctness issues

### 2.1 GCoS formula

**Finding: Acceptable for MVP. No change required at this stage.**

`GCoS = sourceScore × migrationScore × reservoirScore × sealScore × trapScore × timingScore`

This follows standard petroleum prospect risking practice (multiplicative independent probability, SPE-PRMS style). The formula is conservative and auditable.

Caveat: In real prospect risking, components are not always independent. Migration depends on source. Trap integrity affects seal. The MVP treats them as independent, which is a standard simplification. This must be documented and reviewed per play in future.

### 2.2 Component scores are pure manual inputs with no evidence backing

**Finding: Critical gap.**

Current scores (e.g. `sourceScore: 0.83`, `reservoirScore: 0.74`) are raw floating-point numbers entered manually. There is no evidence structure behind them:
- No TOC, Ro, or maturity data tied to sourceScore.
- No porosity, permeability, or net pay tied to reservoirScore.
- No fault seal analysis tied to sealScore.
- No closure mapping or seismic confidence tied to trapScore.

A user could enter `sourceScore: 0.95` with no geological justification, producing a high GCoS with zero evidentiary backing. This is a significant overclaiming risk.

### 2.3 Data Confidence calculation is not geologically grounded

**Finding: Needs redesign.**

Current `calculateDataConfidence` in `explainability.ts`:

```typescript
if (prospect.resourceEstimate === 0) score -= 10;
if (prospect.commercialScore === 0) score -= 10;
if (prospect.latitude === 0 || prospect.longitude === 0) score -= 5;
componentNames.forEach((key) => {
  if (Number(prospect[componentMap[key]]) < 0.25) score -= 5;
});
```

Issues:
- Penalizing `resourceEstimate === 0` is a proxy, not a geological measure.
- Penalizing `commercialScore === 0` conflates commercial uncertainty with geological confidence.
- Penalizing score components below 0.25 is circular: a low component score already reflects geological uncertainty; penalizing it again in confidence double-counts the uncertainty.
- Starting from 100 and subtracting produces artificially high confidence for manually-entered prospects with no evidence.

The mock prospects (e.g. Wolfcamp East with all scores > 0.77) would receive Data Confidence of 100 — giving the impression of a highly confident assessment when in reality the scores are manual assumptions with no explicit evidence behind them.

### 2.4 Recommendation does not depend on Data Confidence

**Finding: Required rule violated.**

The checklist requires: `High GCoS + low Data Confidence must not become drill candidate automatically.`

Currently, `getRecommendation` uses only `priority`, which is determined by GCoS and commercialScore. A prospect with GCoS = 0.40 and commercialScore = 80 will receive recommendation `"Advance to detailed technical evaluation / drilling candidate"` regardless of whether its inputs are pure manual assumptions with no evidence.

This is the most important correctness issue in the v0 baseline.

### 2.5 Recommendation set is too coarse

**Finding: Needs extension.**

Three recommendations (`high`, `medium`, `low`) mapped to fixed strings do not distinguish between:
- drill candidate
- acquire additional seismic
- validate reservoir quality
- validate seal continuity
- improve timing model
- farm-in / acreage review
- watchlist
- do not prioritize

A `medium` priority prospect with mainRisk = `reservoir` needs a different next step than one with mainRisk = `timing`. Currently both get the same generic string.

### 2.6 mainRisk is the right concept but lacks nuance

**Finding: Acceptable for MVP, but document limitations.**

`getMainRisk` returns the lowest component score, which is geologically reasonable. The lowest-scoring component is the bottleneck in the multiplicative chain.

However: a component at 0.30 with missing data is different from a component at 0.30 with abundant contrary evidence. The current model cannot distinguish these cases without evidence structures.

---

## 3. Parameter issues

### 3.1 Priority thresholds

Current thresholds:
- High: GCoS >= 0.35 and commercialScore >= 70
- Medium: GCoS >= 0.18
- Low: GCoS < 0.18

**Finding: These are reasonable first-pass industry-style thresholds for MVP.**

In real exploration practice, GCoS of 35% is considered high for a conventional prospect (SPE-PRMS typical ranges are 10–40% for prospects). GCoS of 18% is mid-range. These thresholds are defensible.

However, they are not calibrated against historical outcomes, and they will likely need basin-specific and play-specific adjustment in future.

**Flag:** These thresholds must not be presented to users as industry-standard cutoffs. They are product heuristics.

### 3.2 Component score interpretation

The product does not document what a `sourceScore` of 0.6 vs 0.8 means geologically. A user entering 0.6 without a defined scale is producing meaningless precision.

**Required for next release:** Define component scoring rubrics (0.0–0.20 = very weak, etc.) and document them in PETROLEUM_TECHNICAL_PARAMETERS.md.

---

## 4. Missing evidence / missing model fields

The following are absent from the v0 domain model (`Prospect` type) and must be planned for:

### Source
- `sourceRockPresence`: boolean
- `toc`: number (% wt)
- `ro`: number (% reflectance)
- `keroGenType`: string
- `sourceThickness`: number
- `kitchenDistance`: number

### Migration
- `migrationPathwayKnown`: boolean
- `carrierBedPresent`: boolean
- `showsPresent`: boolean

### Reservoir
- `reservoirPresence`: boolean
- `porosity`: number
- `permeability`: number
- `netPay`: number
- `reservoirAnalogKnown`: boolean

### Seal
- `sealLithology`: string
- `sealThickness`: number
- `faultSealRisk`: 'low' | 'medium' | 'high' | 'unknown'
- `topSealContinuity`: boolean

### Trap
- `trapType`: string
- `closureMapped`: boolean
- `seismicConfidence`: 'high' | 'medium' | 'low' | 'unknown'
- `closureArea`: number
- `closureHeight`: number

### Timing
- `trapFormedBeforeMigration`: boolean | null
- `chargeTimingFavorable`: boolean | null
- `burialHistoryConfidence`: 'high' | 'medium' | 'low' | 'unknown'

### Commercial / Volumetrics
- `targetPhase`: 'oil' | 'gas' | 'condensate' | 'unknown'
- `p50ResourcesMmboe`: number
- `waterDepth`: number (if offshore)
- `infrastructureDistance`: number

### Data provenance
- `scoringMode`: 'manual' | 'evidence_derived'
- `lastReviewedBy`: string
- `lastReviewDate`: string

---

## 5. Recommendation quality

**Finding: Functional but weak.**

The `getAdvisorResponse` function uses keyword matching (`q.includes('top prospects')`) to answer questions. This is fragile:
- Query `"top three prospects"` does not match `"top prospects"` in all cases.
- No answer exists for `"which prospects should we drill first"`.
- No answer exists for `"which prospects are drill candidates"`.
- No answer exists for `"which prospects have high GCoS but low confidence"` — a critical question for targeting.

The fallback response lists available keywords, which is not useful in a production setting.

The advisor responses are factually accurate about GCoS and components, but they do not integrate Data Confidence into the narrative. A response like `"Best prospect is Wolfcamp East with GCoS 40%, main risk seal"` does not mention whether the GCoS is based on well data, seismic, or pure manual assumptions.

---

## 6. Risk of overclaiming

**Current risk level: Medium-High.**

The product currently allows:
1. A user to enter all six component scores manually at high values.
2. The engine to produce a high GCoS from those values.
3. The advisor to present the prospect as `"Advance to detailed technical evaluation / drilling candidate"`.
4. Data Confidence to come out near 100 because none of the simple proxy checks trigger.

This chain can produce a highly confident-sounding recommendation backed by zero geological evidence. While a sophisticated user would understand this, a less experienced user could interpret the output as a technically validated drilling recommendation.

**Required mitigation:**
- Label manually-entered prospects clearly as `scoringMode: 'manual'`.
- Reduce Data Confidence significantly for purely manual prospects.
- Prevent `drill candidate` recommendation when Data Confidence < 60 or when `scoringMode === 'manual'` and no evidence fields are populated.

---

## 7. Required changes before merge to targeting workbench

1. **Redesign Data Confidence** to reflect evidence presence vs. absence per component, not proxy commercial values.
2. **Add `scoringMode` field** (`manual` vs `evidence_derived`) to Prospect type.
3. **Enforce Data Confidence gate on drill candidate recommendation**: high GCoS + low data confidence must not produce drill candidate.
4. **Extend recommendation vocabulary** beyond three strings to align with targeting actions.
5. **Document component scoring rubrics** in PETROLEUM_TECHNICAL_PARAMETERS.md.
6. **Add evidence structure fields** to Prospect (phased: start with trapType, seismicConfidence, faultSealRisk as highest-impact additions).
7. **Add advisor response** for `"drill candidates"`, `"high GCoS low confidence"`, `"farm-in candidates"`.

---

## 8. Suggested future improvements

1. **Per-basin, per-play calibration** of GCoS thresholds and component weights.
2. **Evidence-derived scoring**: infer component scores from structured evidence fields (TOC, Ro, porosity, closure data) rather than manual entry.
3. **Volumetric engine**: P10/P50/P90 resources with GRV, N/G, porosity, Sw, FVF and recovery factor.
4. **Probabilistic GCoS**: Monte Carlo simulation on component distributions rather than point estimates.
5. **Portfolio-level risk analysis**: correlated risk across prospects in the same play or basin.
6. **Targeting map**: prospectivity surface visualization linked to prospect ranking.
7. **Audit trail**: log who entered what score and when, with source references.
8. **Calibration mode**: compare predicted vs. actual outcomes from drilled wells to tune thresholds.

---

## 9. Questions for the product owner

1. Will users be geoscientists who understand GCoS, or non-technical stakeholders? The answer affects how strongly we should guard against overclaiming.

2. Is `commercialScore` intended to represent economic attractiveness, strategic value, or both? It currently combines them in a single 0–100 number without definition.

3. Should the product support multiple phases (oil vs gas vs condensate) with phase-specific GCoS interpretations? The current model is phase-agnostic.

4. Are the mock prospect scores (e.g. Wolfcamp East with all components > 0.77) intentionally high to demonstrate the happy path, or should they reflect a more realistic distribution with lower-confidence prospects?

5. What is the intended audience for the Advisor text? Is it for internal team use, client presentations, or regulatory submissions? This significantly affects the acceptable level of language precision.

6. Will the product be used in real exploration decisions? If so, when do you plan to add a disclaimer framework, evidence traceability and audit trail?

---

*This review is based on petroleum exploration standards and internal PetroTarget AI guardrails.*
*It is not a guarantee of geological correctness.*
*Historical calibration against real drilling outcomes is required to validate these heuristics.*
