# PetroTarget AI (MVP)

PetroTarget AI is a frontend MVP for petroleum exploration teams. It ranks prospects using explainable petroleum system scoring, shows map context, provides a rule-based portfolio advisor, and supports validated CSV/JSON portfolio imports.

## Current MVP Status

- Frontend-only React/Vite application.
- Uses mock, non-confidential prospect data.
- Calculates Geological Chance of Success (GCoS) locally.
- Adds scoring explainability and Data Confidence indicators locally.
- Ranks prospects by GCoS descending.
- Provides prospect detail pages, portfolio map, rule-based advisor, CSV/JSON import, and JSON report export.
- No backend, authentication, billing, database, real ML model, or LLM integration.

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

Run tests locally:

```powershell
npm.cmd run test
```

Run a production build locally:

```powershell
npm.cmd run build
```

Preview the production build:

```powershell
npm.cmd run preview
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

## Deployment

Recommended deploy target: Vercel.

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none for now

The project includes a root `vercel.json` with SPA rewrites so direct refreshes continue to work for:

- `/dashboard`
- `/map`
- `/advisor`
- `/upload`
- `/prospects/:id`
- `/prospects/new`
- `/prospects/:id/edit`

Windows local note: if PowerShell blocks `npm.ps1`, use `npm.cmd` instead.

## Short Roadmap

- Add persisted project workspaces.
- Add authenticated team access.
- Add backend data storage and audit history.
- Add richer import templates and validation reports.
- Add optional real ML/LLM integrations after the MVP scoring workflow is stable.
