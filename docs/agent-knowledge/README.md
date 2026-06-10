# Agent Knowledge Base

This directory accumulates improvement notes for each `/advance` specialist agent
(architect, petro, review, security, dev, geodata), maintained by the `/meta` agent.

## How it works
- Each `/advance` cycle invokes `/meta`, which reviews recent specialist output for
  gaps, inconsistencies, or outdated assumptions.
- `/meta` appends dated notes to the relevant specialist file below: missing domain
  knowledge, references, examples, or recommended prompt/instruction adjustments.
- At the start of each cycle, the orchestrator (`/advance`) and each specialist agent
  should read their corresponding file here as additional context before starting work.
- This is advisory context only — it does not change the hard constraints in
  `AGENTS.md` (GCoS formula, geoscience engine, targeting gates, decision economics).

## Files
- `architect.md` — architecture/structure findings and conventions to reuse
- `petro.md` — petroleum domain accuracy notes, references, edge cases
- `review.md` — recurring bug patterns and review checklist additions
- `security.md` — security findings and hardening checklist additions
- `dev.md` — feature backlog status and implementation notes
- `geodata.md` — geospatial data sources, coordinate/precision issues, basin coverage
