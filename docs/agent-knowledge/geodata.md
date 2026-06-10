# Geospatial Data Science Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Basin convex hull visualization — requires `@turf/turf` (justified, no paid API).
  Add `basinConvexHulls()` to `geoUtils.ts` and a fill+line layer pair in MapPage.tsx.

## Completed
- Spatial outlier (isolated prospect) flagging — IMPLEMENTED in cycle 14
  (`findIsolated()` in `geoUtils.ts`, surfaced in MapPage `buildSpatialInsights`).
- MapLibre heatmap layer for prospect density / GCoS intensity — IMPLEMENTED in
  cycle 15 (`prospect-heatmap` layer + `prospects-heat` source in MapPage.tsx, toggled
  via the "Heatmap" button alongside the 2D/3D toggle; weight = `gcosRaw`).

## Reference material / methodology notes
- 2026-06-10: `@turf/turf` is still NOT installed. MapLibre native clustering is in
  use (clusterRadius 40, clusterMaxZoom 10) and covers basic density; the new heatmap
  layer (cycle 15) covers GCoS-weighted density without turf. Turf would only be
  needed for convex hulls / polygon ops (basin hulls item above).
