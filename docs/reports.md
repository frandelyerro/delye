# PetroTarget AI — Reports v1

Professional exploration reports for prospects and portfolios. Export structured data (JSON) or human-readable documents (Markdown) for presentations, team reviews, and management briefings.

## Overview

The reporting module (`src/domain/reporting.ts`) generates two report types:

- **ProspectReport** — full technical file for a single prospect
- **PortfolioReport** — portfolio-wide analysis covering all prospects

Reports are generated entirely client-side, with no network requests.

---

## Types

### `ReportSection`

```typescript
type ReportSection = {
  title: string;
  content: string[];
};
```

A named section with an array of content lines.

### `ProspectReport`

```typescript
type ProspectReport = {
  generatedAt: string;      // ISO 8601 timestamp
  prospect: Prospect;       // full scored prospect object
  executiveSummary: string; // 2–3 sentence narrative
  sections: ReportSection[];
};
```

Sections included:
1. **Overview** — name, basin, block, play type, coordinates, resource estimate, scoring mode
2. **Petroleum System Scores** — all 6 component scores (source, migration, reservoir, seal, trap, timing)
3. **Risk Assessment** — GCoS, main risk, data confidence, priority, commercial score, recommendation, explanation
4. **Targeting Recommendation** — prospectivity tier, recommended action, rationale, next best step, risk flags
5. **Decision Economics** _(if available)_ — simple EMV, economic grade, decision signal, risked/unrisked resources, net revenue, CAPEX, warnings
6. **Geoscience Intelligence Assessment** _(if evidence-derived)_ — summary, critical risk, overall confidence, per-component assessment
7. **Recommended Next Data** _(if evidence-derived and gaps exist)_ — missing evidence per component

### `PortfolioReport`

```typescript
type PortfolioReport = {
  generatedAt: string;
  prospects: Prospect[];
  executiveSummary: string;
  keyDataGaps: string[];
  sections: ReportSection[];
};
```

Sections included:
1. **Portfolio Summary** — total prospects, basins, average GCoS, average data confidence, total unrisked/risked resources, dominant risk
2. **Prospectivity Tier Distribution** — counts for T1–T4, drill candidates
3. **Top Prospects by GCoS** — top 5 ranked prospects with key metrics
4. **Targeting Recommendations Summary** — drill candidates, de-risk candidates, farm-in candidates
5. **Economic Overview** — positive/negative EMV counts, best economic prospect, total risked resources
6. **Risk Distribution** — count of each main risk type across the portfolio

---

## Functions

### `generateProspectReport(prospect: Prospect): ProspectReport`

Generates a full prospect report from a scored `Prospect` object.

### `generatePortfolioReport(prospects: Prospect[]): PortfolioReport`

Generates a portfolio report from an array of scored prospects.

### `getProspectExecutiveSummary(prospect: Prospect): string`

Returns a 2–3 sentence narrative for a single prospect covering GCoS, tier, main risk, and EMV (if available).

### `getPortfolioExecutiveSummary(prospects: Prospect[]): string`

Returns a portfolio-level narrative covering prospect count, basins, average GCoS, tier distribution, resources, and dominant risk.

### `getPortfolioKeyDataGaps(prospects: Prospect[]): string[]`

Returns an array of strings identifying the most important data gaps:
- Prospects with data confidence < 50
- High-GCoS prospects with data confidence < 70
- Prospects still on manual scoring
- Missing evidence items from evidence-derived prospects (up to 8)

---

## Export Utilities (`src/utils/exportReport.ts`)

### `downloadJson(filename, data)`

Downloads any JSON-serializable object as a `.json` file.

### `downloadText(filename, content)`

Downloads a string as a `.md` file (UTF-8 Markdown).

### `formatProspectReportAsMarkdown(report: ProspectReport): string`

Converts a `ProspectReport` to a Markdown string with:
- H1 title with prospect name and generation timestamp
- Executive Summary section
- Each `ReportSection` as an H2 with bulleted content lines
- Footer disclaimer

### `formatPortfolioReportAsMarkdown(report: PortfolioReport): string`

Converts a `PortfolioReport` to a Markdown string with:
- H1 title with prospect count and generation timestamp
- Executive Summary section
- Each `ReportSection` as an H2 with bulleted content lines
- Key Data Gaps section
- Footer disclaimer

### Convenience functions

| Function | Output |
|---|---|
| `exportProspectReportJson(prospect)` | Downloads `{slug}-prospect-report.json` |
| `exportProspectReportMarkdown(prospect)` | Downloads `{slug}-prospect-report.md` |
| `exportPortfolioReportJson(prospects)` | Downloads `portfolio-report.json` |
| `exportPortfolioReportMarkdown(prospects)` | Downloads `portfolio-report.md` |

---

## UI Integration

### Prospect Detail Page (`/prospects/:id`)

Two export buttons appear in the header action bar:

- **Export Report JSON** — downloads the full `ProspectReport` as JSON
- **Export Report Markdown** — downloads the report as a Markdown document

### AI Targeting Workbench (`/targeting`)

Two export buttons appear in the page header:

- **Export Portfolio JSON** — downloads the full `PortfolioReport` as JSON
- **Export Portfolio Markdown** — downloads the portfolio report as Markdown

---

## Advisor Queries

The Geo AI Advisor (`/advisor`) understands the following report-related questions:

| Query | Response |
|---|---|
| `generate a summary report` | Executive summary for the portfolio (or a named prospect if mentioned) |
| `summarize this portfolio` | Portfolio executive summary |
| `what should I present to management?` | Combined management summary with targeting highlights |
| `what are the key risks?` | Risk distribution across the portfolio |
| `what are the key data gaps?` | First 4 identified data gaps from `getPortfolioKeyDataGaps()` |

---

## Limitations

- Reports are generated at export time from in-memory scored data.
- No PDF export in this version (PDF is deferred).
- Report content is deterministic given the same input data; timestamps will differ.
- Economic figures use portfolio defaults unless the prospect has custom assumptions. See [docs/decision-economics.md](decision-economics.md).
- Evidence-derived sections only appear for prospects with `scoringMode === 'evidence_derived'`.
