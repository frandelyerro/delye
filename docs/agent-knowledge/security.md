# Security Agent — Knowledge Notes

Maintained by `/meta`. Append dated entries below; do not delete prior history.

## Open improvement areas
- `vitest` is at 2.1.9 (package.json declares `^4.1.8`, which is unsatisfiable with the
  current `vite ^5.4.19` — npm reports the installed vitest as "invalid"). `npm audit`
  flags this dependency chain: vitest <=3.2.5 / vite <=6.4.1 / esbuild <=0.24.2 (1
  critical: vitest UI arbitrary file read/exec; moderate: vite path traversal in
  sourcemaps, esbuild dev-server CORS). All three are dev-only dependencies (no
  production bundle impact for this client-side SPA), but the version pin mismatch
  should be resolved. A full fix requires a vite 5→6+ and vitest →3.2.6+/4.x major
  upgrade, which risks breaking the Vite/Vitest config and CI — needs a dedicated
  cycle with full regression testing (`npm run typecheck && npm run test && npm run
  build` plus a manual smoke check), not a quick fix folded into an unrelated cycle.
  - 2026-06-10 (cycle 16): Confirmed there is NO safe minimal fix — even pinning
    package.json's vitest range to `^2.1.9` (matching the installed version) would
    not resolve the audit, since 2.1.9 itself is within the vulnerable range
    (<3.2.6). The major upgrade is the only real fix; still deferred to a dedicated
    cycle.

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
