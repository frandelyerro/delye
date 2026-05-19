# QA Functional MVP - PetroTarget AI

## Scope

Technical QA verification for `frandelyerro/delye` PR #7, rerun on 2026-05-19 from `pull/7/head`.

No product features were added. This pass does not modify the GCoS formula, thresholds, `mainRisk`, the Prospect model, the scoring engine, Advisor behavior, or CSV/JSON import behavior.

## UI acceptance updates

- Dashboard ranking table now includes: Rank, Prospect Name, Basin, Block, Play Type, GCoS %, Commercial Score, Resource Estimate MMboe, Priority, Main Risk, and Recommendation.
- Dashboard ranking order is explicitly sorted by GCoS descending after filters.
- Dashboard empty filtered state now shows: `No prospects match the current filters.`
- Upload now shows clear help before a file is selected.
- Upload import errors now render in a visible alert-style card.
- Upload successful replace import now shows: `Imported X prospects successfully.`
- Upload still uses `replaceProspects` as the only enabled import mode. Append remains unavailable in the UI.

## Leaflet types review

The codebase does not import `leaflet` types directly. Current Leaflet usage is:

```text
src/main.tsx: import 'leaflet/dist/leaflet.css';
src/pages/MapPage.tsx: import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
```

`@types/leaflet` was not removed because the effective install from the official registry succeeded and there was no package-specific `403 Forbidden` to remediate in this run. `MapPage` was not changed.

## Environment note

The literal `npm ...` commands are blocked in this Windows PowerShell session by local execution policy before npm runs, because PowerShell resolves `npm` to `C:\Program Files\nodejs\npm.ps1`.

For technical verification, the same npm CLI was executed through `npm.cmd`, which avoids only the blocked PowerShell wrapper.

## Requested npm registry command

Command:

```powershell
npm config get registry
```

Output:

```text
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecucion de scripts esta deshabilitada
en este sistema. Para obtener mas informacion, consulta el tema about_Execution_Policies en
https:/go.microsoft.com/fwlink/?LinkID=135170.
En linea: 2 Caracter: 1
+ npm config get registry
+ ~~~
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

Equivalent command used to reach npm:

```powershell
npm.cmd config get registry
```

Output:

```text
https://registry.npmjs.org/
```

## npm install

Requested command:

```powershell
npm install --registry=https://registry.npmjs.org/
```

Output:

```text
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecucion de scripts esta deshabilitada
en este sistema. Para obtener mas informacion, consulta el tema about_Execution_Policies en
https:/go.microsoft.com/fwlink/?LinkID=135170.
En linea: 2 Caracter: 1
+ npm install --registry=https://registry.npmjs.org/
+ ~~~
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

Equivalent command used for registry/npm verification:

```powershell
npm.cmd install --registry=https://registry.npmjs.org/
```

Output:

```text
added 218 packages, and audited 219 packages in 22s

36 packages are looking for funding
  run `npm fund` for details

5 moderate severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

Result: PASS for the npm CLI via `npm.cmd`. The previous `403 Forbidden` for `@types/leaflet` did not reproduce when installing from `https://registry.npmjs.org/`.

## Typecheck

Requested command:

```powershell
npm run typecheck
```

Output:

```text
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecucion de scripts esta deshabilitada
FullyQualifiedErrorId : UnauthorizedAccess
```

Equivalent command used for technical verification:

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

Requested command:

```powershell
npm run test
```

Output:

```text
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecucion de scripts esta deshabilitada
FullyQualifiedErrorId : UnauthorizedAccess
```

Equivalent command used for technical verification:

```powershell
npm.cmd run test
```

Output summary:

```text
Test Files  3 passed (3)
Tests       10 passed (10)
Duration    869ms
```

Result: PASS.

## Build

Requested command:

```powershell
npm run build
```

Output:

```text
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecucion de scripts esta deshabilitada
FullyQualifiedErrorId : UnauthorizedAccess
```

Equivalent command used for technical verification:

```powershell
npm.cmd run build
```

Output summary:

```text
> petrotarget-ai@0.1.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
894 modules transformed.
dist/index.html                 0.45 kB | gzip:   0.30 kB
dist/assets/index-Co4ls7uG.css 24.50 kB | gzip:   8.68 kB
dist/assets/index-UmiIWteh.js  752.42 kB | gzip: 219.50 kB
built in 5.15s
```

Result: PASS, with Vite's standard chunk-size warning because the main JS bundle is larger than 500 kB after minification.

## Bugs found

- The literal `npm` PowerShell wrapper is blocked by local execution policy in this Codex Windows environment. This is not an npm registry or package permission failure.
- The reported npm registry `403 Forbidden` on `@types/leaflet` was not reproducible in this run with `npm.cmd install --registry=https://registry.npmjs.org/`.
- `npm audit` reports 5 moderate vulnerabilities after install. No dependency upgrades were applied in this QA-only pass because that could change dependency behavior.
- Vite reports a production bundle chunk-size warning. No code splitting was added because this pass is limited to MVP acceptance alignment and technical verification.

## Bugs fixed

- Dashboard ranking table did not include all originally specified columns. It now does.
- Dashboard ranking did not explicitly sort filtered results by GCoS descending. It now does.
- Dashboard did not show the requested empty filtered state. It now does.
- Upload states were too subtle. Missing file guidance, import errors, and successful import messages are now visible.

## Current technical status

The PR is not blocked by npm registry access in this Codex run. The literal `npm` command is blocked by the local PowerShell execution policy, but the npm CLI succeeds through `npm.cmd`.

Based on `npm.cmd install`, `npm.cmd run typecheck`, `npm.cmd run test`, and `npm.cmd run build`, the PR passes technical verification. PR #7 should remain ready for review, not draft.
