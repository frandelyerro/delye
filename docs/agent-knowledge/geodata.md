# Geospatial Data Science Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Basin circle density labels (GEO-005, proposed cycle 21): annotate
  `basin-circles` layer with `avgNearestNeighborKm`/`isDense` from
  `basinClusteringStats()`, render a symbol layer label
  "{basin} ({count}, {avgNN}km NN)", color-code dense (green) vs scattered (amber)
  basins. ~50 lines, no new deps.
- Basin convex hull visualization — would require `@turf/turf` (justified, no paid
  API) for a tighter-fitting polygon than the bounding-circle approximation added in
  cycle 16. Lower priority now that basin extents are visualized without a new
  dependency; revisit only if users need precise hull boundaries (e.g. for area
  calculations).

## Completed
- 2026-06-11 (cycle 22): GEO-003 — fixed the single-prospect `fitBounds()`
  degenerate-bounding-box bug in `MapPage.tsx` (when a filter narrows to exactly
  1 valid-coordinate prospect, the old code built a zero-area `LngLatBounds` and
  forced `maxZoom: 10`). Now uses `easeTo({ center: [lon, lat], zoom: 12, duration:
  500 })` for the 1-result case, keeping `fitBounds` for 2+ results.
  GEO-004 — added an outcome filter: `FilterState.outcome` (`OutcomeFilter` =
  'discoveries' | 'dry_holes' | 'non_commercial') plus three new filter chips
  ("Discoveries" = `isGeologicalSuccess()`, "Dry Holes", "Non-Commercial"),
  wired into `filteredProspects`, `setOutcomeFilter()`, and the "Clear filters"
  button/condition. No new dependencies.
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
- Analog proximity — IMPLEMENTED in cycle 18: `findNearestOutcome()` and
  `rankByAnalogProximity()` in `geoUtils.ts` (generic over
  `{ latitude, longitude, outcome?: { label } }`, `label !== 'unknown'` counts as
  drilled), plus a "nearest analog to [name]" / "closest analog" advisor handler that
  returns the nearest drilled well with outcome + distance for a named prospect, or a
  top-3 analog-proximity ranking portfolio-wide. Handler placed BEFORE the
  analog-field and nearest-prospect handlers (pattern precedence). 8 new geoUtils
  tests + 4 advisor tests.
- Point-to-point distance advisor query — IMPLEMENTED in cycle 17: new "how far is
  [name] from [name]" / "distance between" handler in `advisor.ts`, using the existing
  `haversineKm()` and `isValidCoordinate()` from `geoUtils.ts` plus the new
  `findMentionedProspects()` substring-overlap fix (see review.md) to identify the
  pair. Returns great-circle distance, basin context, and tiered shared-infrastructure
  guidance (<50km / <200km / >=200km).

- Basin cluster spacing — IMPLEMENTED in cycle 19: `basinClusteringStats()` in
  `geoUtils.ts` computes per-basin avg/min/max nearest-neighbor distance (filters
  invalid/null-island coords, requires >=2 valid items per basin) and flags a basin
  as `isDense` when avg nearest-neighbor distance < 100 km. New "basin spacing" /
  "basin density" / "cluster density" / "nearest neighbor" / "infrastructure
  sharing" advisor handler returns per-basin spacing summary plus shared-facility/
  tie-back guidance for dense basins. Placed BEFORE the existing broader "cluster"
  handler to avoid precedence collisions. 6 new geoUtils tests.

- Coordinate-precision flagging — IMPLEMENTED in cycle 20: `prospectsToGeoJSON()` in
  `MapPage.tsx` now computes `hasLowPrecisionCoordinates()` once per prospect and
  exports it as both `lowPrecisionCoords` (boolean) and a human-readable
  `coordinatePrecision` ("low (<4 decimals)" / "standard (4+ decimals)") GeoJSON
  property — visible in GeoJSON exports for downstream GIS QA. The point-click
  popup also renders an amber "⚠ Low-precision coordinates ... verify location
  before well planning" notice when `lowPrecisionCoords` is true. No new
  dependencies; reuses the existing `hasLowPrecisionCoordinates()` from
  `geoUtils.ts`.

## Reference material / methodology notes
- 2026-06-10: `@turf/turf` is still NOT installed. MapLibre native clustering is in
  use (clusterRadius 40, clusterMaxZoom 10) and covers basic density; the heatmap
  layer (cycle 15) covers GCoS-weighted density and the basin bounding-circle overlay
  (cycle 16) covers basin extent, both without turf.
