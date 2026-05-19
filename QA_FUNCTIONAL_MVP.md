# QA Functional MVP - PetroTarget AI

## Scope

Technical QA verification for `frandelyerro/delye` PR #7, checked on 2026-05-19 from `pull/7/head`. The PR head before this documentation update was commit `02bd9dd`.

No product features were added or changed. This pass does not modify the GCoS formula, thresholds, `mainRisk`, the domain model, Advisor behavior, Upload behavior, or functional UI.

## Environment note

PowerShell in this Codex environment blocks the `npm.ps1` wrapper with the local execution policy. The requested `npm ...` commands below were executed through `npm.cmd`, which invokes the same npm CLI without the PowerShell script wrapper.

## Registry

Command:

```powershell
npm.cmd config get registry
```

Output:

```text
https://registry.npmjs.org/
```

## npm install

Command:

```powershell
npm.cmd install --registry=https://registry.npmjs.org/
```

Output:

```text
added 218 packages, and audited 219 packages in 30s

36 packages are looking for funding
  run `npm fund` for details

5 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

Result: PASS. The previous `403 Forbidden` for `@types/leaflet` did not reproduce when installing from `https://registry.npmjs.org/`.

Because the registry install succeeded, `@types/leaflet` was left unchanged. No local Leaflet type fallback or import workaround was needed, and `MapPage` was not modified.

## Typecheck

Command:

```powershell
npm.cmd run typecheck
```

Output:

```text
> petrotarget-ai@0.1.0 typecheck
> tsc --noEmit
```

Result: PASS.

## Tests

Command:

```powershell
npm.cmd run test
```

Output summary:

```text
Test Files  3 passed (3)
Tests       10 passed (10)
```

Result: PASS.

## Build

Command:

```powershell
npm.cmd run build
```

Output summary:

```text
> petrotarget-ai@0.1.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
894 modules transformed.
dist/index.html                  0.45 kB | gzip:   0.30 kB
dist/assets/index-CUsla12P.css  23.71 kB | gzip:   8.52 kB
dist/assets/index-Bn-kLe3s.js  750.53 kB | gzip: 219.12 kB
built in 4.83s
```

Result: PASS, with Vite's standard chunk-size warning because the main JS bundle is larger than 500 kB after minification.

## Bugs found

- The reported npm registry `403 Forbidden` on `@types/leaflet` was not reproducible in this run with `--registry=https://registry.npmjs.org/`.
- `npm audit` reports 5 moderate vulnerabilities after install. No dependency upgrades were applied in this QA-only pass because that could change dependency behavior.
- Vite reports a production bundle chunk-size warning. No code splitting was added because this pass is limited to technical verification and bug fixing.

## Bugs fixed

- No code bugs were fixed in this iteration because the registry install, typecheck, test, and build all passed without source changes.

## Current technical status

The PR is not blocked by npm registry access in this Codex run. From the command verification above, the PR is technically mergeable on install, TypeScript, tests, and production build.

Manual browser route validation was not repeated in this iteration.
