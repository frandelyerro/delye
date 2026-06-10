# PetroTarget AI — Guardrails for MVP Core

Scope: Entire repository.

## Product stage and boundaries
- This repository is in **functional QA stage** for the frontend MVP.
- Do **not** add backend, authentication, payments, or production ML in this stage.
- Keep positioning conservative: decision intelligence tool, no automatic petroleum discovery claims.

## Autonomous agent operating policy
- Agents (via `/advance` and specialist sub-agents) have **full latitude to propose
  improvements** to the project: architecture, features, UX, ML scaffolding, geospatial
  data, docs, tests.
- **Default workflow for ordinary changes**: implement, run
  `npm run typecheck && npm run test && npm run build` (must pass), commit, push to a
  branch, and open a PR against `main` for review.
- **Core scoring/geoscience methodology** (the invariants below): proposed changes must
  include a clear write-up of:
  1. What is changing and why (cite methodology/reference if applicable).
  2. What was true before and what breaks/changes for existing prospects.
  3. Test evidence that the new behavior is internally consistent.
  A human reviews and merges all PRs before they take effect.

## Continuous specialist agent improvement (meta-agent)
- Every `/advance` cycle includes the `/meta` agent, whose job is to keep the specialist
  agents (architect, petro, review, security, dev, geodata) operating at expert level:
  - Evaluate each specialist's recent output for gaps, inconsistencies, or outdated
    assumptions.
  - Identify missing domain knowledge, references, or examples that would improve
    accuracy/depth.
  - Record concrete improvement notes per specialist under `docs/agent-knowledge/`
    (one file per specialist) so future cycles can read accumulated context.
  - Recommend prompt/instruction adjustments for each specialist; capture these in
    `docs/agent-knowledge/` for the orchestrator to apply at the start of the next cycle.
- This runs continuously across cycles without waiting for user direction.

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
