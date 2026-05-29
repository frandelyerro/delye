# ML Outcomes v1

This document describes the ML Outcomes v1 feature for PetroTarget AI: historical outcome tracking to build a real supervised ML training dataset.

---

## What ML Outcomes v1 Does

ML Outcomes v1 adds **historical well outcome recording** to each prospect, enabling the construction of a real supervised ML training dataset without requiring a pre-existing labeled database.

1. **Canonical outcome types** (`src/domain/outcomes.ts`) — defines `OutcomeLabel`, `ProspectOutcome`, and 5 helper functions (`isKnownOutcome`, `isGeologicalSuccess`, `isCommercialSuccess`, `getOutcomeLabelText`, `getOutcomeSummary`).

2. **Extended `Prospect` type** — adds an optional `outcome?: ProspectOutcome` field. Existing prospects are unaffected.

3. **Real training dataset export** (`src/domain/mlDataset.ts`) — `createTrainingDatasetFromOutcomes(prospects)` produces `MLTrainingExample[]` from prospects with known outcomes. Excludes prospects with `label: 'unknown'`.

4. **Real ML readiness counting** (`src/domain/mlReadiness.ts`) — `labeledExamples` and `knownSuccessFailureCount` are now counted from `prospect.outcome` instead of being hardcoded to 0. The `MLReadinessResult` type is extended with `knownSuccessFailureCount`.

5. **Supabase mapping** (`src/services/prospectRepository.ts`) — `outcome` is persisted as a JSONB column alongside `evidence` and `economic_assumptions`. Mapping handles nullable deserialization.

6. **Historical Outcome form section** (`/prospects/:id/edit`) — collapsible section in the Edit/New Prospect form with fields: outcome label, target variable, result confidence, data source, well name (optional), drill year (optional), operator (optional), notes (optional). A warning clarifies this does not affect GCoS or targeting.

7. **Historical Outcome on Prospect Detail** (`/prospects/:id`) — displays the recorded outcome (label, target variable, confidence, source, optional well/year/operator/notes). Shows a green callout when the outcome is included in the real training dataset. Shows a prompt to add an outcome when none is recorded.

8. **Updated ML Lab page** (`/ml-lab`) — shows real labeled example count and known success/failure count. Dataset Export section has 4 buttons: Export Real Training Dataset JSON, Export Real Training Dataset CSV (enabled only when real outcomes exist), Export Synthetic Training Dataset JSON, Export Synthetic Training Dataset CSV. Shows a breakdown of recorded outcome labels.

9. **Updated Advisor** (`src/domain/advisor.ts`) — 5 new outcome queries: prospects with outcomes, labeled example count, can we train (with outcome context), dry hole prospects, commercial discoveries.

---

## What ML Outcomes v1 Does NOT Do

- **No trained ML model** — recording outcomes does not train a model. A training pipeline is still required (see `docs/ml-core.md`).
- **No outcome validation against GCoS** — outcomes are stored as-is. No cross-check between recorded label and expert-system GCoS.
- **No automatic labeling** — outcomes must be entered manually per prospect in the Edit form.
- **No backend outcome API** — outcomes persist to the same JSONB column in Supabase or localStorage as the rest of the prospect.
- **Synthetic labels are unchanged** — the synthetic dataset (derived from expert scores) still exists and is still marked `source: 'synthetic'`.

---

## Outcome Labels

| Label | Meaning |
|---|---|
| `commercial_discovery` | Well encountered hydrocarbons at commercial rates |
| `technical_discovery` | Well encountered hydrocarbons, but sub-commercial |
| `dry_hole` | Well encountered no significant hydrocarbons |
| `non_commercial` | Well encountered hydrocarbons but project was not developed |
| `unknown` | Outcome not known — excluded from real training dataset |

---

## ProspectOutcome Type

```typescript
type ProspectOutcome = {
  label: OutcomeLabel;
  targetVariable: 'geological_success' | 'commercial_success' | 'hydrocarbon_presence';
  wellName?: string;
  drillYear?: number;
  operator?: string;
  resultConfidence: 'high' | 'medium' | 'low';
  source: 'historical' | 'synthetic' | 'manual';
  notes?: string;
};
```

---

## ML Readiness Thresholds

The `assessMLReadiness` function now counts real outcomes:

| Threshold | Requirement |
|---|---|
| `labeledExamples >= 100` | Known outcomes (any label except `unknown`) |
| `knownSuccessFailureCount >= 50` | Discoveries (commercial + technical) + dry holes |
| `evidenceDerivedCount >= 30` | Prospects with `scoringMode === 'evidence_derived'` |

All three must be met for `status: 'ready_for_training'`.

---

## Supabase Schema Update

Add the `outcome` column to the `prospects` table:

```sql
alter table public.prospects add column if not exists outcome jsonb;
```

The column stores the full `ProspectOutcome` object as JSONB, nullable. Existing rows have `outcome = null`.

---

## Helper Functions

| Function | Signature | Returns |
|---|---|---|
| `isKnownOutcome` | `(outcome) => boolean` | `true` if label ≠ `'unknown'` |
| `isGeologicalSuccess` | `(outcome) => boolean` | `true` if commercial or technical discovery |
| `isCommercialSuccess` | `(outcome) => boolean` | `true` if commercial discovery only |
| `getOutcomeLabelText` | `(label) => string` | Human-readable label text |
| `getOutcomeSummary` | `(outcome) => string` | One-line summary with optional well/year/operator |

---

## Limitations

- Outcomes are entered manually and are subject to human error. No validation against external databases.
- `resultConfidence` is self-reported — no objective reliability metric.
- `source: 'manual'` entries are treated the same as `'historical'` in the training export. Users should prefer `'historical'` for company-record-backed data.
- A prospect can have at most one outcome. To record multiple well outcomes for the same structural prospect, create separate prospects per well.
- The training export does not enforce a minimum class balance. Check class distribution before training.

---

## Next Steps

1. Record real historical outcomes for as many drilled prospects as possible.
2. Export the real training dataset from the ML Lab page.
3. Inspect for class imbalance (discoveries vs. dry holes).
4. Follow the training roadmap in `docs/ml-core.md` (Stage 1 → Stage 6).
