# Geospatial Data Science Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- MapLibre heatmap layer for prospect density / GCoS intensity (no new deps,
  ~20 lines in MapPage.tsx + a toggle button) — good next quick win.
- Basin convex hull visualization — requires `@turf/turf` (justified, no paid API).
  Add `basinConvexHulls()` to `geoUtils.ts` and a fill+line layer pair in MapPage.tsx.
- Spatial outlier (isolated prospect) flagging — IMPLEMENTED in cycle 14
  (`findIsolated()` in `geoUtils.ts`, surfaced in MapPage `buildSpatialInsights`).

## Reference material / methodology notes
- 2026-06-10: `@turf/turf` is still NOT installed. MapLibre native clustering is in
  use (clusterRadius 40, clusterMaxZoom 10) and covers basic density; turf would only
  be needed for convex hulls / polygon ops.
