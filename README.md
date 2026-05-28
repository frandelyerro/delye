# PetroTarget AI (MVP)

PetroTarget AI is a frontend MVP for petroleum exploration teams. It ranks prospects using explainable petroleum system scoring, shows map context, provides a rule-based portfolio advisor, and supports validated CSV/JSON portfolio imports.

## Current MVP Status

- Frontend-only React/Vite application.
- Uses mock, non-confidential prospect data.
- Calculates Geological Chance of Success (GCoS) locally.
- Adds scoring explainability and Data Confidence indicators locally.
- Ranks prospects by GCoS descending.
- Provides prospect detail pages, portfolio map, rule-based advisor, CSV/JSON import, and JSON report export.
- Supports **evidence-derived scoring** via the Geoscience Intelligence Engine: structured geological evidence per component (TOC, Ro, porosity, permeability, fault seal risk, seismic confidence, charge timing, etc.) derives component scores deterministically. See [docs/geoscience-engine.md](docs/geoscience-engine.md).
- Includes the **AI Targeting Workbench** (`/targeting`): Prospectivity Tiers (T1–T4), Recommended Actions (drill candidate → do not prioritize), Exploration Stage classification, Portfolio Intelligence summary, and 11 new Advisor queries. See [docs/ai-targeting-workbench.md](docs/ai-targeting-workbench.md).
- Supports **evidence editing**: switch any prospect between manual and evidence-derived scoring directly in the Create/Edit form. Fill structured petroleum system evidence per component (source, migration, reservoir, seal, trap, timing) and see a live derived scoring preview before saving. See [docs/geoscience-engine.md#editing-structured-evidence](docs/geoscience-engine.md#editing-structured-evidence).
- Includes **Decision Economics**: screening-level EMV model (GCoS × Net Revenue − CAPEX) with economic grade (strong/moderate/weak/negative), decision signal, risked/unrisked resource breakdown, and per-prospect assumption overrides. See [docs/decision-economics.md](docs/decision-economics.md).
- Includes **Backend Foundation**: optional Supabase integration via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. Without credentials, all data persists to localStorage. With credentials, prospects sync to a Supabase PostgreSQL table. See [docs/backend-foundation.md](docs/backend-foundation.md).

## Backend Foundation

PetroTarget AI supports an optional Supabase backend. No credentials are required for local development.

### Local mode (default)

Without Supabase env vars, the app works entirely in localStorage — identical to before. The sidebar shows **Storage: Local**.

### Supabase mode

Set two environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then run the SQL migration in `docs/backend-schema.md` in your Supabase SQL editor.
The sidebar shows **Storage: Supabase** and all CRUD operations write to the cloud.

See [docs/backend-foundation.md](docs/backend-foundation.md) for the full setup guide, schema, and limitations.

## Install

```bash
npm install
```

On Windows PowerShell, if `npm` is blocked by local script execution policy, use:

```powershell
npm.cmd install --registry=https://registry.npmjs.org/
```

## Run Locally

```bash
npm run dev
```

Windows PowerShell fallback:

```powershell
npm.cmd run dev
```

## Validated Commands On Windows

The Codex Windows environment used for QA blocks the literal `npm ...` PowerShell wrapper because it resolves to:

```text
C:\Program Files\nodejs\npm.ps1
```

The failure is a local PowerShell `ExecutionPolicy` issue before npm reaches the registry. The npm CLI itself was validated through `npm.cmd`:

```powershell
npm.cmd config get registry
npm.cmd install --registry=https://registry.npmjs.org/
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

Expected registry:

```text
https://registry.npmjs.org/
```

## Project Structure

```text
src/
  components/
    Layout/
    ui/
  data/
    mockProspects.ts
  domain/
    prospect.ts
    scoring.ts
    recommendations.ts
    advisor.ts
  pages/
    DashboardPage.tsx
    MapPage.tsx
    ProspectDetailPage.tsx
    AdvisorPage.tsx
    UploadPage.tsx
  store/
    useProspectStore.ts
  utils/
    csvParser.ts
    exportReport.ts
```

## Scoring Engine

Geological Chance of Success (GCoS) is calculated as:

```text
sourceScore * migrationScore * reservoirScore * sealScore * trapScore * timingScore
```

GCoS estimates a compounded geological chance based on petroleum system inputs. It is not a prediction engine and does not guarantee a discovery.

Priority rules:

- `high`: GCoS >= 0.35 and commercialScore >= 70
- `medium`: GCoS >= 0.18
- `low`: GCoS < 0.18

Main risk is the minimum component among source, migration, reservoir, seal, trap, and timing.

Recommendation rules:

- `high`: Advance to detailed technical evaluation / drilling candidate
- `medium`: Acquire additional data and reduce key uncertainty
- `low`: Do not prioritize unless new evidence improves risk profile

## GCoS vs Data Confidence

- `GCoS` estimates the compounded geological chance of success from the six petroleum system components.
- `Data Confidence` measures the completeness and consistency of the inputs used in the scoring model.
- `Data Confidence` is not a probability of finding hydrocarbons and should not be read as certainty.

Current Data Confidence adjustments:

- Start from `100`
- Minus `10` if `resourceEstimate` is `0`
- Minus `10` if `commercialScore` is `0`
- Minus `5` for each geological score below `0.25`
- Minus `5` if `latitude` or `longitude` are `0`
- Clamped between `0` and `100`

The product explains each scored prospect with:

- full GCoS multiplication string
- strongest components
- weakest component
- main risk
- data confidence
- textual interpretation
- recommended next technical step

## Import Behavior

- CSV and JSON imports are validated locally.
- Imports replace the current prospect portfolio by default.
- Append mode exists in store code for a future UX mode but is not enabled in the UI.

## Documentation

- [Geoscience Intelligence Engine](docs/geoscience-engine.md) — evidence-derived scoring rules, component parameters, limitations and calibration roadmap
- [AI Targeting Workbench](docs/ai-targeting-workbench.md) — tier classification, recommended actions, exploration stage logic, limitations
- [Petroleum Expert Agent](docs/PETROLEUM_EXPERT_AGENT.md) — technical guardrails and product positioning
- [Petroleum Review Checklist](docs/PETROLEUM_REVIEW_CHECKLIST.md) — pre-merge technical review checklist
- [Petroleum Technical Parameters](docs/PETROLEUM_TECHNICAL_PARAMETERS.md) — current heuristic parameters and gap inventory
- [Petroleum Expert Review 001](docs/reviews/PETROLEUM_EXPERT_REVIEW_001.md) — Geoscience Intelligence Engine review
- [Petroleum Expert Review 002](docs/reviews/PETROLEUM_EXPERT_REVIEW_002.md) — AI Targeting Workbench review

## Short Roadmap

- Add persisted project workspaces.
- Add authenticated team access.
- Add backend data storage and audit history.
- Add richer import templates and validation reports.
- Add optional real ML/LLM integrations after the MVP scoring workflow is stable.
