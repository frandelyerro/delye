# Architecture Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Badge-style class objects (`tierBadgeClass`, `priorityBadgeClass`,
  `economicGradeBadge`, etc.) duplicated across DashboardPage, ProspectDetailPage,
  TargetingPage, MLLabPage (~250 lines total). Extract to `src/utils/badgeStyles.ts`.
- Chart margins/opacities/color palettes (BASIN_PALETTE, COMPONENT_COLOR,
  CONFIDENCE_COLOR, PRIORITY_COLOR, PLAY_TYPE_COLOR) repeated across DashboardPage,
  VisualizationsPage, MapPage, ComparisonPage, AgentEvolutionPage. Extract to
  `src/utils/chartConfig.ts`.
- Large pages lacking internal decomposition: MLLabPage (~900L), ProspectFormPage
  (~900L), ProspectDetailPage (~760L). Split into per-section subcomponents.

## Reference material / methodology notes
- 2026-06-10: No circular dependencies detected in the domain layer. Issues are all
  in presentation/component composition, not domain architecture.
