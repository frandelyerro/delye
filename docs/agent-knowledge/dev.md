# Development Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Batch outcome labeling: outcome editing only exists per-prospect
  (ProspectFormPage). A bulk-select + apply-outcome UI (`src/pages/BatchOutcomePage.tsx`,
  ~400 lines incl. tests) would accelerate ML training-dataset construction. This is
  the highest-value unimplemented feature as of cycle 14.

## Reference material / methodology notes
- 2026-06-10: Confirmed already implemented & polished: risk tornado/sensitivity
  chart (TornadoChart.tsx + sensitivityAnalysis.ts), portfolio analytics dashboard,
  analog prospect finder (analogFinder.ts + ComparisonPage), and the new
  VisualizationsPage (2D cross-section, 3D bubble, resource forecast).
