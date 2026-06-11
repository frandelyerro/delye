# Geospatial Data Science Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Basin convex hull visualization — would require `@turf/turf` (justified, no paid
  API) for a tighter-fitting polygon than the bounding-circle approximation added in
  cycle 16. Lower priority now that basin extents are visualized without a new
  dependency; revisit only if users need precise hull boundaries (e.g. for area
  calculations).

## Completed
- Spatial outlier (isolated prospect) flagging — IMPLEMENTED in cycle 14
  (`findIsolated()` in `geoUtils.ts`, surfaced in MapPage `buildSpatialInsights`).
- MapLibre heatmap layer for prospect density / GCoS intensity — IMPLEMENTED in
  cycle 15 (`prospect-heatmap` layer + `prospects-heat` source in MapPage.tsx, toggled
  via the "Heatmap" button alongside the 2D/3D toggle; weight = `gcosRaw`).
- Basin extent overlay — IMPLEMENTED in cycle 16 as a no-new-dependency
  "bounding circle" (centroid + max distance to a member prospect), via
  `basinBoundingCircle()` and `circlePolygonCoordinates()` in `geoUtils.ts`, rendered
  as `basin-circles-fill`/`basin-circles-line` layers from a `basin-circles` source
  in MapPage.tsx, toggled via the "Basin Circles" button. This supersedes the
  convex-hull item as the primary basin-extent visualization for now.
- Point-to-point distance advisor query — IMPLEMENTED in cycle 17: new "how far is
  [name] from [name]" / "distance between" handler in `advisor.ts`, using the existing
  `haversineKm()` and `isValidCoordinate()` from `geoUtils.ts` plus the new
  `findMentionedProspects()` substring-overlap fix (see review.md) to identify the
  pair. Returns great-circle distance, basin context, and tiered shared-infrastructure
  guidance (<50km / <200km / >=200km).

## Reference material / methodology notes
- 2026-06-10: `@turf/turf` is still NOT installed. MapLibre native clustering is in
  use (clusterRadius 40, clusterMaxZoom 10) and covers basic density; the heatmap
  layer (cycle 15) covers GCoS-weighted density and the basin bounding-circle overlay
  (cycle 16) covers basin extent, both without turf.
