# PetroTarget AI — Guardrails for MVP Core

Scope: Entire repository.

## Product stage and boundaries
- This repository is in **functional QA stage** for the frontend MVP.
- Do **not** add backend, authentication, payments, or production ML in this stage.
- Keep positioning conservative: decision intelligence tool, no automatic petroleum discovery claims.

## Core scoring invariants (must not change unless explicitly requested)
- `GCoS = sourceScore * migrationScore * reservoirScore * sealScore * trapScore * timingScore`
- Priority thresholds:
  - `high` if `GCoS >= 0.35` and `commercialScore >= 70`
  - `medium` if `GCoS >= 0.18`
  - `low` otherwise
- `mainRisk` must stay union-typed as:
  - `'source' | 'migration' | 'reservoir' | 'seal' | 'trap' | 'timing'`

## Data and validation expectations
- Prospect required fields: `id`, `name`, `basin`, `block`, `playType`.
- Geological component scores are bounded `[0, 1]`.
- `commercialScore` bounded `[0, 100]`.
- `resourceEstimate >= 0`, `latitude` in `[-90, 90]`, `longitude` in `[-180, 180]`.
- CSV and JSON import behavior should remain consistent (normalize + validate + clear row-level errors).

## UX and claims
- Allowed style: sober B2B language.
- Keep approved phrases like:
  - "Decision intelligence for petroleum exploration"
  - "Explainable petroleum system scoring"
- Avoid exaggerated or deterministic claims about finding hydrocarbons.
