# Security Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- `npm audit` reports 2 moderate, dev-only findings: `esbuild <=0.24.2` (dev server
  allows any website to send requests to it and read the response) via `vite <=6.4.1`.
  Fixing requires `npm audit fix --force`, which installs `vite@8.0.16` — a major
  version jump (5→8) that risks breaking the Vite/Vitest config and CI. No production
  bundle impact (dev-only). Defer to a dedicated cycle with full regression testing
  (`npm run typecheck && npm run test && npm run build` plus a manual smoke check).

## Resolved
- 2026-06-11 (cycle 18): Re-audit clean — `npm audit` unchanged (2 moderate dev-only),
  all MapLibre popup interpolations still `esc()`-escaped (incl. the outcome label
  added in cycle 17), BatchOutcomePage select values are enum-constrained at the
  `<option>` source before the `as` casts, localStorage keys remain hardcoded
  constants, and CSV/JSON import has no dynamic property assignment from
  user-controlled keys. Cycle-18 additions (calibration stats, analog proximity,
  CalibrationPage) are pure aggregation + React-rendered JSX — no new HTML-string or
  injection surfaces.
- 2026-06-10 (cycle 17): The previously-flagged CRITICAL finding (vitest <=3.2.5 /
  vite <=6.4.1 / esbuild <=0.24.2, vitest UI arbitrary file read/exec) is RESOLVED.
  Root cause was simpler than previously assessed: `node_modules/maplibre-gl` was
  missing despite being declared in `package.json`, so `node_modules` was stale
  relative to the lockfile/manifest. Running `npm install` (to fix the missing
  maplibre-gl build error after fast-forwarding `main`) also brought `vitest` up to
  the already-declared `^4.1.8` range — no manual version-pin change was needed.
  `npm ls vitest` now reports `vitest@4.1.8`, matching `package.json`. Only the 2
  moderate esbuild/vite findings above remain.

## Reference material / methodology notes
- 2026-06-10: Baseline security checklist for this app (client-side React SPA,
  localStorage + optional Supabase persistence, MapLibre GL, CSV import):
  - CSV import: validate file type/size and schema before parsing (src/utils/csvParser.ts).
  - XSS: MapLibre popups already escape user-controlled strings via `esc()` in
    MapPage.tsx — keep this pattern for any new popup/HTML-string content.
  - localStorage: keys are hardcoded constants (`petrotarget-ai:prospects`,
    `petrotarget-ai:trained-ml-model`), not user-controlled — no injection/collision risk.
    Do not store secrets in localStorage.
  - Supabase: only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars used (anon
    key is intentionally public) — verify RLS policies are configured server-side if/when
    Supabase persistence becomes the default.
  - CSV/JSON import: no dynamic property assignment from user-controlled keys
    (`__proto__`/`constructor`/`prototype`) — keep using typed Prospect interfaces.
  - 2026-06-10 audit: no application-level (HIGH+) findings. All `npm audit` findings
    are dev-dependency only (see Open improvement areas above).
- 2026-06-10 (cycle 16): Re-audited cycle 15's additions (heatmap layer, advisor
  compare/prioritize handlers, `numberUtils.ts`) — zero new findings. Cycle 16's
  changes (VisualizationsPage NaN fixes, badgeStyles.ts extraction, basin
  bounding-circle overlay) are also additive/refactor-only with no new
  user-controlled-input or HTML-string surfaces — no new findings.
