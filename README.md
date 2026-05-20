# PetroTarget AI (MVP)

PetroTarget AI is a frontend MVP for petroleum exploration teams. It ranks prospects using explainable petroleum system scoring, shows map context, provides a rule-based portfolio advisor, and supports validated CSV/JSON portfolio imports.

## Current MVP Status

- Frontend-only React/Vite application.
- Uses mock, non-confidential prospect data.
- Calculates Geological Chance of Success (GCoS) locally.
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

Priority rules:

- `high`: GCoS >= 0.35 and commercialScore >= 70
- `medium`: GCoS >= 0.18
- `low`: GCoS < 0.18

Main risk is the minimum component among source, migration, reservoir, seal, trap, and timing.

Recommendation rules:

- `high`: Advance to detailed technical evaluation / drilling candidate
- `medium`: Acquire additional data and reduce key uncertainty
- `low`: Do not prioritize unless new evidence improves risk profile

## Import Behavior

- CSV and JSON imports are validated locally.
- Imports replace the current prospect portfolio by default.
- Append mode exists in store code for a future UX mode but is not enabled in the UI.

## Short Roadmap

- Add persisted project workspaces.
- Add authenticated team access.
- Add backend data storage and audit history.
- Add richer import templates and validation reports.
- Add optional real ML/LLM integrations after the MVP scoring workflow is stable.
