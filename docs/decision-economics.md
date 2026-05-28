# Decision Economics — PetroTarget AI

Simple EMV-based decision economics layer that connects GCoS-driven petroleum system risk to exploration investment logic.

---

## Overview

Every scored prospect automatically receives an `EconomicAssessment`. The assessment is deterministic, transparent, and uses configurable per-prospect assumptions (with global portfolio defaults). It is **illustrative only** and does not replace full financial modelling.

---

## EMV Formula

```
Gross Revenue (after royalty) = Resource × Oil Price × (1 − Royalty Rate)

Net Revenue = Gross Revenue × NRI × WI − (Resource × OpEx/bbl × WI)

Total CAPEX = (Development + Exploration Well + Seismic + Lease) × WI

Simple EMV = GCoS × Net Revenue − Total CAPEX
```

Where:
- **Resource** = `resourceEstimate` (MMboe, unrisked)
- **GCoS** = `geologicalChanceOfSuccess` (0–1), never modified by economics
- **NRI** = Net Revenue Interest (default 0.75)
- **WI** = Working Interest (default 1.0)
- **Royalty Rate** (default 0.2)

Operating cost reduces net revenue (it is only incurred on discovery success). CAPEX is committed regardless.

---

## Default Assumptions

| Parameter | Default |
|-----------|---------|
| Oil Price | $75/bbl |
| Gas Price | $3.5/Mcf |
| Development Cost | $350M |
| Exploration Well Cost | $45M |
| Seismic Cost | $12M |
| Lease / Entry Cost | $20M |
| Operating Cost | $18/bbl |
| Net Revenue Interest | 0.75 |
| Working Interest | 1.0 |
| Royalty Rate | 0.20 |

Override any parameter per prospect via **Edit Prospect → Economic Assumptions**.

---

## Economic Grade

| Grade | Condition |
|-------|-----------|
| Strong | EMV ≥ 0 AND EMV / CAPEX ≥ 1.5 AND EMV ≥ $100M |
| Moderate | EMV ≥ 0 AND EMV / CAPEX ≥ 0.5 AND EMV ≥ $20M |
| Weak | EMV ≥ 0 but below Moderate thresholds |
| Negative | EMV < 0 |

---

## Decision Signal

Evaluated strictly in priority order:

| Signal | Condition |
|--------|-----------|
| **do_not_invest** | EMV < 0 OR GCoS < 5% OR Commercial Score < 30 |
| **drill_if_budget_available** | Tier 1 AND Data Confidence ≥ 70 AND EMV > 0 |
| **de_risk_before_investment** | GCoS ≥ 18% AND Data Confidence < 70 |
| **consider_farm_in** | Resource ≥ 150 MMboe AND EMV > 0 AND GCoS ≥ 15% |
| **investigate_further** | Remaining positive-EMV or low-GCoS cases |

**Hard constraint preserved:** `drill_if_budget_available` requires Tier 1 (which requires Data Confidence ≥ 70). High EMV with low data confidence always routes to `de_risk_before_investment`. Economics never override the existing targeting tier or drilling readiness rules.

---

## Integration

Economics are computed at the end of `scoreProspect()` in `src/domain/scoring.ts`, after all GCoS, data confidence, and prospectivity tier values are available. The result is attached as `prospect.economicAssessment`.

The `assessEconomics()` function in `src/domain/economics.ts` is a pure function — given the same prospect and assumptions it always returns the same result.

---

## UI Surface

| Location | What's shown |
|----------|-------------|
| **Prospect Detail** | Full Decision Economics section: EMV, risked/unrisked resources, net revenue, CAPEX, rationale, warnings, assumption override link |
| **Prospect Form** | Collapsible "Economic Assumptions" section with 10 override fields |
| **Targeting Workbench** | Simple EMV column, Decision Signal column, Risked Resources KPI, Positive EMV count KPI |
| **Dashboard** | Simple EMV column and Economic Grade badge in prospect ranking table |

---

## Geo AI Advisor Queries

The following queries are handled by `getAdvisorResponse()`:

- `"positive EMV prospects"` — list prospects with EMV > 0
- `"negative EMV prospects"` — list prospects with EMV < 0
- `"best economic prospect"` or `"highest EMV"` — top prospect by EMV
- `"high resource low GCoS"` — large resource prospects with GCoS < 20%
- `"de-risk before investment"` — prospects in that decision bucket
- `"does [name] look economic"` — individual prospect economics summary
- `"portfolio risked resources"` — total risked vs unrisked
- `"what are the default economic assumptions"` — list all defaults

---

## Limitations

- Uses boe-equivalent pricing (oil price applied to all fluids)
- No time-value-of-money — this is a pre-NPV screening metric
- No probabilistic range — single-point GCoS applied to single-point resource
- Operating cost is simplified as a flat $/boe rate over total unrisked resource
- Results are highly sensitive to resource size and cost assumptions at small scale
