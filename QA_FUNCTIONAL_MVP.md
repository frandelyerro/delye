# QA Functional Iteration — PetroTarget AI MVP

## Objetivo de la iteración
Realizar una iteración de QA funcional enfocada en estabilidad del MVP actual (sin agregar features de producto), validando estado de toolchain y ejecución de comandos base de calidad.

## Checklist de rutas probadas
> No se pudo levantar la app localmente por bloqueo de instalación de dependencias (403 al registry), por lo que no fue posible validar rutas en navegador en este entorno.

Estado de validación manual en UI:
- [ ] `/` Dashboard
- [ ] `/prospects/:id` Prospect Detail
- [ ] `/map` Map
- [ ] `/advisor` Advisor
- [ ] `/upload` Upload

## Resultados de comandos

### npm install
- **FAIL**: `npm ERR! 403 Forbidden - GET https://registry.npmjs.org/@types%2fleaflet`
- Impacto: no hay `node_modules`, no se pueden ejecutar de forma real typecheck/test/build.

### npm run typecheck
- **FAIL**: `TS2688 Cannot find type definition file for 'vite/client'`.
- Causa raíz: dependencias no instaladas por bloqueo de red/política.

### npm run test
- **FAIL**: `vitest: not found`.
- Causa raíz: dependencias no instaladas por bloqueo de red/política.

### npm run build
- **FAIL**: `TS2688 Cannot find type definition file for 'vite/client'`.
- Causa raíz: dependencias no instaladas por bloqueo de red/política.

## Bugs encontrados
1. **Entorno bloquea instalación de dependencias NPM** (403 al registry).
2. Como consecuencia, comandos de validación técnica no pueden ejecutarse correctamente en este entorno aislado.

## Bugs corregidos
- No se aplicaron correcciones de código de producto en esta iteración.
- Esta iteración documenta estado real de QA y bloqueos de infraestructura.

## Limitaciones pendientes
- Ejecutar QA funcional real en entorno con acceso a npm registry.
- Correr y registrar evidencia de:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- Validar manualmente rutas UI y flujos principales (dashboard, detalle, mapa, advisor, upload).

## Screenshots
- No disponibles en este entorno, ya que no se pudo iniciar la app por bloqueo en instalación de dependencias.
