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
- 2026-06-10 (cycle 15): Same pattern found and fixed in `MapPage.tsx`
  (`buildSpatialInsights` avgGcos reduces, `best` reduce comparator, and
  `prospectsToGeoJSON` gcos/gcosRaw properties) and `DashboardPage.tsx` (avg GCoS,
  playTypeDist avgGcos, top-prospect GCoS, scatter chart x-axis). Extracted a shared
  `safeGcos`/`safeNumber` helper to `src/utils/numberUtils.ts` (with its own test file)
  to avoid re-duplicating the `Number.isFinite` guard across pages — use this helper
  for any new GCoS-based arithmetic instead of inlining `?? 0`.
- 2026-06-10 (cycle 16): Found and fixed 2 more NaN-propagation instances in
  `VisualizationsPage.tsx` (cross-section sort, bubble-chart x-axis, and forecast
  ranking/cumulative-resource gcos) using the shared `safeGcos` helper from
  `src/utils/numberUtils.ts`. This appears to be the last remaining `?? 0` GCoS
  pattern in `src/pages/` — re-grep `geologicalChanceOfSuccess ?? 0` in new chart
  code going forward.
- 2026-06-10 (cycle 15): Reviewed the MapPage `useEffect` that skips `setData` when
  `layersReady.current` is false (data-update effect, runs on filter change) — this is
  NOT a bug: `filteredRef.current` is updated synchronously on every render
  (before the async `'load'` event fires), so the initial `addSource` call inside the
  `'load'` handler always picks up the latest filtered data. No fix needed, but keep
  this invariant (`filteredRef.current = filteredProspects` on every render) intact if
  refactoring this effect.
