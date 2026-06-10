# Architecture Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Chart margins/opacities/color palettes (BASIN_PALETTE, COMPONENT_COLOR,
  CONFIDENCE_COLOR, PRIORITY_COLOR, PLAY_TYPE_COLOR) repeated across DashboardPage,
  VisualizationsPage, MapPage, ComparisonPage, AgentEvolutionPage. Extract to
  `src/utils/chartConfig.ts`.
- Large pages lacking internal decomposition: MLLabPage (~900L), ProspectFormPage
  (~900L), ProspectDetailPage (~760L). Split into per-section subcomponents.

## Completed
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
