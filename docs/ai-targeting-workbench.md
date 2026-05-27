# AI Targeting Workbench — Technical Documentation

## Overview

The AI Targeting Workbench transforms ranked exploration prospects into actionable exploration decisions. It layers on top of the Geo AI Advisor Core (evidence-derived GCoS, Data Confidence, GeoscienceAssessment) and produces:

- **Prospectivity Tiers** (Tier 1–4) — portfolio segmentation by readiness and confidence
- **Recommended Actions** — one explicit action per prospect, from `drill_candidate` to `do_not_prioritize`
- **Exploration Stage** — maturity classification from `concept_lead` to `appraisal_candidate`
- **Portfolio Intelligence** — executive summary of portfolio state and key recommendations

---

## How This Differs from Geo AI Advisor Core

| Capability | Geo AI Advisor Core | AI Targeting Workbench |
|---|---|---|
| Evidence input | ✅ Structured geological evidence | Reads derived scores |
| GCoS derivation | ✅ Evidence → scores → GCoS | Reads GCoS from scoring engine |
| Data Confidence | ✅ Evidence penalty logic | Reads dataConfidence from scoring engine |
| **Prospect ranking** | Sort by GCoS | ✅ Tier + Action classification |
| **Drill decision** | Not modeled | ✅ `drill_candidate` (with data confidence gate) |
| **Portfolio intelligence** | Rule-based advisor queries | ✅ Structured portfolio summary |
| **Exploration stage** | Not modeled | ✅ concept_lead → appraisal_candidate |

---

## Prospectivity Tiers

Tiers segment the portfolio by investment readiness. Evaluated in order (first match wins).

### Tier 1 — High Prospectivity

All four gates must pass:

| Gate | Threshold |
|---|---|
| GCoS | ≥ 0.35 (35%) |
| Commercial Score | ≥ 70 |
| Data Confidence | ≥ 70/100 |
| Minimum component score | ≥ 0.40 across all 6 components |

A prospect that meets GCoS and commercial criteria but has low Data Confidence is **not** Tier 1. This is the primary guard against overclaiming on low-quality inputs.

### Tier 2 — Moderate Prospectivity

| Gate | Threshold |
|---|---|
| GCoS | ≥ 0.18 (18%) |
| Data Confidence | ≥ 50/100 |

### Tier 3 — Contingent Prospectivity

Either:
- GCoS ≥ 0.10, OR
- resourceEstimate ≥ 100 MMboe (retained in portfolio for scale, even with weak GCoS)

### Tier 4 — Low Prospectivity

Everything else: GCoS < 0.10 with small resource, or commercial score very low.

---

## Recommended Actions

One action is assigned per prospect based on a priority-ordered decision tree.

| Action | Trigger |
|---|---|
| `drill_candidate` | Tier 1 (all gates met, dc ≥ 70) |
| `appraisal_candidate` | Tier 1 + resourceEstimate ≥ 200 MMboe + commercialScore ≥ 80 |
| `acquire_additional_seismic` | GCoS ≥ 0.25 + dc < 50, or mainRisk = trap |
| `validate_reservoir_quality` | mainRisk = reservoir |
| `validate_seal_continuity` | mainRisk = seal |
| `improve_timing_model` | mainRisk = timing |
| `farm_in_candidate` | resourceEstimate ≥ 150 + GCoS ≥ 0.15 |
| `acreage_review` | resourceEstimate ≥ 100 + GCoS ≥ 0.15 |
| `watchlist` | GCoS ≥ 0.10 (with insufficient data or commercial score) |
| `do_not_prioritize` | commercialScore < 30 or GCoS < 0.05 |

### Hard Rule: High GCoS + Low Data Confidence ≠ Drill Candidate

A prospect with GCoS ≥ 0.35 but Data Confidence < 70 is **never** classified as `drill_candidate`. This is enforced structurally: `drill_candidate` is only reachable through Tier 1, which requires dc ≥ 70 as a gate condition.

---

## Exploration Stages

Independent from tiers. Describes geological maturity, not investment readiness.

| Stage | Criteria |
|---|---|
| `concept_lead` | GCoS < 0.10, low resource, sparse data |
| `lead` | GCoS ≥ 0.10 or sufficient resource+dc |
| `prospect` | evidence_derived + dc ≥ 40 + trapScore ≥ 0.40 |
| `drill_ready_candidate` | GCoS ≥ 0.35 + dc ≥ 70 + Tier 1 |
| `appraisal_candidate` | GCoS ≥ 0.35 + dc ≥ 70 + resourceEstimate ≥ 200 + commercialScore ≥ 80 |

---

## How GCoS and Data Confidence Are Used

- **GCoS** is the product of 6 component scores: `source × migration × reservoir × seal × trap × timing`. For evidence-derived prospects it is derived from structured geological evidence. For manual prospects it uses entered float values directly. The formula is unchanged.
- **Data Confidence** measures input quality (0–100). For evidence-derived prospects with all-unknown evidence, a penalty is applied (up to −50). For manual prospects it is based on score completeness only.
- The Workbench reads both values **after** the scoring engine computes them. It does not re-derive or override them.

---

## Modules

### `src/domain/recommendationEngine.ts`

Core targeting logic. Pure functions with no side effects.

- `getProspectivityTier(prospect)` → `ProspectivityTier`
- `getRecommendedAction(prospect)` → `RecommendedAction`
- `getNextBestStep(prospect)` → string
- `getTierRationale(prospect)` → string
- `getRiskFlags(prospect)` → string[]
- `getTargetingRecommendation(prospect)` → `TargetingRecommendation`
- `getPortfolioRecommendations(prospects)` → `TargetingRecommendation[]` (sorted by GCoS)

### `src/domain/earlyExploration.ts`

Exploration maturity classification.

- `getExplorationStage(prospect)` → `ExplorationStage`
- `assessExplorationMaturity(prospect)` → `{ stage, stageLabel, readinessScore, summary }`
- `getDataGaps(prospect)` → string[]
- `getEarlyExplorationRecommendation(prospect)` → string

### `src/domain/portfolioIntelligence.ts`

Portfolio-level aggregation.

- `getPortfolioSummary(prospects)` → `PortfolioSummary`
- `getPortfolioMainRisk(prospects)` → string
- `getTopDrillCandidates(prospects)` → Prospect[]
- `getUncertaintyReductionCandidates(prospects)` → Prospect[]
- `getFarmInCandidates(prospects)` → Prospect[]
- `getHighGCoSLowConfidenceProspects(prospects)` → Prospect[]

---

## UI

### `/targeting` — Petroleum AI Targeting Workbench

- **Portfolio Overview** — 5 KPI cards (total prospects, Tier 1 count, drill candidates, avg. data confidence, main risk)
- **Tier distribution** — 4 tier cards with counts
- **Filters** — basin, play type, scoring mode, tier, action
- **Targeting table** — all prospects with tier, action, next best step
- **Decision buckets** — Drill / Appraisal / De-risk / Farm-in / Watchlist / Do Not Prioritize
- **Portfolio Advisor Summary** — 3–5 executive recommendations

### Dashboard additions

Three new columns appended to the existing Prospect Ranking table:
- Prospectivity Tier (T1–T4 badge)
- Recommended Action (action badge)
- Exploration Stage (text)

### Prospect Detail additions

New **Targeting Recommendation** section above the Geoscience Intelligence Engine section:
- Tier badge, action badge, exploration stage, readiness score
- Rationale, next best step, risk flags

### Advisor extensions

New queries handled:
- `drill candidates` / `where should we drill first`
- `de-risk before drill`
- `farm-in candidates` / `acreage review`
- `tier 1 targets` / `tier 2 targets`
- `high GCoS low data confidence`
- `main portfolio risk`
- `what should we do next as an exploration team`

---

## Limitations

- **Not ML.** All tiers and actions are deterministic heuristic rules, not learned from historical drilling outcomes.
- **No historical calibration.** Tier thresholds (0.35 / 0.18 / 0.10) and Data Confidence gates (70 / 50) are expert-defined, not validated against real-world results.
- **No basin or play specificity.** Rules are uniform across all geological settings.
- **No economic modeling.** NPV, EMV, and risked-resource calculations are not included.
- **No team workflow.** The Workbench produces recommendations but does not manage approval workflows, task assignment, or audit trails.
- **Does not replace technical interpretation.** All recommendations require review by qualified geologists, geophysicists, and reservoir engineers before investment decisions are made.
- **Does not guarantee discoveries.** A `drill_candidate` classification reflects data quality and scoring metrics, not a prediction of commercial success.
