# Geospatial Data Science Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- (none blocking)

## Resolved / verified
- 2026-06-11 (cycle 24): The "no glyphs URL" concern is VERIFIED NON-ISSUE.
  MapLibre GL JS v5 (`node_modules/maplibre-gl/src/render/glyph_manager.ts`
  ~lines 104-107) falls back to client-side TinySDF glyph rendering when a style
  has no `glyphs` property — `setURL(undefined)` makes `this.url` falsy and the
  manager draws glyphs locally with the default font stack
  ("Open Sans Regular", "Arial Unicode MS Regular") instead of throwing. So all
  three symbol layers (`cluster-count`, `unclustered-label`, `basin-circles-labels`)
  DO render text in production today. Adding a glyphs endpoint
  (e.g. demotiles.maplibre.org) is a pure perf optimization (offloads client CPU)
  and was DECLINED — it adds a third-party dependency + a CSP connect-src change
  for no functional gain.
- Basin convex hull visualization — would require `@turf/turf` (justified, no paid
  API) for a tighter-fitting polygon than the bounding-circle approximation added in
  cycle 16. Lower priority now that basin extents are visualized without a new
  dependency; revisit only if users need precise hull boundaries (e.g. for area
  calculations).

## Completed
- 2026-06-12 (user-requested feature): Identified Targets page (`/targets`,
  `IdentifiedTargetsPage.tsx`) + `src/domain/targetIdentification.ts`.
  `identifyTargets()` greedily single-link clusters valid-coordinate prospects
  (150 km link distance), ranks clusters by avgGcos * sqrt(count), and returns
  the top 3 as "Target 1..N" with bounding circle (reuses
  `basinBoundingCircle`/`circlePolygonCoordinates`), area, avg GCoS, and
  drilled-outcome success rate. `buildTargetGridCells()` buckets a target's
  prospects into 0.05° grid cells with per-cell avg GCoS for a MapLibre heat
  grid (blue→red fill ramp + orange target outline + click popup with cell
  prospects). Tabs per target, color legend, and 3 KPI cards (Target Size /
  Average Prediction Grade / Success Rate). Advisory visualization only — no
  scoring/targeting/economics impact. 11 new targetIdentification tests.
  No new dependencies (no turf; OSM raster style shared with MapPage).
- 2026-06-11 (cycle 23): GEO-005 IMPLEMENTED — `basinCirclesToGeoJSON()` now
  joins `basinClusteringStats()` per basin and exports `isDense` plus a
  pre-built `densityLabel` property ("{basin} ({count}, {avgNN}km NN)", falling
  back to "{basin} ({count})" when a basin has <2 valid-coordinate prospects).
  New `basin-circles-labels` symbol layer renders the label at each circle,
  green (#22c55e) for dense basins, amber (#f59e0b) for scattered, with a dark
  halo; toggled together with the fill/line layers by the "Basin Circles"
  button. Also fixed the cycle-22 LOW finding: when an active filter matches
  zero valid-coordinate prospects, the fitBounds effect now eases back to the
  home view (center [-20,10], zoom 2) instead of leaving the stale zoom.
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

- 2026-06-12 (cycle 26): Added basin/play-type mini-summaries to the Identified
  Targets page. `identifyTargets()` (`targetIdentification.ts`) now computes
  `topBasin`/`topPlayType` (most frequent value among a target's prospects, via a new
  `mostCommon()` helper) on each `IdentifiedTarget`. `IdentifiedTargetsPage.tsx`
  renders "Mostly {basin} basin · {playType} play" under the map title for the active
  target. 1 new targetIdentification test. Grid-cell click navigation and a
  CSV/JSON target export remain deferred (dev backlog).

- 2026-06-12 (cycle 27): Fixed order-dependent clustering in
  `targetIdentification.ts` — `clusterByProximity()` now (a) presorts prospects
  by latitude then longitude and (b) merges all clusters linked by a newly
  added prospect (true single-linkage) instead of joining only the first match.
  Same portfolio now always yields the same targets regardless of store
  insertion order. 2 new tests (shuffled-order invariance; bridge-merge with
  same-latitude endpoints so the merge path is exercised even after the
  presort). Also added an "identified targets" / "spatial targets" / "target
  summary" advisor handler wiring `identifyTargets()` into advisor.ts (placed
  before the "drilled analogs" handler; no collision with the "target depth"
  handler further down) — returns per-target prospect count, dominant
  basin/play, avg GCoS, radius, and drilled success rate, with the 150 km
  spatial-heuristic caveat. 2 new advisor tests. Still open: antimeridian grid
  cells untested; 0.05° grid cells compress at high latitude (~5.5 km claim is
  equatorial).

## Reference material / methodology notes
- 2026-06-10: `@turf/turf` is still NOT installed. MapLibre native clustering is in
  use (clusterRadius 40, clusterMaxZoom 10) and covers basic density; the heatmap
  layer (cycle 15) covers GCoS-weighted density and the basin bounding-circle overlay
  (cycle 16) covers basin extent, both without turf.
