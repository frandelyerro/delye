# PetroTarget AI (MVP)

PetroTarget AI is a B2B frontend platform for petroleum exploration and development teams. The MVP helps rank prospects by geological and commercial attractiveness using explainable petroleum system scoring.

## Installation

```bash
npm install
```

## Run the app

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Optional checks

```bash
npm run typecheck
npm run test
```

## Project structure

```text
src/
  components/
    Layout/
    Dashboard/
    Prospects/
    Map/
    Advisor/
    Upload/
    Reports/
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

## Scoring engine

Geological Chance of Success (GCoS) is calculated as:

`sourceScore * migrationScore * reservoirScore * sealScore * trapScore * timingScore`

Priority rules:
- `high`: GCoS >= 0.35 and commercialScore >= 70
- `medium`: GCoS >= 0.18
- `low`: GCoS < 0.18

Main risk is the minimum component among source/migration/reservoir/seal/trap/timing.

Recommendation rules:
- high: Advance to detailed technical evaluation / drilling candidate
- medium: Acquire additional data and reduce key uncertainty
- low: Do not prioritize unless new evidence improves risk profile

## Current MVP limitations

- No backend, authentication, billing, or persistent database.
- No real ML model or LLM integration (advisor is rule-based).
- CSV parsing is intentionally simple and expects comma-separated rows without quoted embedded commas.
- Uses mock non-confidential data only.
