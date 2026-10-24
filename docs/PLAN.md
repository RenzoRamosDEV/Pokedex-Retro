# Plan de evolución — Pokédex Retro

Punto de partida: rama `main`, commit `73b20e6` (tag `v1.0.0-RC.0`).

Estado: fases 1–6 completadas; publicado como `v1.1.0`.

## 1. Resumen

- La web (HTML + CSS + módulos ES, sin build, en GitHub Pages) ya tiene una base sana: lógica pura separada, 135 tests y mutación alta.
- Faltan herramientas de calidad, CI en PR, rendimiento de red, endurecimiento (CSP, fuentes propias), accesibilidad y tests de UI.
- Se añade un servidor MCP por stdio que reutiliza `site/js/core` y `site/js/mappers` sin duplicar lógica.
- Seis fases, una rama y un PR por fase; cierra con la versión `1.1.0`.

## 2. Diagnóstico del estado actual

### Se conserva

- Lógica pura separada de la UI: `site/js/core/*` y `site/js/mappers/*` no tocan el DOM.
- `fetchJson` inyectado: `loadSection(fetchJson, config, parsedQuery)` (`site/js/core/load-section.js:45`).
- Mappers con fixtures de respuestas reales (`site/js/mappers/fixtures/*.json`).
- `escapeHtml` en toda salida HTML (`site/js/core/html.js:9`).
- `npm test`: 135 tests en verde (`node --test`, sin red). Stryker en `core` + `mappers`, `break: 95`, 99,27 % en el tag de partida (no reejecutado al redactar este plan: `node_modules` no instalado).
- Estética Game Boy y tres temas (`normal`, `gb`, `gray`).

### Problemas

| #   | Hallazgo                                                                                                                                    | Evidencia                                                                                                          | Fase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| P1  | `theme.js` tiene efectos al importarse (consulta el DOM y aplica el tema); no testeable                                                     | `site/js/ui/theme.js:4-8`, `:19`; importado por `site/js/ui/main.js:1`                                             | 2    |
| P2  | `localStorage.setItem` sin protección: si lanza (modo privado/cuota) rompe el tema                                                          | `site/js/ui/theme.js:12`                                                                                           | 2    |
| P3  | Cliente HTTP mínimo dentro de `main.js`: sin timeout, reintentos ni cancelación                                                             | `site/js/ui/main.js:29-32`                                                                                         | 2    |
| P4  | Textos en inglés en la UI: `HIDDEN`, `◀ PREV`, `NEXT ▶`                                                                                     | `render-pokedex.js:43`, `layout.js:24-28`                                                                          | 2    |
| P5  | Literales de texto dispersos (incl. `HEIGHT`, `WEIGHT`, `BASE EXP`, `ABILITIES`, `BASE STATS`, `POW`/`ACC`/`PRI`, `ATK ╲ DEF`)              | `render-pokedex.js:82-104`, `render-moves.js:19-22`, `render-types.js:42`, `main.js:25-27`                         | 2    |
| P6  | Cabecera y navegación duplicadas en los 7 HTML (idénticas salvo la clase `active`); sin control de divergencia                              | `site/*.html:41-110`                                                                                               | 2    |
| P7  | Enlace activo sin `aria-current="page"`                                                                                                     | `site/index.html:102`                                                                                              | 2    |
| P8  | Versión `1.0` fija en el panel INFO de los 7 HTML                                                                                           | `site/index.html:81`                                                                                               | 2    |
| P9  | Meta `description` menciona "cadenas evolutivas", que la web no muestra (7 HTML)                                                            | `site/index.html:8`                                                                                                | 2    |
| P10 | Sin lint, formato ni typecheck; `package.json` solo tiene `test` y `test:mutation`                                                          | `package.json`                                                                                                     | 1    |
| P11 | CI solo en el despliegue: `pages.yml` corre en `push` a `main`, ejecuta `npm test` sin `npm ci`, sin lint ni mutación; los PR no se validan | `.github/workflows/pages.yml:3-6`, `:18-25`                                                                        | 1    |
| P12 | Cada búsqueda vuelve a descargar la lista completa (`limit=100000`) sin caché                                                               | `site/js/core/load-section.js:5`, `:22-23`                                                                         | 3    |
| P13 | Detalles pedidos con `Promise.all` sin límite de concurrencia                                                                               | `site/js/core/load-section.js:53`                                                                                  | 3    |
| P14 | Fallos de detalle silenciados (`null` filtrado): el usuario no sabe que faltan elementos                                                    | `site/js/core/load-section.js:36-43`, `:56`                                                                        | 3    |
| P15 | Dependencia de Google Fonts (privacidad, latencia, bloquea CSP `'self'`)                                                                    | `site/index.html:34-36` (7 HTML)                                                                                   | 3    |
| P16 | Sin CSP en ningún HTML                                                                                                                      | `site/*.html`                                                                                                      | 3    |
| P17 | Atributos `style=` generados por JS (incompatibles con CSP sin `'unsafe-inline'`)                                                           | `render-pokedex.js:52`, `render-natures.js:14`, `render-natures.js:46`; colores en `site/js/mappers/nature.js:2-6` | 3    |
| P18 | `<img>` sin `width`/`height`/`decoding` (CLS); `loading` solo en tarjetas                                                                   | `render-pokedex.js:19`, `render-items.js:6`                                                                        | 3    |
| P19 | Sin `404.html`, `robots.txt`, `sitemap.xml` ni `manifest.webmanifest`                                                                       | `site/`                                                                                                            | 3    |
| P20 | Modal = `div` abierto con `:target`: sin trampa de foco, sin Escape, sin retorno de foco                                                    | `render-pokedex.js:56-62`, `site/css/pokedex.css:260-262`                                                          | 4    |
| P21 | Botones tema/info sin `aria-expanded`/`aria-controls`; sin cierre con Escape                                                                | `site/index.html:51`, `:66`; `theme.js:21-39`                                                                      | 4    |
| P22 | Menú móvil: checkbox con `aria-hidden="true"` + `label`; no operable ni anunciado por teclado                                               | `site/index.html:42-45`, `pokedex.css:580-586`                                                                     | 4    |
| P23 | Sin skip-link, sin `<noscript>`, mensajes de estado sin región viva                                                                         | `site/index.html:112-114`, `layout.js:17-19`                                                                       | 4    |
| P24 | Transiciones sin `prefers-reduced-motion`; contraste del tema `gb` no verificado                                                            | `pokedex.css:130`, `:481`, `:606`; `:1406-1454`                                                                    | 4    |
| P25 | Capa `ui` sin tests ni mutación                                                                                                             | `site/js/ui/` (0 `*.test.js`); `stryker.config.json` `mutate`                                                      | 4    |

### Observaciones fuera de alcance (no se actúa en este plan)

- Precio de objetos: el mapper lee `json.cost ?? null` (`site/js/mappers/item.js:7`) y el fixture real de PokéAPI no trae `cost`, así que la columna PRECIO muestra `—` (`render-items.js:8-10`). Queda como seguimiento.
- `og:image` / `twitter:image` con URL relativa (`site/index.html:17`, `:27`); los rastreadores esperan URL absoluta.

## 3. Estructura objetivo

```
.
├── .github/
│   ├── workflows/{ci.yml,pages.yml}
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── PLAN.md  ARCHITECTURE.md
│   ├── adr/0001…0004-*.md
│   └── media/demo.gif
├── scripts/{check-html,sync-version,capture-demo}.mjs
├── site/
│   ├── *.html (7)  404.html  robots.txt  sitemap.xml  manifest.webmanifest
│   ├── css/pokedex.css
│   ├── fonts/*.woff2 + OFL.txt
│   ├── images/
│   └── js/
│       ├── version.js  purity.test.js
│       ├── api/client.js        (fetchJson + caché + reintentos)
│       ├── core/                (puro; + limit.js)
│       ├── mappers/             (puro; fixtures)
│       └── ui/                  (strings.js, theme.js sin efectos, render-*, tests)
├── tests/e2e/smoke.spec.js
├── mcp/
│   ├── bin/pokedex-mcp.js
│   ├── src/{server,client,log}.js  src/{tools,resources,prompts}/
│   ├── test/
│   ├── package.json  server.json  README.md
├── eslint.config.js .prettierrc .prettierignore tsconfig.json lighthouserc.json
├── .editorconfig .nvmrc LICENSE CONTRIBUTING.md CHANGELOG.md README.md
└── package.json  stryker*.config.json
```

## 4. Reglas de trabajo comunes (las 6 fases)

1. La web sigue sin bundlers, transpiladores ni frameworks; `site/` se despliega tal cual. Cero dependencias en runtime de la web.
2. Código, comentarios, commits y docs en español. Commits Conventional Commits `<tipo>(<ámbito>): <descripción>` con tipo en inglés estándar, descripción en español en imperativo, asunto < 72 caracteres, sin punto final, sin `Co-Authored-By` ni mención a IA. Identidad git configurada sin cambios.
3. Cada fase se trabaja en una rama `<tipo>/<descripcion-kebab>` desde `main`, se abre un PR con `gh pr create`, se fusiona con `gh pr merge --rebase --delete-branch` solo cuando el CI del PR está en verde, y nunca con force-push a `main`.
4. TDD: ningún código de producción sin un test que falle antes. Al cerrar cada fase: `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` y `npm run test:mutation` en verde.
5. Umbral de mutación (Stryker, `thresholds.break`): 95 % en `site/js/core` + `site/js/mappers` (no baja nunca); 85 % en `site/js/ui` (desde la fase 4) y en `mcp/src` (fase 5). Cada ejecución de Stryker se aborta si supera 180 s; si una config no cabe, se divide en varias configs que sí quepan.
6. Se conserva: lógica pura separada de la UI, `fetchJson` inyectado, mappers con fixtures reales, `escapeHtml` en toda salida HTML, estética Game Boy y los tres temas.
7. Dependencias de desarrollo y del MCP: solo las listadas en este plan; cualquier otra se justifica en el PR.

## 5. Decisiones tomadas

| Decisión                                                                                                                                   | ADR  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Cabecera y navegación estáticas en los 7 HTML + `scripts/check-html.mjs` en CI (solo puede diferir `aria-current="page"`)                  | 0001 |
| Caché: listas completas en `localStorage` (TTL 24 h); detalles en memoria + `sessionStorage`; MCP en memoria (TTL 24 h) con disco opcional | 0002 |
| MCP por stdio, no HTTP: uso local con Claude Desktop/Claude Code, sin servidor que mantener                                                | 0003 |
| JavaScript + JSDoc + `// @ts-check` con `tsc --noEmit` en lugar de TypeScript: sin build y módulos compartidos con el MCP                  | 0004 |
| `◀ PREV` / `NEXT ▶` → `◀ ANT.` / `SIG. ▶`; `HIDDEN` → `OCULTA`                                                                             | —    |
| Tema inicial sin preferencia guardada: `gray` si `prefers-color-scheme: dark`, si no `normal` (fase 4)                                     | —    |
| Barras de estadísticas con `data-valor` + `style.setProperty('--ancho', …)` vía CSSOM (compatible con CSP)                                 | —    |
| Modal con `<dialog>` nativo (`showModal()`), enlace profundo `#pokemon-<id>` con `history.replaceState`                                    | —    |
| MCP: `tamano_pagina` 1–50, por defecto 10                                                                                                  | —    |
| MCP: nombres de tipos, estadísticas y búsqueda en inglés de PokéAPI (`fire`)                                                               | —    |
| MCP: caché en disco solo con `POKEDEX_MCP_DISK_CACHE=1`                                                                                    | —    |
| `pages.yml` se dispara por `workflow_run` del CI en `main` con éxito (+ `workflow_dispatch`)                                               | —    |
| Una rama + un PR por fase, fusión `--rebase`                                                                                               | —    |

## 6. Fases

### Fase 1 — Plan, herramientas de calidad y CI

- **Objetivo:** plan aprobado y validación automática antes de mover código.
- **Entregables:** `docs/PLAN.md`, `docs/adr/0001…0004`, `.nvmrc` (`22`), `.editorconfig`, `eslint.config.js` (`@eslint/js` recomendado; `globals` browser en `site/js/ui` y `site/js/api`, node en tests, `scripts/`, `mcp/`), `.prettierrc` (`singleQuote`, `printWidth: 100`, `trailingComma: "all"`), `.prettierignore`, `tsconfig.json` (`allowJs`, `checkJs`, `noEmit`, `strict: false`, `NodeNext`; `core` + `mappers` con `// @ts-check`), `LICENSE` (MIT, Renzo Ramos, 2026), `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/dependabot.yml` (npm `/`, github-actions `/`, semanal), `.github/workflows/ci.yml` (PR + push a `main`; Node 22 y 24; mutación solo en 24; sin secretos), `pages.yml` vía `workflow_run`, scripts `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, hooks `simple-git-hooks` + `lint-staged`.
- **Cierre:** `npm test && npm run lint && npm run format:check && npm run typecheck && npm run test:mutation`; CI verde en el PR; un CI rojo en `main` no despliega.
- **Commits previstos:**
  - `docs(plan): añade el plan de evolución del proyecto`
  - `docs(adr): registra las decisiones 0001 a 0004`
  - `chore(repo): añade .nvmrc, .editorconfig, licencia y guía de contribución`
  - `build(lint): configura ESLint, Prettier y typecheck con tsc`
  - `style: aplica el formato de Prettier` (commit aislado)
  - `fix(lint): corrige los avisos de ESLint existentes`
  - `build(hooks): ejecuta lint-staged en pre-commit`
  - `ci: añade el workflow de CI con matriz Node 22 y 24`
  - `ci(pages): despliega solo tras un CI verde en main`
  - `chore(deps): configura Dependabot semanal`
- **Dependencias nuevas:** `eslint`, `@eslint/js`, `globals`, `eslint-config-prettier`, `prettier`, `typescript`, `simple-git-hooks`, `lint-staged` (ver sección 7).

### Fase 2 — Arquitectura de la web

- **Objetivo:** UI testeable, cliente HTTP propio, textos centralizados y `core`/`mappers` importables desde Node.
- **Entregables:** `site/js/api/client.js` (`createFetchJson({ fetch, cache, timeoutMs = 10000, retries = 2 })`; reintenta en red/429/5xx con `500 ms × 2^intento`; `AbortError` y `TimeoutError`), `AbortController` por carga abortado en `pagehide` sin pintar error, `theme.js` con `initTheme(document, storage)` tolerante a `storage` que lanza, `site/js/ui/strings.js` congelado, `aria-current="page"` en los 7 HTML, `scripts/check-html.mjs` + `npm run check:html` en CI, `site/js/version.js` + `scripts/sync-version.mjs` + test de coherencia, `site/js/purity.test.js`, meta `description` sin "cadenas evolutivas".
- **Cierre:** reglas comunes (4) + `npm run check:html`; tests ≥ 135; escenarios: 503→200 en 2 llamadas, 404 en 1 llamada, `pagehide` sin mensaje de error, `tipos.html` divergente → código 1.
- **Commits previstos:**
  - `feat(api): añade el cliente fetchJson con reintentos y timeout`
  - `feat(ui): cancela las cargas pendientes al salir de la página`
  - `refactor(ui): elimina los efectos al importar theme.js`
  - `refactor(ui): centraliza los textos de la interfaz en strings.js`
  - `fix(ui): traduce OCULTA y la paginación ANT./SIG.`
  - `feat(site): marca la página activa con aria-current`
  - `ci(html): comprueba que las cabeceras de las páginas coinciden`
  - `feat(site): muestra la versión desde version.js`
  - `test(core): verifica que core y mappers se importan sin DOM`
  - `fix(site): corrige la meta description de las páginas`
- **Dependencias nuevas:** ninguna.

### Fase 3 — Rendimiento y seguridad

- **Objetivo:** menos peticiones a PokéAPI, carga más rápida y web endurecida para Pages.
- **Entregables:** caché de listas (`pokedex:lista:<url>`, `{ t, data }`, TTL 86 400 000 ms) y detalles (`Map` + `sessionStorage`, `pokedex:detalle:<url>`) tolerantes a JSON corrupto y a `QuotaExceededError`; `site/js/core/limit.js` (máx. 6 en vuelo, `Promise.allSettled`); aviso `role="status"` `N ELEMENTOS NO SE PUDIERON CARGAR` / `1 ELEMENTO NO SE PUDO CARGAR`; `site/fonts/*.woff2` + `OFL.txt` con `@font-face` `font-display: swap` y `preload`; `<img>` con `width`, `height`, `loading="lazy"`, `decoding="async"`; CSP en `<meta>` (texto exacto en ADR/PR, sin `'unsafe-inline'`); barras con `data-valor` + `--ancho`; clases `acc-stat-<estadistica>`; test anti `style=`/`<script>` inline/`on*=`; `404.html` (rutas `/Pokedex-Retro/...`), `robots.txt`, `sitemap.xml`, `manifest.webmanifest` (iconos 192/512).
- **Cierre:** reglas comunes + `check:html`; escenarios: lista de hace 2 h sin petición, de hace 25 h re-pedida, máx. 6 simultáneas con 18 detalles, 16 tarjetas + aviso con 2 fallos, cuota llena sin error visible.
- **Commits previstos:**
  - `feat(api): cachea las listas completas en localStorage 24 h`
  - `feat(api): cachea los detalles en memoria y sessionStorage`
  - `feat(core): limita a 6 las peticiones de detalle simultáneas`
  - `feat(ui): avisa de los elementos que no se pudieron cargar`
  - `perf(site): autoaloja las fuentes Press Start 2P y VT323`
  - `perf(ui): añade dimensiones y carga diferida a las imágenes`
  - `refactor(ui): sustituye los estilos en línea por clases y CSSOM`
  - `feat(site): añade Content-Security-Policy a todas las páginas`
  - `feat(site): añade 404, robots, sitemap y manifest`
- **Dependencias nuevas:** ninguna (iconos y `woff2` se versionan como ficheros).

### Fase 4 — Accesibilidad y tests de UI

- **Objetivo:** WCAG 2.1 AA y capa `ui` blindada con unit, e2e y Lighthouse.
- **Entregables:** `<dialog>` con `showModal()`, `aria-labelledby`, foco al cerrar/abrir y enlace profundo; skip-link `Saltar al contenido` → `#contenido`; `aria-expanded`/`aria-controls`/`aria-haspopup` y Escape en tema/info; menú móvil operable por teclado; contenedor `role="status" aria-live="polite"`; `<noscript>`; `prefers-reduced-motion`; tema inicial por `prefers-color-scheme`; contraste AA en los tres temas; tests `node:test` de `layout.js` y `render-*.js`; Stryker `ui` (sin `main.js`/`theme.js`) `break: 85`; `tests/e2e/smoke.spec.js` (Chromium, axe, PokéAPI mockeada con fixtures); `lighthouserc.json` (`index.html`, `tipos.html`, 3 ejecuciones, `minScore: 0.95`).
- **Cierre:** reglas comunes + `check:html` + `npm run e2e` + `npm run lhci`; 0 violaciones axe `serious`/`critical` por página y tema.
- **Commits previstos:**
  - `test(ui): cubre layout y render con escapado y estructura`
  - `feat(ui): abre el detalle en un dialog nativo con foco gestionado`
  - `feat(site): añade skip-link, noscript y región de estado`
  - `feat(ui): anuncia el estado de los desplegables y cierra con Escape`
  - `fix(site): hace el menú móvil accesible por teclado`
  - `feat(ui): respeta prefers-reduced-motion y prefers-color-scheme`
  - `fix(css): ajusta el contraste del tema DMG a AA`
  - `test(mutation): añade la config de Stryker para la capa ui`
  - `test(e2e): añade el smoke de Playwright con axe`
  - `ci(lhci): ejecuta Lighthouse CI en los PR`
- **Dependencias nuevas:** `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`.

### Fase 5 — Servidor MCP

- **Objetivo:** consultar la Pokédex desde Claude Desktop/Claude Code reutilizando `core` y `mappers`, sin backend.
- **Entregables:** `mcp/` (bin, `server.js`, `client.js` con User-Agent, timeout 10 s, 2 reintentos, `Retry-After`, 4 simultáneas, caché 24 h y disco opcional SHA-256, `log.js` a stderr con `POKEDEX_MCP_LOG`); tools `buscar_*`/`obtener_*` (pokémon, movimientos, habilidades, objetos, bayas), `efectividad_tipos`, `naturalezas` con zod + `outputSchema` + `structuredContent`; errores `isError: true` accionables en español; resources `pokedex://tipos/tabla` y `pokedex://secciones`; prompts `comparar_pokemon`, `equipo_contra_tipo`; cierre limpio en `SIGINT`/`SIGTERM` (< 2 s); tests con `InMemoryTransport` y `fetch` falso; `server.json`; `mcp/README.md`; scripts `mcp:start`, `mcp:test`, `mcp:test:mutation`, `mcp:inspect`; CI, `tsconfig.json` y Dependabot (`/mcp`) actualizados.
- **Cierre:** reglas comunes + `npm run mcp:test` + `npm run mcp:test:mutation` (≥ 85 %); stdout solo JSON-RPC con `POKEDEX_MCP_LOG=debug`; `tamano_pagina: 51` → `tamano_pagina debe estar entre 1 y 50.`; `electric` vs `["water","flying"]` → `4`.
- **Commits previstos:**
  - `feat(mcp): crea el paquete y el servidor stdio`
  - `feat(mcp): añade el cliente de PokéAPI con caché y reintentos`
  - `feat(mcp): añade las tools de búsqueda y detalle`
  - `feat(mcp): añade efectividad de tipos y naturalezas`
  - `feat(mcp): expone resources y prompts`
  - `feat(mcp): cierra el servidor limpiamente con SIGINT y SIGTERM`
  - `test(mcp): añade la mutación del servidor MCP`
  - `ci(mcp): ejecuta los tests y la mutación del MCP`
  - `docs(mcp): documenta la instalación y las tools`
- **Dependencias nuevas:** runtime `@modelcontextprotocol/sdk` (1.x estable), `zod`; `@modelcontextprotocol/inspector` solo vía `npx`.

### Fase 6 — Documentación de portafolio y v1.1.0

- **Objetivo:** presentar el proyecto como pieza de portafolio y etiquetar `v1.1.0`.
- **Entregables:** `README.md` (orden fijado: título, GIF, demo, características, Mermaid, local, MCP, tests, ADRs, licencia), `docs/ARCHITECTURE.md` (dos Mermaid, carpetas, flujo de búsqueda, caché), `docs/media/demo.gif` (≤ 3 MB, ≤ 15 s) con `scripts/capture-demo.mjs` (fuera de CI), `CHANGELOG.md` (Keep a Changelog: `1.0.0-RC.0`, `1.1.0`), versión `1.1.0` en `package.json`, `mcp/package.json`, `mcp/server.json`, `site/js/version.js` + test de coherencia.
- **Cierre:** todas las comprobaciones en verde; tras fusionar, tag anotado `v1.1.0` sobre `main` y `git push origin v1.1.0`; HTTP 200 en las 7 páginas, `404.html`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`.
- **Commits previstos:**
  - `docs(readme): reescribe el README como portafolio`
  - `docs(arch): documenta la arquitectura y la estrategia de caché`
  - `docs(media): añade el script y el GIF de demo`
  - `docs(changelog): añade el historial de cambios`
  - `chore(release): publica la versión 1.1.0`
- **Dependencias nuevas:** ninguna en npm; `ffmpeg` como herramienta local del script de demo.

## 7. Dependencias previstas

| Paquete                                    | Dónde               | Por qué                                            |
| ------------------------------------------ | ------------------- | -------------------------------------------------- |
| `@stryker-mutator/core` (existente)        | raíz, dev           | Mutación de `core`, `mappers`, `ui` y `mcp/src`    |
| `eslint`, `@eslint/js`, `globals`          | raíz, dev           | Lint con flat config y globales por entorno        |
| `eslint-config-prettier`                   | raíz, dev           | Desactiva reglas de estilo que chocan con Prettier |
| `prettier`                                 | raíz, dev           | Formato único del repo                             |
| `typescript`                               | raíz, dev           | `tsc --noEmit` sobre JS con JSDoc (ADR 0004)       |
| `simple-git-hooks`, `lint-staged`          | raíz, dev           | Lint y formato en pre-commit sobre ficheros staged |
| `@playwright/test`, `@axe-core/playwright` | raíz, dev           | e2e en Chromium y auditoría axe                    |
| `@lhci/cli`                                | raíz, dev           | Presupuestos de Lighthouse en PR                   |
| `@modelcontextprotocol/sdk`                | `mcp/`, runtime     | Servidor, transporte stdio e `InMemoryTransport`   |
| `zod`                                      | `mcp/`, runtime     | Validación de entradas y `outputSchema`            |
| `@modelcontextprotocol/inspector`          | `npx`, sin instalar | Depuración manual (`mcp:inspect`)                  |

## 8. Riesgos y mitigaciones

| Riesgo                                                                               | Mitigación                                                                                      |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Stryker supera 180 s al sumar `ui` y `mcp/src`                                       | Configs separadas (`core`+`mappers`, `ui`, `mcp`), cada una con su `timeout 180`                |
| Lighthouse performance < 0,95 por la latencia real de PokéAPI                        | La aserción de performance pasa a `warn`; cifra obtenida documentada en el PR                   |
| CSP en `<meta>` no admite `frame-ancestors` ni cabeceras HTTP (Pages no las permite) | Se documenta la limitación en la ADR/PR; no se promete protección anti-iframe                   |
| `tsc` sobre carpetas con `*.test.js` necesita tipos de Node (`node:test`)            | Excluir tests del `tsconfig.json`; si se necesitan, justificar `@types/node` en el PR           |
| Uso razonable de PokéAPI (API pública, sin clave)                                    | Caché web y MCP, máx. 6/4 peticiones simultáneas, User-Agent identificable, reintentos acotados |
| e2e/Lighthouse inestables con red real                                               | PokéAPI mockeada con fixtures en e2e; Lighthouse acotado a dos páginas y 3 ejecuciones          |
| GIF de demo > 3 MB                                                                   | Resolución y fps reducidos en `ffmpeg`, paleta optimizada, duración ≤ 15 s                      |
| Rutas absolutas de `404.html` acopladas a `/Pokedex-Retro/`                          | Si cambia el nombre del repo, se actualizan 404, `robots.txt` y `sitemap.xml` juntos            |
| Contraste AA cambia la paleta del tema `gb`                                          | Ajuste dentro de la gama verde; verificación con axe en e2e                                     |
| Prettier reformatea todo el código existente                                         | Commit aislado `style: aplica el formato de Prettier`, sin cambios de lógica                    |

## 9. Plan completado

Cada fase está archivada en `openspec/changes/archive/`.
