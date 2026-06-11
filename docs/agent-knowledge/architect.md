# Architecture Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Large pages lacking internal decomposition: MLLabPage (~900L), ProspectFormPage
  (~900L), ProspectDetailPage (~760L). Split into per-section subcomponents.
- `COMPONENT_COLOR` and `CONFIDENCE_COLOR` (VisualizationsPage) remain page-local —
  `CONFIDENCE_COLOR.high` (`#34d399`) differs intentionally from `PRIORITY_COLOR.high`
  (`#22c55e`), so do NOT merge these into `chartConfig.ts`'s `PRIORITY_COLOR`.

## Completed
- Chart styling dedup — IMPLEMENTED in cycle 17: created `src/utils/chartConfig.ts`
  exporting `CHART_TOOLTIP_STYLE`, `PRIORITY_COLOR` (+ `Priority` type), and
  `BASIN_PALETTE`. Removed the local `colors`/`BASIN_PALETTE` consts from
  DashboardPage and the local `Priority` type/`PRIORITY_COLOR` const from MapPage;
  replaced 7 duplicated `contentStyle={{ backgroundColor: '#1e293b', ... }}` recharts
  tooltip objects across DashboardPage (3), VisualizationsPage (3), and ComparisonPage
  (1) with the shared `CHART_TOOLTIP_STYLE`. ComparisonPage's tooltip previously used
  `borderRadius: 8` with no `fontSize` — now `borderRadius: 6, fontSize: 12` like the
  rest of the app (minor visual tweak for consistency). `BASIN_PALETTE` is still only
  consumed by DashboardPage's basin scatter chart, but is now positioned for reuse.

- Badge-style class objects — IMPLEMENTED in cycle 16: extracted
  `priorityBadgeClass`, `riskBadgeClass`, `tierBadgeClass`, `actionBadgeClass`,
  `economicGradeBadge`, `decisionSignalBadge`, `confidenceBadgeClass` to
  `src/utils/badgeStyles.ts` and updated DashboardPage, ProspectDetailPage (kept
  local `evidenceScoreBadge` function), and TargetingPage (aliased imports as
  `tierBadge`/`actionBadge`/`riskBadge` to match its existing call sites) to import
  from there. MLLabPage had no badge-class definitions to extract (verified via
  grep). Note: DashboardPage's local `economicGradeBadge` previously used `/30`
  opacity classes while ProspectDetailPage used `/40` — standardized on `/40`
  (matches 2 of 3 prior definitions) as part of the dedup; this is a minor visual
  tweak to DashboardPage's economic-grade badges only.

## Reference material / methodology notes
- 2026-06-10: No circular dependencies detected in the domain layer. Issues are all
  in presentation/component composition, not domain architecture.
