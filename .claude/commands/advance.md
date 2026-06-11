# PetroTarget AI — Autonomous Advancement Orchestrator

You are the **Master Orchestrator** for PetroTarget AI. Your job is to coordinate all specialist agents to autonomously advance the project in one session.

## Hard Constraints (ALL agents must respect)
- Do NOT change: GCoS formula (`src/domain/scoring.ts:calculateGCoS`), expert-system scoring, geoscience engine (`src/domain/geoscienceEngine.ts`), targeting hard gates (`src/domain/recommendationEngine.ts`), decision economics formulas (`src/domain/economics.ts`), CRUD, localStorage/Supabase abstraction (`src/services/prospectRepository.ts`)
- Do NOT add: backend training service, Python backend, real LLM, paid APIs (including Google Maps, ArcGIS, Mapbox paid tier), auth UI, production ML inference API
- ML model output is ADVISORY ONLY — never overrides expert-system decisions
- `npm run typecheck && npm run test && npm run build` MUST pass before any push

---

## Pre-Flight: What Changed Since Last Advance

Before spawning agents, run these and include the output in your session context:

```bash
# What changed in the last 5 commits
git log --oneline -5

# Files changed since last advance commit
git diff HEAD~5..HEAD --stat 2>/dev/null | head -30

# Current test status
npm run test 2>&1 | tail -20

# Current typecheck status
npm run typecheck 2>&1 | head -20
```

Summarize: "Since the last `/advance`, the following changed: [list from git log]. Tests are currently [passing/failing — N failures]. TypeScript errors: [none/N errors]."

---

## Execution Plan

### Phase 1 — Parallel Analysis (launch all 7 agents simultaneously)

Spawn all 7 specialist agents at once. Each returns findings only — no implementation yet:

1. **Architecture Agent** (see `/architect`):
   Audit `src/` for files >300 lines, missing abstractions, circular deps, bundle size.
   Known targets: `MLLabPage.tsx` (1272L), `ProspectFormPage.tsx` (899L), `advisor.ts` (723L).
   Return: top 3 architectural issues with exact `file:line`.

2. **Petroleum Domain Agent** (see `/petro`):
   Audit `src/domain/scoring.ts`, `src/domain/advisor.ts`, `src/domain/geoscienceEngine.ts`.
   Check geoscience threshold accuracy, advisor coverage gaps, ML feature engineering quality.
   Return: top 3 domain improvements with `file:line`.

3. **Review Agent** (see `/review`):
   Run `git diff main~3..main`, check for bugs, null safety, React hook issues.
   Specific focus: NaN propagation in GCoS, edge cases in economics, MapLibre cleanup.
   Return: ALL findings at HIGH+ severity with `file:line`.

4. **Security Agent** (see `/security`):
   Run `npm audit`, grep XSS vectors in MapLibre popups (`src/pages/MapPage.tsx:256-273`), check localStorage key construction, review CSV import for prototype pollution.
   Return: ALL HIGH+ security findings with `file:line`.

5. **Dev Agent** (see `/dev`):
   Review the feature backlog. Check which high-impact items are NOT yet implemented:
   risk tornado chart, portfolio analytics dashboard, batch outcome labeling, analog prospect finder.
   Return: highest-value unimplemented feature + implementation plan (domain → service → UI → tests).

6. **Geospatial Agent** (see `/geodata`):
   Audit `src/pages/MapPage.tsx` and `src/domain/advisor.ts` for spatial intelligence gaps.
   Check: is turf.js installed? Are basin hulls, heatmap, and density analysis implemented?
   Return: top 3 geospatial improvements with concrete implementation plan.

7. **AI/ML Agent** (see `/ml`):
   Audit `src/domain/mlFeatures.ts`, `mlDataset.ts`, `mlModel.ts`, `mlReadiness.ts`,
   `mlTrainingFeatures.ts`, `mlTrainingService.ts`, `mlEvaluation.ts`, `mlLogisticRegression.ts`,
   `norwayFactpagesAdapter.ts`, and `src/pages/MLLabPage.tsx`.
   Check: feature/label honesty (no leakage, correct synthetic-vs-real labeling), whether
   `assessMLReadiness`/`mlEvaluation` leverage the real outcome labels added in cycles 17-18,
   advisor ML coverage, and required "no trained model" disclaimers everywhere predictions appear.
   Return: top 3 ML improvements with `file:line` and concrete implementation plan.

---

### Phase 2 — Prioritize

Collect all findings from Phase 1. Apply this strict prioritization:

| Priority | Category | Rationale |
|---|---|---|
| P0 | Security vulnerabilities | Block deployment |
| P1 | Correctness bugs / NaN / data loss | Affect existing users |
| P2 | Architecture: files >500 lines | Blocks future work |
| P3 | Petroleum domain accuracy | Core product value |
| P4 | Geospatial spatial intelligence | Map page differentiator |
| P5 | AI/ML pipeline correctness & honesty | Advisory-only ML credibility |
| P6 | New features from backlog | Net new value |

Within each priority level, prefer changes with: smaller diff size, broader test coverage, no risk of regressions.

**Do not implement** in this cycle:
- Any change requiring >3 files if it touches domain/scoring or domain/recommendationEngine
- Any new external npm dependency without justification (except `@turf/turf` for geodata)
- Auth, backend, or real LLM integration

---

### Phase 3 — Implement

Implement changes in priority order. For each change:
1. Read the target file before editing
2. Make the minimal correct fix
3. Run `npm run typecheck` after each change — fix any new errors before moving to next change
4. Don't introduce new issues while fixing old ones
5. If a change requires updating tests, update them immediately

---

### Phase 4 — Quality Gate (run before commit)

```bash
# Step 1: Lint / typecheck
npm run typecheck
# Expected: 0 errors. If errors exist — fix them before proceeding.

# Step 2: Tests
npm run test
# Expected: 0 failures. If failures exist — either fix the code or fix the test (not both without understanding why).

# Step 3: Build
npm run build
# Expected: dist/ produced with 0 errors. Check bundle size warnings.

# Step 4: Smoke check — does the app start?
npm run preview &
# Browse to http://localhost:4173 (or whatever port) and verify:
# - Dashboard loads
# - Map renders
# - No console errors
# Kill preview after check
```

If any step fails, fix it before committing. Do NOT commit with failing tests or TypeScript errors.

---

### Phase 5 — Commit and Push

```bash
# Stage only the files that were intentionally changed
git diff --name-only  # review what changed
git add <specific files>  # never git add -A blindly

# Commit with a structured message
git commit -m "feat(advance): <summary>

Changes:
- security: <what was fixed>
- fix: <what bug was resolved>
- feat: <what feature was added>
- refactor: <what was restructured>"

git push origin main
```

---

## Output to User

At the end of the session, provide:

### Summary Table
| Agent | Findings | Implemented | Skipped (reason) |
|---|---|---|---|
| Architecture | N issues | X changes | Y (too large for this cycle) |
| Petroleum | N issues | X changes | Y (correct already) |
| Review | N issues | X fixes | Y (needs investigation) |
| Security | N issues | X fixes | — |
| Dev | 1 feature plan | X (done/not done) | — |
| Geodata | N improvements | X features | — |

### Metrics
- Test results: X/Y passing
- TypeScript: 0 errors (or N remaining)
- Bundle size delta: +/- KB

### What Was NOT Implemented and Why
List any findings that were scoped out, with reason: "too large", "needs domain expert review", "depends on feature X first".

### Suggested Focus for Next `/advance`
One sentence: "Next advance should focus on [area] because [reason]."

---

## Usage
- `/advance` — full autonomous cycle (all 6 agents)
- `/advance security` — security agent only, light pass on others
- `/advance feature:tornado` — dev agent focused on risk tornado chart
- `/advance geodata` — geospatial agent only
- `/advance quick` — analysis only, no implementation (dry run — report findings, no edits)
- `/advance petro` — petroleum domain agent focused session

---

Begin by running the Pre-Flight commands, announcing which agents you're launching, then proceed with Phase 1.
