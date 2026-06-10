# Code Review Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- (none recorded yet)

## Reference material / methodology notes
- 2026-06-10: Recurring NaN-propagation pattern found in chart/visualization code —
  optional numeric fields (`geologicalChanceOfSuccess`, `resourceEstimate`, component
  scores) used with `?? 0` don't guard against an explicit `NaN` value (NaN is a
  `number`, so `??` doesn't catch it). Always wrap with `Number.isFinite(x) ? x : 0`
  (or `Math.max(0, x)` after the finite check) before arithmetic feeding charts/map
  layers. Fixed in `MapPage.tsx` (`prospectsToExtrusionGeoJSON`) and
  `VisualizationsPage.tsx` (cross-section + forecast) in cycle 14 — check new chart
  code for the same pattern.
