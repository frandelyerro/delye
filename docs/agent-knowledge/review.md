# Code Review Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- (none recorded yet)

## Completed
- 2026-06-11 (cycle 18): Full sweep of cycle-17 code (BatchOutcomePage,
  `batchUpdateOutcomes`, trap-geometry/distance advisor handlers, MapLibre cleanup,
  chartConfig dedup) found ZERO HIGH/MEDIUM issues. Re-verified the
  `geologicalChanceOfSuccess ?? 0` pattern is eliminated from `src/pages/`; remaining
  `?? 0` uses in `advisor.ts` are display-only string interpolation (safe). Note for
  future advisor tests: prospect NAMES can contain trigger words (e.g. "Caspian Seal
  Risk" fires the seal-risk handler before a later handler sees the question) — pick
  neutral names like "Vaca Norte Lead" when interpolating names into test questions.
- 2026-06-10 (cycle 17): Fixed `findMentionedProspects()` in `advisor.ts` (HIGH) —
  it matched any prospect whose name was a substring of another matched prospect's
  name (e.g. "Tupi" inside "Tupi North"), so two-prospect queries (compare, distance)
  could silently pick the wrong pair or duplicate-match. Now sorts candidates by name
  length (longest first) and skips a candidate if its name overlaps (in either
  direction) with an already-matched name. Regression test added with synthetic
  "Tupi"/"Tupi North" prospects.
- 2026-06-10 (cycle 17): Fixed a double-call of `findMentionedProspects()` in the
  advisor's "compare" handler (MEDIUM) — the result is now computed once into
  `comparePair` and reused.
- 2026-06-10 (cycle 17): `AgentEvolutionPage.tsx` had `CURRENT_CYCLE = 14` while
  `CYCLE_HISTORY` already had rows through cycle 16 (MEDIUM) — the "← now" highlight
  and "This Cycle" KPI silently showed stale data. Bumped to the live cycle number
  each `/advance` run and added the corresponding `CYCLE_HISTORY` rows; keep these two
  in sync going forward (`CURRENT_CYCLE` should always equal the last `CYCLE_HISTORY`
  row's `cycle`).
- 2026-06-10 (cycle 17): 8 more display-only `(p.geologicalChanceOfSuccess ?? 0)` /
  `(prospect.geologicalChanceOfSuccess ?? 0)` NaN-unsafe sites found across
  ComparisonPage, TargetingPage, ProspectDetailPage, and DashboardPage (MEDIUM) —
  replaced with `safeGcos(p)` from `src/utils/numberUtils.ts`, consistent with the
  cycle 15/16 fixes. A repo-wide grep for `geologicalChanceOfSuccess ?? 0` now returns
  no matches in `src/pages/`.

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
- 2026-06-11 (cycle 20): Found `(p.geologicalChanceOfSuccess ?? 0)` (does not catch
  explicit `NaN`, since `NaN ?? 0 === NaN`) still in use in `advisor.ts` (basin
  distribution, best/worst basin, map overview, spatial cluster analysis, play-type
  breakdown — 5 `reduce` aggregations) and `portfolioIntelligence.ts:getBasinStats`
  (avgGCoS). The cluster-analysis handler's `c.avgGcos > 0.2 && c.count >= 3`
  high-value-cluster filter would silently exclude any basin containing a NaN-GCoS
  prospect (`NaN > 0.2` is `false`). Fixed by promoting the existing
  `finiteGcos(p)` helper from a private const in `portfolioIntelligence.ts` to an
  exported one (placed near the top of the file, before its first use in
  `getBasinStats`), and using it in all 6 affected aggregations
  (`portfolioIntelligence.ts:getBasinStats` + `advisor.ts` lines ~786/811/828/871/1112).
  Added tests: `finiteGcos`/`getBasinStats` NaN cases in
  `portfolioIntelligence.test.ts`, and a "cluster spatial analysis with NaN GCoS
  prospect" case in `advisor.test.ts` asserting the response never contains "NaN".
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
