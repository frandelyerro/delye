# Architecture Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- Large pages still lacking decomposition: MLLabPage (~966L), ProspectDetailPage
  (~728L), MapPage (~880L). MLLabPage is the next decomposition candidate (extract
  per-section subcomponents + the training-preview memo).
- `advisor.ts` reached ~1100 lines (cycle 18): `getAdvisorResponse()` is one function
  with ~40 `q.includes(...)` branches. Proposed split: extract handlers into
  `advisorHandlers.ts` with a pattern→handler registry. DEFERRED — branch precedence
  is load-bearing (earlier greedy patterns like "why is", "seal risk" intentionally
  shadow later ones), so a mechanical registry refactor is regression-prone. Needs a
  dedicated cycle that (a) freezes handler additions, (b) preserves exact ordering in
  the registry array, and (c) leans on the ~60 advisor tests as the safety net.
- Large pages lacking internal decomposition: MLLabPage (~900L), ProspectFormPage
  (~900L), ProspectDetailPage (~760L). Split into per-section subcomponents.
  For ProspectFormPage specifically: extract an `<EvidenceSection>` subcomponent
  (6 nearly identical evidence blocks at ~lines 459–752).
- MLLabPage: `buildTrainingRows()` recomputes on every UI toggle — split the
  expensive row-building memo (deps: prospects, config) from the cheap
  filtering/aggregation memo (deps: UI state), or use `useDeferredValue`.
- `COMPONENT_COLOR` and `CONFIDENCE_COLOR` (VisualizationsPage) remain page-local —
  `CONFIDENCE_COLOR.high` (`#34d399`) differs intentionally from `PRIORITY_COLOR.high`
  (`#22c55e`), so do NOT merge these into `chartConfig.ts`'s `PRIORITY_COLOR`.
- 2026-06-11 (cycle 21): Coarse Zustand selectors — `MLLabPage.tsx`,
  `ProspectDetailPage.tsx` (~line 49-51) call `useProspectStore()`/`useProspectStore(s
  => s.prospects)` with no fine-grained selector, so any prospect mutation re-renders
  all dependents and re-runs `.find(p => p.id === id)`-style lookups. Proposed:
  export `selectProspects`, `selectProspectById(id)`, `selectImportProspects`,
  `selectDeleteProspect` from `useProspectStore.ts` and adopt them across pages.
  Deferred — touches the store + multiple pages, best done as its own cycle alongside
  ProspectFormPage's `<EvidenceSection>` extraction (also proposed cycle 21, same as
  the existing open item above).

## Completed
- 2026-06-11 (cycle 24): ARCH-004/006 IMPLEMENTED — converted the 7 remaining
  coarse `useProspectStore()` destructures to fine-grained inline selectors
  (`useProspectStore((s) => s.prospects)` etc.) in CalibrationPage, MLLabPage,
  VisualizationsPage, DashboardPage (5 selectors), TargetingPage,
  BatchOutcomePage, ComparisonPage. Chosen over named selector exports to match
  the 9 pre-existing inline-selector call sites (idiomatic Zustand). No store
  API, state shape, or persistence change; prospects array consumers still read
  the full array (no shallow-equality wrappers needed since selected values are
  a stable array ref or stable action fns). ~15 net diff lines.
- 2026-06-11 (cycle 23): ARCH-005 IMPLEMENTED — extracted the shared
  `<EvidenceSection>` wrapper to `src/components/ProspectForm/EvidenceSection.tsx`
  (title + accentClass props, children pattern). The six evidence blocks in
  ProspectFormPage.tsx (Source/Migration/Reservoir/Seal/Trap/Timing) now share
  one section-card + accent-heading + responsive-grid definition; all field
  contents, render helpers (renderSelect/renderNum/renderSourceTypes), setters,
  and validation stay in the page (they depend on local state). Behavior
  preserved; ProspectFormPage 915 → 892 lines. created `src/utils/chartConfig.ts`
  exporting `CHART_TOOLTIP_STYLE`, `PRIORITY_COLOR` (+ `Priority` type), and
  `BASIN_PALETTE`. Removed the local `colors`/`BASIN_PALETTE` consts from
  DashboardPage and the local `Priority` type/`PRIORITY_COLOR` const from MapPage;
  replaced 7 duplicated `contentStyle={{ backgroundColor: '#1e293b', ... }}` recharts
  tooltip objects across DashboardPage (3), VisualizationsPage (3), and ComparisonPage
  (1) with the shared `CHART_TOOLTIP_STYLE`. ComparisonPage's tooltip previously used
  `borderRadius: 8` with no `fontSize` — now `borderRadius: 6, fontSize: 12` like the
  rest of the app (minor visual tweak for consistency). `BASIN_PALETTE` is still only
  consumed by DashboardPage's basin scatter chart, but is now positioned for reuse.

- Badge-style class objects — IMPLEMENTED in cycle 16: extracted
  `priorityBadgeClass`, `riskBadgeClass`, `tierBadgeClass`, `actionBadgeClass`,
  `economicGradeBadge`, `decisionSignalBadge`, `confidenceBadgeClass` to
  `src/utils/badgeStyles.ts` and updated DashboardPage, ProspectDetailPage (kept
  local `evidenceScoreBadge` function), and TargetingPage (aliased imports as
  `tierBadge`/`actionBadge`/`riskBadge` to match its existing call sites) to import
  from there. MLLabPage had no badge-class definitions to extract (verified via
  grep). Note: DashboardPage's local `economicGradeBadge` previously used `/30`
  opacity classes while ProspectDetailPage used `/40` — standardized on `/40`
  (matches 2 of 3 prior definitions) as part of the dedup; this is a minor visual
  tweak to DashboardPage's economic-grade badges only.

## Reference material / methodology notes
- 2026-06-10: No circular dependencies detected in the domain layer. Issues are all
  in presentation/component composition, not domain architecture.
