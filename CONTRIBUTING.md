# Guía de contribución

## Requisitos

- Node 22 (usa el último parche de la serie 22). Con `nvm`, ejecuta `nvm use` en la raíz: lee `.nvmrc`.
- `npm ci` instala las dependencias de desarrollo y el hook de pre-commit.
- `npm ci --prefix mcp` instala las dependencias del servidor MCP (las necesitan `typecheck` y `mcp:test`).
- `npx playwright install chromium` descarga el navegador de los tests e2e (una vez por versión de Playwright).

La web (`site/`) no tiene build ni dependencias en runtime: se despliega tal cual en GitHub Pages.

## Ramas

- Crea la rama desde `main` actualizado: `git switch main && git pull --ff-only && git switch -c <tipo>/<descripcion-kebab>`.
- `<tipo>` es el mismo tipo del commit principal (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`…).

## Commits

Conventional Commits con el tipo en inglés y la descripción en español:

```
<tipo>(<ámbito>): <descripción>
```

- Descripción en imperativo (`añade`, `corrige`), asunto de menos de 72 caracteres y sin punto final.
- Sin líneas `Co-Authored-By` ni otras atribuciones de coautoría.
- El hook de pre-commit ejecuta `eslint --fix` y `prettier --write` sobre los ficheros staged; un error de ESLint no autocorregible rechaza el commit.

## Pull requests

1. Publica la rama: `git push -u origin <rama>`.
2. Abre el PR con `gh pr create`; la plantilla incluye la checklist de comprobaciones.
3. Se fusiona con `gh pr merge --rebase --delete-branch` solo con el CI en verde. Nunca se hace force-push a `main`.

## Comandos

| Comando                      | Qué hace                                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                   | Tests unitarios con `node --test` (`site/js` y `scripts`)                                                                                                                                                             |
| `npm run test:mutation`      | Mutación con Stryker sobre `core` y `mappers` (umbral 95 %, 180 s)                                                                                                                                                    |
| `npm run test:mutation:chat` | Mutación con Stryker sobre `site/js/chat` y la lógica de las tools en `core` en tres ejecuciones encadenadas (`herramientas.js` con `core`, el adaptador de OpenAI y el resto del chat), umbral 95 % y 180 s cada una |
| `npm run test:mutation:ui`   | Mutación con Stryker sobre `site/js/ui` en dos ejecuciones (`render-*.js` y el resto), umbral 85 % y 180 s cada una                                                                                                   |
| `npm run mcp:start`          | Arranca el servidor MCP por stdio                                                                                                                                                                                     |
| `npm run mcp:test`           | Tests del servidor MCP con `node --test`, sin red                                                                                                                                                                     |
| `npm run mcp:test:mutation`  | Mutación con Stryker sobre `mcp/src` en dos ejecuciones (módulos base y después tools, resources y prompts), umbral 85 % y 180 s cada una                                                                             |
| `npm run mcp:inspect`        | Abre el MCP Inspector (vía `npx`) con el servidor conectado                                                                                                                                                           |
| `npm run lint`               | ESLint sobre todo el JavaScript                                                                                                                                                                                       |
| `npm run lint:fix`           | ESLint aplicando las correcciones automáticas                                                                                                                                                                         |
| `npm run format`             | Reescribe el formato con Prettier                                                                                                                                                                                     |
| `npm run format:check`       | Falla si algún fichero no cumple el formato                                                                                                                                                                           |
| `npm run typecheck`          | `tsc` sin emitir ficheros sobre `core`, `mappers`, `api` y `mcp/src`                                                                                                                                                  |
| `npm run check:html`         | Comprueba que la cabecera de las 8 páginas HTML coincide                                                                                                                                                              |
| `npm run e2e`                | Smoke e2e en Chromium con Playwright y PokéAPI simulada, sin red                                                                                                                                                      |
| `npm run lhci`               | Lighthouse CI sobre `index.html` y `tipos.html` (3 ejecuciones; 0,95 exigido en accesibilidad, buenas prácticas y SEO, y aviso en rendimiento); usa PokéAPI real, así que necesita red                                |

Antes de abrir un PR deben pasar `npm test`, `npm run mcp:test`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run check:html`, `npm run test:mutation`, `npm run test:mutation:chat`, `npm run test:mutation:ui`, `npm run mcp:test:mutation`, `npm run e2e` y `npm run lhci` (este último contra PokéAPI real).

## Versiones

La versión se sigue con SemVer y es la misma en todos los artefactos. Para publicar una versión nueva (por ejemplo `1.2.0`):

1. Añade su entrada al principio de `CHANGELOG.md` (`## [1.2.0] - AAAA-MM-DD`, con su enlace de comparación al pie).
2. En la raíz, `npm version 1.2.0 --no-git-tag-version`: actualiza `package.json` y `package-lock.json`, y el script `version` regenera `site/js/version.js` (la versión del panel INFO).
3. En `mcp/`, `npm version 1.2.0 --no-git-tag-version`: actualiza `mcp/package.json` y `mcp/package-lock.json`.
4. En `mcp/server.json`, cambia a mano `version` y `packages[0].version`.
5. `npm test` incluye `scripts/version-coherence.test.mjs`, que falla nombrando cada fichero cuya versión difiera de `package.json` (lockfiles, `mcp/`, `version.js` y la última versión publicada del `CHANGELOG.md`).
6. Tras fusionar el PR, y solo con el CI y el despliegue de Pages de ese commit de `main` en verde, crea la etiqueta anotada y súbela:

   ```bash
   git switch main && git pull --ff-only
   git tag -a v1.2.0 -m "chore(release): versión 1.2.0"
   git push origin v1.2.0
   ```

   La etiqueta se crea después de fusionar porque `gh pr merge --rebase` reescribe los commits de la rama.

## Demo

`docs/media/demo.gif` se genera con:

```bash
node scripts/capture-demo.mjs
```

Sirve `site/` en un puerto libre, recorre la web en Chromium con PokéAPI simulada (los mismos fixtures del e2e, sin red) y convierte el vídeo en GIF. Necesita `npm ci`, el Chromium de Playwright (`npx playwright install chromium`) y `ffmpeg` y `ffprobe` en el `PATH`. Falla si el GIF supera 3 000 000 bytes o 15 s, si la página pide algo externo o si hay violaciones de la CSP. No forma parte del CI.

## TDD

Ningún código de producción sin un test que falle antes: rojo, verde y refactor. Los tests usan fixtures reales y dobles ligeros (fakes antes que mocks) y no acceden a la red.
