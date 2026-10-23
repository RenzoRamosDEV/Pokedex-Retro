# Propuesta: Fase 1 — plan, herramientas de calidad y CI

## Why

Pokédex Retro (web estática HTML + CSS + módulos ES en GitHub Pages) va a crecer en 6 fases y hoy no tiene lint, formato, typecheck ni CI en los PR: `pages.yml` despliega en cada `push` a `main` tras un `npm test` sin `npm ci`, y nada valida un PR antes de fusionarlo. Esta fase deja el plan aprobado y la validación automática **antes** de mover código, para que cada fase siguiente se compruebe sola.

## What Changes

- Se versiona el plan aprobado (`docs/PLAN.md`) y cuatro ADR (`docs/adr/0001…0004`): cabecera/navegación estáticas con control en CI, estrategia de caché, MCP por stdio, JavaScript + JSDoc + `// @ts-check` en lugar de TypeScript.
- Se versiona la configuración de OpenSpec y este cambio.
- Herramientas de calidad de desarrollo (sin efecto en `site/` desplegado): ESLint flat config, Prettier, `tsc` solo como typecheck, `.editorconfig`, `.nvmrc` (`22`).
- Scripts raíz nuevos: `lint`, `lint:fix`, `format`, `format:check`, `typecheck` (se mantienen `test` y `test:mutation`).
- Hook de pre-commit (`simple-git-hooks` + `lint-staged`): `eslint --fix` y `prettier --write` sobre los ficheros staged; un error no autocorregible rechaza el commit.
- Formateo del código existente con Prettier en un commit aislado y arreglo mínimo de los avisos de ESLint existentes (sin cambios de comportamiento de la web).
- Workflow `ci.yml`: en `pull_request` y `push` a `main`, Node 22 y 24, `npm ci` + lint + formato + typecheck + tests; mutación solo en Node 24; sin secretos.
- **BREAKING (operativo)**: `pages.yml` deja de dispararse en `push` y pasa a `workflow_run` del CI en `main` con éxito (más `workflow_dispatch`). Un CI rojo en `main` ya no despliega.
- Dependabot semanal para `npm` y `github-actions` en `/`.
- `LICENSE` (MIT, Renzo Ramos, 2026), `CONTRIBUTING.md` y plantilla de PR con la checklist de comprobaciones.

Fuera de alcance: mover o reescribir módulos, cambios de comportamiento de la web, el servidor MCP, Playwright, Lighthouse y el check de HTML (sus pasos de CI llegan en la fase que los crea).

## Capabilities

### New Capabilities

- `calidad-codigo`: reglas de lint, formato y typecheck del repositorio, sus comandos y el control en pre-commit.
- `integracion-continua`: validación automática de PR y de `main`, despliegue a Pages condicionado al CI y actualización automática de dependencias.
- `gobierno-repositorio`: plan, decisiones de arquitectura, licencia, guía de contribución y plantilla de PR versionados.

### Modified Capabilities

Ninguna (no hay specs previas en `openspec/specs/`).

## Impact

- **Ficheros nuevos**: `docs/adr/0001…0004-*.md`, `.nvmrc`, `.editorconfig`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `tsconfig.json`, `LICENSE`, `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml`, `.github/workflows/ci.yml`; se versionan `docs/PLAN.md` y `openspec/`.
- **Ficheros modificados**: `package.json` / `package-lock.json` (scripts, devDependencies, config de hooks), `.github/workflows/pages.yml` (disparador), formato de `site/**`, `README.md` y `stryker.config.json`, `// @ts-check` en los 14 módulos no-test de `site/js/core` y `site/js/mappers`, import sin uso eliminado en `site/js/ui/render-natures.js`.
- **Dependencias de desarrollo nuevas**: `eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `prettier`, `typescript`, `simple-git-hooks`, `lint-staged`. Cero dependencias de runtime en la web.
- **Sistemas**: GitHub Actions (nuevo workflow CI, Pages encadenado), Dependabot.
